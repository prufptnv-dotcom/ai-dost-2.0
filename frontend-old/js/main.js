class AIDost {
    constructor() {
        this.currentSection = 'general';
        this.messages = [];
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.lastRequestData = null;
        
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.loadChatHistory();
        this.checkServiceHealth();
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

    async checkServiceHealth() {
        try {
            const response = await fetch('/api/chat/health/services', { signal: AbortSignal.timeout(5000) });
            const data = await response.json();
            if (data.success) {
                this.updateModelAvailability(data.services);
            }
        } catch (error) {
            console.warn('Could not check service health:', error);
        }
    }

    updateModelAvailability(services) {
        const modelSelect = document.getElementById('aiModel');
        if (!modelSelect) return;
        
        const modelMap = {
            'groq': services.groq?.available,
            'gemini': services.gemini?.available,
            'nvidia': services.nvidia?.available,
            'deepseek': services.deepseek?.available,
            'openrouter': services.openrouter?.available,
            'mistral': services.mistral?.available,
            'together': services.together?.available,
            'huggingface': services.huggingface?.available
        };

        Array.from(modelSelect.options).forEach(option => {
            if (modelMap[option.value] === false) {
                option.disabled = true;
                option.textContent += ' (Unavailable)';
            } else if (modelMap[option.value] === true) {
                option.disabled = false;
                option.textContent = option.textContent.replace(' (Unavailable)', '');
            }
        });
    }

    async sendMessage(retry = false) {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message && !fileHandler.currentFile) return;
        
        // Prevent double submission
        if (this.isLoading && !retry) return;
        
        // Hide welcome screen
        document.getElementById('welcomeScreen').style.display = 'none';
        
        // Store request data for retry
        if (!retry) {
            this.lastRequestData = {
                message,
                model: document.getElementById('aiModel').value,
                section: this.currentSection,
                fileContent: fileHandler.fileContent,
                history: this.messages.slice(-10)
            };
            
            // Add user message to UI
            this.addMessage('user', message);
            
            // Clear input
            input.value = '';
            this.retryCount = 0;
        }
        
        this.isLoading = true;
        this.showTypingIndicator();
        this.updateSendButton(true);
        
        try {
            // Call backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.lastRequestData),
                signal: AbortSignal.timeout(120000) // 2 minute timeout
            });
            
            const data = await response.json();
            
            // Remove loading
            this.hideTypingIndicator();
            
            if (data.success) {
                // Add AI response
                this.addMessage('ai', data.reply);
                
                // Show model used indicator
                this.showModelIndicator(data.model, data.duration);
                
                // Speak response if voice mode is on
                if (voiceHandler.isSpeaking) {
                    voiceHandler.speakText(data.reply);
                }
                
                // Save to storage
                storageManager.saveCurrentChat(this.messages);
                
                // Reset retry count on success
                this.retryCount = 0;
                
            } else {
                // Handle API errors
                await this.handleApiError(data, response.status);
            }
            
        } catch (error) {
            this.hideTypingIndicator();
            await this.handleNetworkError(error);
        } finally {
            this.isLoading = false;
            this.updateSendButton(false);
        }
    }

    async handleApiError(data, status) {
        const errorMessages = {
            400: 'Invalid request. Please check your message.',
            401: 'Authentication failed. Please check your API keys in settings.',
            429: 'Rate limit hit. Trying fallback model...',
            500: 'Server error. Please try again.',
            503: 'Service temporarily unavailable. Retrying...'
        };
        
        const errorMsg = data.message || errorMessages[status] || 'Unknown error occurred';
        
        // Check if it's a retryable error
        const isRetryable = [429, 500, 503].includes(status) || data.code === 'RATE_LIMIT';
        
        if (isRetryable && this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000); // Exponential backoff
            
            this.showRetryIndicator(this.retryCount, this.maxRetries, delay);
            
            await this.sleep(delay);
            return this.sendMessage(true); // Retry
        }
        
        // Show error with retry button
        this.addErrorMessage(errorMsg, true);
    }

    async handleNetworkError(error) {
        let errorMsg = 'Network error. Please check your connection.';
        
        if (error.name === 'AbortError') {
            errorMsg = 'Request timed out. The server took too long to respond.';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMsg = 'Cannot connect to server. Is the backend running?';
        }
        
        // Retry on network errors
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000);
            
            this.showRetryIndicator(this.retryCount, this.maxRetries, delay);
            
            await this.sleep(delay);
            return this.sendMessage(true);
        }
        
        this.addErrorMessage(errorMsg, true);
    }

    showRetryIndicator(attempt, maxAttempts, delay) {
        const messagesContainer = document.getElementById('messages');
        const loadingDiv = document.getElementById('typingIndicator');
        
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="loading-container"></div>
                    <div class="retry-indicator">
                        <span>🔄 Retrying... (Attempt ${attempt}/${maxAttempts})</span>
                        <div class="retry-progress">
                            <div class="retry-bar" style="animation: retryProgress ${delay}ms linear forwards;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    addErrorMessage(message, showRetry = false) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message ai error-message';
        errorDiv.innerHTML = `
            <div class="message-avatar">⚠️</div>
            <div class="message-content">
                <div class="error-text">${this.parseContent(message)}</div>
                ${showRetry ? `
                    <div class="error-actions">
                        <button class="retry-btn" onclick="app.sendMessage(true)">🔄 Try Again</button>
                        <button class="change-model-btn" onclick="app.showModelSelector()">🔧 Change Model</button>
                    </div>
                ` : ''}
            </div>
        `;
        
        const messagesContainer = document.getElementById('messages');
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showModelIndicator(model, duration) {
        // Add small indicator showing which model was used
        const messagesContainer = document.getElementById('messages');
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('message')) {
            const indicator = document.createElement('div');
            indicator.className = 'model-indicator';
            indicator.textContent = `Model: ${model} • ${duration}ms`;
            lastMessage.querySelector('.message-content').appendChild(indicator);
        }
    }

    showModelSelector() {
        const modelSelect = document.getElementById('aiModel');
        if (modelSelect) {
            modelSelect.focus();
            modelSelect.click();
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
        if (!content) return '';
        
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Convert code blocks
        content = content.replace(
            /```(\w+)?\n([\s\S]*?)```/g,
            '<pre><code class="language-$1">$2</code></pre>'
        );
        
        // Convert inline code
        content = content.replace(
            /`([^`]+)`/g,
            '<code>$1</code>'
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
                <div class="loading-container">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
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

    updateSendButton(loading) {
        const sendBtn = document.getElementById('sendBtn');
        const input = document.getElementById('userInput');
        
        if (sendBtn) {
            sendBtn.disabled = loading;
            sendBtn.textContent = loading ? '⏳' : '➤';
        }
        
        if (input) {
            input.disabled = loading;
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard!');
        }).catch(() => {
            this.showToast('Failed to copy');
        });
    }

    showToast(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    loadChatHistory() {
        // Load from storage if available
        if (storageManager && storageManager.loadChatHistory) {
            const history = storageManager.loadChatHistory();
            if (history && history.length > 0) {
                this.messages = history;
                history.forEach(msg => this.addMessageToUI(msg.role, msg.content));
            }
        }
    }
}

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