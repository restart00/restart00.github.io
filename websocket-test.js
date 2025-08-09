class WebSocketTest {
    constructor() {
        this.ws = null;
        this.connectedAt = null;
        this.totalMessages = 0;
        this.sentMessages = 0;
        this.receivedMessages = 0;
        this.uptimeInterval = null;
        this.messageId = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.updateStats();
    }

    initializeElements() {
        // Connection elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.wsUrlInput = document.getElementById('wsUrl');
        this.extensionIdInput = document.getElementById('extensionId');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');

        // Message elements
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.fileInput = document.getElementById('fileInput');
        this.messageList = document.getElementById('messageList');

        // Control buttons
        this.pingBtn = document.getElementById('pingBtn');
        this.broadcastBtn = document.getElementById('broadcastBtn');
        this.clearBtn = document.getElementById('clearBtn');

        // Stats elements
        this.totalMessagesEl = document.getElementById('totalMessages');
        this.sentMessagesEl = document.getElementById('sentMessages');
        this.receivedMessagesEl = document.getElementById('receivedMessages');
        this.uptimeEl = document.getElementById('uptime');
    }

    bindEvents() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.pingBtn.addEventListener('click', () => this.sendPing());
        this.broadcastBtn.addEventListener('click', () => this.sendBroadcast());
        this.clearBtn.addEventListener('click', () => this.clearMessages());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.sendFile(e.target.files[0]);
            }
        });
    }

    updateStatus(status, text) {
        this.statusIndicator.className = `status-indicator status-${status}`;
        this.statusText.textContent = text;
    }

    addMessage(type, content, timestamp = new Date()) {
        const messageItem = document.createElement('div');
        messageItem.className = `message-item ${type}`;
        
        const timeStr = timestamp.toLocaleTimeString();
        const contentStr = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
        
        messageItem.innerHTML = `
            <div class="timestamp">${timeStr}</div>
            <div class="message-content">${this.escapeHtml(contentStr)}</div>
        `;
        
        this.messageList.appendChild(messageItem);
        this.messageList.scrollTop = this.messageList.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStats() {
        this.totalMessagesEl.textContent = this.totalMessages;
        this.sentMessagesEl.textContent = this.sentMessages;
        this.receivedMessagesEl.textContent = this.receivedMessages;
        
        if (this.connectedAt) {
            const uptime = Date.now() - this.connectedAt.getTime();
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            this.uptimeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            this.uptimeEl.textContent = '00:00:00';
        }
    }

    startUptimeCounter() {
        this.uptimeInterval = setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    stopUptimeCounter() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
    }

    connect() {
        const wsUrl = this.wsUrlInput.value.trim();
        const extensionId = this.extensionIdInput.value.trim();

        if (!wsUrl) {
            this.addMessage('error', 'Please enter a WebSocket URL');
            return;
        }

        if (!extensionId) {
            this.addMessage('error', 'Please enter an Extension ID');
            return;
        }

        this.updateStatus('connecting', 'Connecting...');
        this.connectBtn.disabled = true;

        try {
            // Create WebSocket connection with extension ID as query parameter
            const url = new URL(wsUrl);
            url.searchParams.set('extensionId', extensionId);
            
            this.ws = new WebSocket(url.toString());

            this.ws.onopen = () => {
                this.updateStatus('connected', 'Connected');
                this.connectedAt = new Date();
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.messageInput.disabled = false;
                this.sendBtn.disabled = false;
                this.fileInput.disabled = false;
                this.pingBtn.disabled = false;
                this.broadcastBtn.disabled = false;
                
                this.addMessage('system', `Connected to ${wsUrl} as extension: ${extensionId}`);
                this.startUptimeCounter();
            };

            this.ws.onmessage = (event) => {
                this.receivedMessages++;
                this.totalMessages++;
                
                try {
                    const data = JSON.parse(event.data);
                    this.addMessage('received', data);
                } catch (error) {
                    this.addMessage('received', event.data);
                }
                
                this.updateStats();
            };

            this.ws.onclose = (event) => {
                this.updateStatus('disconnected', `Disconnected (${event.code}: ${event.reason || 'No reason'})`);
                this.cleanup();
                this.addMessage('system', `Disconnected: ${event.code} - ${event.reason || 'No reason'}`);
            };

            this.ws.onerror = (error) => {
                this.updateStatus('error', 'Connection Error');
                this.addMessage('error', `WebSocket error: ${error.message || 'Unknown error'}`);
                this.cleanup();
            };

        } catch (error) {
            this.updateStatus('error', 'Connection Failed');
            this.addMessage('error', `Failed to connect: ${error.message}`);
            this.connectBtn.disabled = false;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'User disconnected');
        }
    }

    cleanup() {
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        this.fileInput.disabled = true;
        this.pingBtn.disabled = true;
        this.broadcastBtn.disabled = true;
        
        this.stopUptimeCounter();
        this.ws = null;
        this.connectedAt = null;
    }

    sendMessage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addMessage('error', 'Not connected');
            return;
        }

        const message = this.messageInput.value.trim();
        if (!message) {
            this.addMessage('error', 'Please enter a message');
            return;
        }

        const extensionId = this.extensionIdInput.value.trim();
        const messageData = {
            type: 'text',
            extensionId: extensionId,
            content: message,
            timestamp: new Date().toISOString()
        };

        try {
            this.ws.send(JSON.stringify(messageData));
            this.sentMessages++;
            this.totalMessages++;
            this.addMessage('sent', messageData);
            this.messageInput.value = '';
            this.updateStats();
        } catch (error) {
            this.addMessage('error', `Failed to send message: ${error.message}`);
        }
    }

    sendPing() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addMessage('error', 'Not connected');
            return;
        }

        const extensionId = this.extensionIdInput.value.trim();
        const pingData = {
            type: 'ping',
            extensionId: extensionId,
            timestamp: new Date().toISOString()
        };

        try {
            this.ws.send(JSON.stringify(pingData));
            this.sentMessages++;
            this.totalMessages++;
            this.addMessage('sent', pingData);
            this.updateStats();
        } catch (error) {
            this.addMessage('error', `Failed to send ping: ${error.message}`);
        }
    }

    sendBroadcast() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addMessage('error', 'Not connected');
            return;
        }

        const extensionId = this.extensionIdInput.value.trim();
        const broadcastData = {
            type: 'broadcast',
            extensionId: extensionId,
            content: `Broadcast message from ${extensionId} at ${new Date().toLocaleTimeString()}`,
            timestamp: new Date().toISOString()
        };

        try {
            this.ws.send(JSON.stringify(broadcastData));
            this.sentMessages++;
            this.totalMessages++;
            this.addMessage('sent', broadcastData);
            this.updateStats();
        } catch (error) {
            this.addMessage('error', `Failed to send broadcast: ${error.message}`);
        }
    }

    async sendFile(file) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addMessage('error', 'Not connected');
            return;
        }

        const extensionId = this.extensionIdInput.value.trim();
        
        try {
            const base64Data = await this.fileToBase64(file);
            const fileData = {
                type: 'file',
                extensionId: extensionId,
                fileName: file.name,
                fileData: base64Data,
                mimeType: file.type || 'application/octet-stream',
                timestamp: new Date().toISOString()
            };

            this.ws.send(JSON.stringify(fileData));
            this.sentMessages++;
            this.totalMessages++;
            this.addMessage('sent', `File sent: ${file.name} (${this.formatFileSize(file.size)})`);
            this.updateStats();
            
            // Clear the file input
            this.fileInput.value = '';
        } catch (error) {
            this.addMessage('error', `Failed to send file: ${error.message}`);
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    clearMessages() {
        this.messageList.innerHTML = '';
        this.addMessage('system', 'Message history cleared');
    }
}

// Initialize the WebSocket test when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WebSocketTest();
}); 