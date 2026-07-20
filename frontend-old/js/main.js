class AIDost {
    constructor() {
        this.currentSection = 'general';
        this.messages = [];
        this.isLoading = false;
        
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.loadChatHistory();
    }

    setupEventListeners() {
        // Enter key to send
        document.getElementById('userInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message && !fileHandler.currentFile) return;
        
        // Hide welcome screen
        document.getElementById('welcomeScreen').style.display = 'none';
        
        // Add user message to UI
        this.addMessage('user', message);
        
        // Clear input
        input.value = '';
        
        // Get selected model
        const model = document.getElementById('aiModel').value;
        
        // Show loading
        this.showTypingIndicator();
        
        try {
            // Call backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    model: model,
                    section: this.currentSection,
                    fileContent: fileHandler.fileContent,
                    history: this.messages.slice(-10) // Last 10 messages
                })
            });
            
            const data = await response.json();
            
            // Remove loading
            this.hideTypingIndicator();
            
            // Add AI response
            this.addMessage('ai', data.reply);
            
            // Speak response if voice mode is on
            if (voiceHandler.isSpeaking) {
                voiceHandler.speakText(data.reply);
            }
            
            // Save to storage
            storageManager.saveCurrentChat(this.messages);
            
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('ai', 'Sorry, kuch error aaya. Please try again.');
        }
    }

    addMessage(role, content) {
        const messageObj = { role, content, timestamp: Date.now() };
        this.messages.push(messageObj);
        
        this.addMessageToUI(role, content);
    }

    addMessageToUI(role, content) {
        const messagesContainer = document.getElementById('messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Parse content (handle code blocks, etc.)
        messageContent.innerHTML = this.parseContent(content);
        
        // Add action buttons for AI messages
        if (role === 'ai') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = '📋 Copy';
            copyBtn.onclick = () => this.copyToClipboard(content);
            
            const regenerateBtn = document.createElement('button');
            regenerateBtn.className = 'regenerate-btn';
            regenerateBtn.textContent = '🔄 Regenerate';
            regenerateBtn.onclick = () => this.regenerateResponse();
            
            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(regenerateBtn);
            messageDiv.appendChild(actionsDiv);
        }
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    parseContent(content) {
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank">$1</a>'
        );
        
        // Convert code blocks
        content = content.replace(
            /```(\w+)?\n([\s\S]*?)```/g,
            '<pre><code class="language-\$1">\$2</code></pre>'
        );
        
        // Convert line breaks
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai';
        loadingDiv.id = 'typingIndicator';
        loadingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="loading-container"></div>
            </div>
        `;
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const loadingDiv = document.getElementById('typingIndicator');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }

    async regenerateResponse() {
        // Remove last AI message
        this.messages.pop();
        
        // Get last user message
        const lastUserMessage = [...this.messages].reverse().find(m => m.role === 'user');
        
        if (lastUserMessage) {
            document.getElementById('userInput').value = lastUserMessage.content;
            this.sendMessage();
        }
    }
}

// Initialize app
// Initialize app
const app = new AIDost();

// GLOBAL FUNCTIONS: HTML buttons ko JavaScript se jodne ke liye
function sendMessage() {
    app.sendMessage();
}

function startChat(section) {
    app.currentSection = section;
    document.getElementById('welcomeScreen').style.display = 'none';
    
    // Automatically ek prompt set karna user ke click karne par
    const messageBox = document.getElementById('userInput');
    if(section === 'code') messageBox.value = "Main ek beginner hu, mujhe coding me help karo.";
    if(section === 'write') messageBox.value = "Mujhe ek naya blog post likhna hai.";
    if(section === 'image') messageBox.value = "Mujhe ek image generate karni hai, prompt likhne me madad karo.";
    if(section === 'analyze') messageBox.value = "Mere upload kiye gaye document ko analyze karo.";
    
    app.sendMessage();
}

function changeModel() {
    console.log("Model badal gaya: ", document.getElementById('aiModel').value);
}

function toggleWebSearch() {
    alert("Web Search feature abhi development me hai!");
}