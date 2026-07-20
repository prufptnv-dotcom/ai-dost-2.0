class StorageManager {
    constructor() {
        this.storageKey = 'aidost_chats';
        this.currentChatId = this.generateChatId();
    }

    // Sab chats save karo
    saveAllChats(chats) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(chats));
        } catch (error) {
            console.error('Storage full:', error);
            // Agar full ho jaye to purane chats delete karo
            this.clearOldChats();
        }
    }

    // Sab chats load karo
    loadAllChats() {
        const chats = localStorage.getItem(this.storageKey);
        return chats ? JSON.parse(chats) : {};
    }

    // Current chat save karo
    saveCurrentChat(messages) {
        const allChats = this.loadAllChats();
        allChats[this.currentChatId] = {
            id: this.currentChatId,
            messages: messages,
            title: this.generateChatTitle(messages),
            timestamp: Date.now(),
            model: document.getElementById('aiModel')?.value || 'auto'
        };
        this.saveAllChats(allChats);
    }

    // Specific chat load karo
    loadChat(chatId) {
        const chats = this.loadAllChats();
        return chats[chatId] || null;
    }

    // Chat title generate karo
    generateChatTitle(messages) {
        if (messages.length === 0) return 'New Chat';
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 30) + '...';
        }
        return 'Chat ' + new Date().toLocaleDateString();
    }

    // Chat ID generate karo
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Purane chats clear karo
    clearOldChats() {
        const chats = this.loadAllChats();
        const chatIds = Object.keys(chats);
        
        // Sort by timestamp and keep last 50 chats
        if (chatIds.length > 50) {
            const sortedChats = chatIds
                .sort((a, b) => chats[b].timestamp - chats[a].timestamp)
                .slice(50);
            
            sortedChats.forEach(id => delete chats[id]);
            this.saveAllChats(chats);
        }
    }

    // Export chat as text file
    exportChat(chatId) {
        const chat = this.loadChat(chatId);
        if (!chat) return;

        let text = `AI-Dost Chat Export\n`;
        text += `Date: ${new Date(chat.timestamp).toLocaleString()}\n`;
        text += `Model: ${chat.model}\n`;
        text += `${'='.repeat(50)}\n\n`;

        chat.messages.forEach(msg => {
            text += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
        });

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-dost-chat-${chatId}.txt`;
        a.click();
    }

    // Delete chat
    deleteChat(chatId) {
        const chats = this.loadAllChats();
        delete chats[chatId];
        this.saveAllChats(chats);
        this.updateChatHistoryUI();
    }

    // UI mein chat history dikhao
    updateChatHistoryUI() {
        const chats = this.loadAllChats();
        const historyContainer = document.getElementById('chatHistory');
        
        if (!historyContainer) return;
        
        historyContainer.innerHTML = '';
        
        // Sort by timestamp (newest first)
        const sortedChats = Object.values(chats)
            .sort((a, b) => b.timestamp - a.timestamp);

        sortedChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatItem.innerHTML = `
                <span>💬 ${chat.title || 'Untitled Chat'}</span>
                <small>${new Date(chat.timestamp).toLocaleDateString()}</small>
                <button class="delete-chat-btn" onclick="storageManager.deleteChat('${chat.id}'); event.stopPropagation();">🗑️</button>
            `;
            chatItem.onclick = () => this.switchToChat(chat.id);
            historyContainer.appendChild(chatItem);
        });
    }

    // Chat switch karo
    switchToChat(chatId) {
        const chat = this.loadChat(chatId);
        if (!chat) return;

        this.currentChatId = chatId;
        
        // Clear current messages
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        // Load messages
        chat.messages.forEach(msg => {
            app.addMessageToUI(msg.role, msg.content); // chatUI ko app se replace kiya
        });
        
        this.updateChatHistoryUI();
    }
}

const storageManager = new StorageManager();

// Functions
function createNewChat() {
    storageManager.currentChatId = storageManager.generateChatId();
    document.getElementById('messages').innerHTML = '';
    document.getElementById('welcomeScreen').style.display = 'flex';
    storageManager.updateChatHistoryUI();
}

function loadChatHistory() {
    storageManager.updateChatHistoryUI();
}

// Auto-save every 5 seconds
setInterval(() => {
    if (typeof app !== 'undefined' && app.messages && app.messages.length > 0) {
        storageManager.saveCurrentChat(app.messages);
    }
}, 5000);
