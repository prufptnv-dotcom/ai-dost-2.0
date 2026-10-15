const logger = require('../logger');

/**
 * Enterprise Real-Time Collaborative Canvas Socket Controller
 * Implements Figma/Replit-style multi-user presence, remote cursors,
 * monotonic revision synchronization, and virtual AI co-editing.
 */

// Active collaborative rooms: roomId -> { content, version, language, title, participants: Map() }
const rooms = new Map();

// P2 #51/#52: bounded content + AI co-edit throttling
const MAX_CONTENT_CHARS = Number(process.env.CANVAS_MAX_CONTENT_CHARS || 1000000);
const AI_COOLDOWN_MS = Number(process.env.CANVAS_AI_COOLDOWN_MS || 10000);
const aiCooldownUntil = new Map(); // socket.id -> earliest next AI co-edit ts

function clipContent(value) {
  if (typeof value !== 'string') return '';
  return value.length > MAX_CONTENT_CHARS ? value.slice(0, MAX_CONTENT_CHARS) : value;
}

// Vibrant HSL palettes for collaborator cursors & avatar rings
const COLLABORATOR_COLORS = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#f43f5e', // Rose
  '#a855f7', // Purple
];

function getOrCreateRoom(roomId, initialData = {}) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      content: clipContent(initialData.code || initialData.content || ''),
      version: 1,
      language: initialData.language || 'html',
      title: initialData.title || 'Collaborative Canvas',
      participants: new Map(),
      createdAt: Date.now(),
      lastModified: Date.now(),
      aiInFlight: false,
    });
  }
  return rooms.get(roomId);
}

function assignCollaboratorColor(existingParticipants) {
  const usedColors = new Set(Array.from(existingParticipants.values()).map((p) => p.color));
  for (const color of COLLABORATOR_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return COLLABORATOR_COLORS[existingParticipants.size % COLLABORATOR_COLORS.length];
}

function setupCollaborationSocket(io) {
  const canvasNamespace = io.of('/canvas');

  canvasNamespace.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUser = null;

    logger.info(`[Canvas:Collab] Client connected: ${socket.id}`);

    // User joins a canvas room
    socket.on('canvas:join', ({ roomId, user = {}, initialContent = {} } = {}, callback) => {
      if (!roomId) return;

      currentRoomId = roomId;
      socket.join(roomId);

      const room = getOrCreateRoom(roomId, initialContent);
      const color = user.color || assignCollaboratorColor(room.participants);

      currentUser = {
        socketId: socket.id,
        userId: user.id || socket.id,
        name: user.name || `Collaborator ${room.participants.size + 1}`,
        color,
        avatar: user.avatar || null,
        cursor: null,
        isTyping: false,
        joinedAt: Date.now(),
      };

      room.participants.set(socket.id, currentUser);
      logger.info(`[Canvas:Collab] ${currentUser.name} joined room: ${roomId} (Total: ${room.participants.size})`);

      // Send initial room snapshot to joining user
      const snapshot = {
        roomId,
        content: room.content,
        version: room.version,
        language: room.language,
        title: room.title,
        participants: Array.from(room.participants.values()),
      };

      if (typeof callback === 'function') {
        callback({ success: true, snapshot, currentUser });
      } else {
        socket.emit('canvas:init', snapshot);
      }

      // Broadcast to existing room peers that a new user joined
      socket.to(roomId).emit('canvas:user_joined', { user: currentUser });
    });

    // Remote cursor movement broadcast (throttled client-side)
    socket.on('canvas:cursor', ({ roomId, cursor, selection }) => {
      if (!roomId || !currentUser) return;
      currentUser.cursor = cursor;
      currentUser.selection = selection || null;

      socket.to(roomId).emit('canvas:cursor_update', {
        socketId: socket.id,
        userId: currentUser.userId,
        name: currentUser.name,
        color: currentUser.color,
        cursor,
        selection,
      });
    });

    // Typing activity indicator
    socket.on('canvas:typing', ({ roomId, isTyping }) => {
      if (!roomId || !currentUser) return;
      currentUser.isTyping = Boolean(isTyping);
      socket.to(roomId).emit('canvas:user_typing', {
        socketId: socket.id,
        isTyping: currentUser.isTyping,
      });
    });

    // Live code / document edit synchronization
    socket.on('canvas:edit', ({ roomId, fullContent, delta, version } = {}, callback) => {
      if (!roomId) return;
      // P2 #51: only joined participants may edit, and content is bounded —
      // previously ANY connected socket could overwrite any room's content
      // with an unbounded payload (memory + broadcast amplification).
      if (!currentUser || currentRoomId !== roomId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Not a member of this room' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room) return;

      if (fullContent !== undefined) {
        if (typeof fullContent !== 'string' || fullContent.length > MAX_CONTENT_CHARS) {
          if (typeof callback === 'function') {
            callback({ success: false, error: `fullContent must be a string up to ${MAX_CONTENT_CHARS} chars` });
          }
          return;
        }
        room.content = fullContent;
      }
      room.version += 1;
      room.lastModified = Date.now();

      // Broadcast updated content to all other peers in the room
      socket.to(roomId).emit('canvas:sync', {
        fullContent: room.content,
        delta: typeof delta === 'string' && delta.length <= 100000 ? delta : null,
        version: room.version,
        senderId: socket.id,
        senderName: currentUser ? currentUser.name : 'Remote User',
        timestamp: Date.now(),
      });

      if (typeof callback === 'function') {
        callback({ success: true, version: room.version });
      }
    });

    // AI Virtual Collaborator Co-Edit Trigger
    socket.on('canvas:ai_coedit', async ({ roomId, instruction, currentCode } = {}, callback) => {
      if (!roomId) return;
      // P2 #52: membership required + per-socket cooldown + per-room in-flight
      // guard — previously any socket could fire unlimited LLM calls.
      if (!currentUser || currentRoomId !== roomId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Not a member of this room' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room) return;
      if (!instruction || typeof instruction !== 'string' || instruction.length > 4000) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'instruction must be a string up to 4000 chars' });
        }
        return;
      }
      const now = Date.now();
      const cooldownUntil = aiCooldownUntil.get(socket.id) || 0;
      if (now < cooldownUntil) {
        if (typeof callback === 'function') {
          callback({ success: false, error: `AI co-edit on cooldown — retry in ${Math.ceil((cooldownUntil - now) / 1000)}s` });
        }
        return;
      }
      if (room.aiInFlight) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'AI co-edit already running for this room' });
        }
        return;
      }
      aiCooldownUntil.set(socket.id, now + AI_COOLDOWN_MS);
      room.aiInFlight = true;

      const aiCollaborator = {
        socketId: 'ai-dost-copilot',
        userId: 'ai-dost-copilot',
        name: 'AI-Dost Copilot',
        color: '#a855f7',
        isAi: true,
        isTyping: true,
      };

      // Notify peers that AI joined to co-edit
      canvasNamespace.to(roomId).emit('canvas:user_joined', { user: aiCollaborator });

      try {
        const { callLLM } = require('../services/llmCascade');
        const systemPrompt = `You are a live collaborative AI programmer co-editing an artifact with human teammates. 
Return ONLY the complete updated code matching the instruction. Do not include markdown ticks (\`\`\`) or commentary.`;

        const userPrompt = `Existing Code:\n${typeof currentCode === 'string' && currentCode.length <= MAX_CONTENT_CHARS ? currentCode : room.content}\n\nInstruction: ${instruction}`;
        const response = await callLLM(userPrompt, systemPrompt, { temperature: 0.2 });

        let cleanCode = clipContent(response.trim());
        if (cleanCode.startsWith('```')) {
          cleanCode = cleanCode.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
        }

        room.version += 1;
        room.content = cleanCode;
        room.lastModified = Date.now();

        // Broadcast AI's live sync
        canvasNamespace.to(roomId).emit('canvas:sync', {
          fullContent: room.content,
          delta: null,
          version: room.version,
          senderId: 'ai-dost-copilot',
          senderName: 'AI-Dost Copilot',
          timestamp: Date.now(),
        });

        if (typeof callback === 'function') {
          callback({ success: true, version: room.version, code: cleanCode });
        }
      } catch (err) {
        logger.error('[Canvas:Collab] AI co-edit error:', err.message);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      } finally {
        room.aiInFlight = false;
        // Disconnect AI virtual presence after co-edit completes
        setTimeout(() => {
          canvasNamespace.to(roomId).emit('canvas:user_left', { socketId: 'ai-dost-copilot' });
        }, 2000);
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      aiCooldownUntil.delete(socket.id);
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId);
        room.participants.delete(socket.id);
        logger.info(`[Canvas:Collab] User left room ${currentRoomId}. Remaining: ${room.participants.size}`);

        socket.to(currentRoomId).emit('canvas:user_left', {
          socketId: socket.id,
          userId: currentUser ? currentUser.userId : null,
        });

        // Clean up room memory after 1 hour if completely empty
        if (room.participants.size === 0) {
          setTimeout(() => {
            if (rooms.has(currentRoomId) && rooms.get(currentRoomId).participants.size === 0) {
              rooms.delete(currentRoomId);
            }
          }, 60 * 60 * 1000);
        }
      }
    });
  });
}

module.exports = { setupCollaborationSocket, rooms };
