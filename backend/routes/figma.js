const express = require('express');
const router = express.Router();

const FIGMA_API = 'https://api.figma.com/v1';

// ── Helpers ────────────────────────────────────────────────────────────
const getToken = () => process.env.FIGMA_API_KEY || '';

async function figmaFetch(path, options = {}) {
  const token = getToken();
  if (!token) {
    const err = new Error('FIGMA_API_KEY not set in backend/.env — Figma endpoints disabled');
    err.status = 503;
    err.code = 'FIGMA_NO_KEY';
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${FIGMA_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Figma API ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status === 401 || res.status === 403 ? 502 : 500;
      err.code = `FIGMA_HTTP_${res.status}`;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function walkNodes(node, results = []) {
  if (!node) return results;
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    results.push({
      id: node.id,
      name: node.name,
      type: node.type,
      description: node.description || '',
      characters: node.characters || null,
      visible: node.visible !== false,
      boundingBox: node.absoluteBoundingBox || null,
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkNodes(child, results);
  }
  return results;
}

function nodeToJsx(node, depth = 0) {
  if (!node) return '';
  const indent = '  '.repeat(depth);
  const name = (node.name || 'node').replace(/[^a-zA-Z0-9_]/g, '');
  const style = nodeToStyle(node);
  const styleAttr = style ? ` style={{${style}}}` : '';
  const children = (node.children || []).map(c => nodeToJsx(c, depth + 1)).join('\n');

  if (node.type === 'TEXT') {
    const text = (node.characters || '').replace(/"/g, '\\"');
    return `${indent}<p${styleAttr}>${text}</p>`;
  }
  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    return `${indent}<svg${styleAttr} viewBox="0 0 ${node.absoluteBoundingBox?.width || 100} ${node.absoluteBoundingBox?.height || 100}"><path d="${node.vectorNetwork?.vertices?.map(v => `M ${v.x} ${v.y}`).join(' ') || ''}" fill="currentColor"/></svg>`;
  }
  if (children) {
    return `${indent}<div${styleAttr} className="${name}">\n${children}\n${indent}</div>`;
  }
  return `${indent}<div${styleAttr} className="${name}"></div>`;
}

function rgbToCss(color) {
  if (!color) return 'transparent';
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a ?? 1})`;
}

function nodeToStyle(node) {
  const parts = [];
  const box = node.absoluteBoundingBox;
  if (box?.width) parts.push(`width:${Math.round(box.width)}px`);
  if (box?.height) parts.push(`height:${Math.round(box.height)}px`);
  if (node.fills) {
    const solid = node.fills.find(f => f.type === 'SOLID');
    if (solid) parts.push(`background:${rgbToCss(solid.color)}`);
  }
  if (node.strokes?.length) {
    const stroke = node.strokes.find(s => s.type === 'SOLID');
    if (stroke) parts.push(`border:1px solid ${rgbToCss(stroke.color)}`);
  }
  if (node.effects) {
    const shadow = node.effects.find(e => e.type === 'DROP_SHADOW');
    if (shadow) parts.push(`box-shadow:0 ${Math.round(shadow.offset?.y || 2)}px ${Math.round(shadow.radius || 4)}px ${rgbToCss(shadow.color)}`);
  }
  return parts.join(', ');
}

// ── Routes ─────────────────────────────────────────────────────────────

// GET /api/figma/health
router.get('/health', (_req, res) => {
  res.json({ healthy: !!getToken(), status: getToken() ? 'ok' : 'missing_key' });
});

// GET /api/figma/file/:fileKey — fetch file metadata
router.get('/file/:fileKey', async (req, res, next) => {
  try {
    const file = await figmaFetch(`/files/${req.params.fileKey}`);
    res.json({ name: file.name, lastModified: file.lastModified, thumbnailUrl: file.thumbnailUrl, version: file.version });
  } catch (err) { next(err); }
});

// GET /api/figma/components?fileKey=...&componentId=... (optional)
router.get('/components', async (req, res, next) => {
  try {
    const { fileKey, componentId } = req.query;
    if (!fileKey) return res.status(400).json({ error: 'fileKey query param is required' });
    const data = await figmaFetch(`/files/${fileKey}`);
    let components = walkNodes(data.document);
    if (componentId) components = components.filter(c => c.id === componentId);
    res.json({ count: components.length, components });
  } catch (err) { next(err); }
});

// GET /api/figma/design-to-code?fileKey=...&nodeId=...
router.get('/design-to-code', async (req, res, next) => {
  try {
    const { fileKey, nodeId } = req.query;
    if (!fileKey) return res.status(400).json({ error: 'fileKey query param is required' });
    if (!nodeId) return res.status(400).json({ error: 'nodeId query param is required (Figma node id, e.g. 1:23)' });

    const data = await figmaFetch(`/files/${fileKey}`);
    let found = data.document?.findNode?.id === nodeId ? data.document : null;
    if (!found && data.document) {
      const stack = [data.document];
      while (stack.length) {
        const n = stack.pop();
        if (n.id === nodeId) { found = n; break; }
        if (n.children) stack.push(...n.children);
      }
    }
    if (!found) return res.status(404).json({ error: `Node ${nodeId} not found in file` });

    const componentName = (found.name || 'Component').replace(/[^a-zA-Z0-9_]/g, '');
    const code = `import React from 'react';

export default function ${componentName}(props) {
  return (
${nodeToJsx(found, 2)}
  );
}
`;
    res.json({
      componentName,
      componentId: found.id,
      code,
      metadata: { name: found.name, type: found.type, characters: found.characters || null },
    });
  } catch (err) { next(err); }
});

// GET /api/figma/export?fileKey=...&nodeId=...&format=png|svg
router.get('/export', async (req, res, next) => {
  try {
    const { fileKey, nodeId, format = 'png' } = req.query;
    if (!fileKey || !nodeId) return res.status(400).json({ error: 'fileKey and nodeId are required' });
    const token = getToken();
    if (!token) {
      const err = new Error('FIGMA_API_KEY not set in backend/.env');
      err.status = 503; err.code = 'FIGMA_NO_KEY'; throw err;
    }
    const res2 = await fetch(`${FIGMA_API}/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=${format}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res2.ok) {
      const text = await res2.text().catch(() => '');
      return res.status(res2.status).json({ error: `Figma export failed (${res2.status}): ${text.slice(0, 200)}` });
    }
    const data = await res2.json();
    res.json({ images: data.images || {} });
  } catch (err) { next(err); }
});

module.exports = router;