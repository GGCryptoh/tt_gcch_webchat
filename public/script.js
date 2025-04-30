document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    // Track conversation history
    let conversationHistory = [];
    let isWaitingForResponse = false;
    
    // Track user input history for up arrow recall
    let messageHistory = [];
    let messageHistoryIndex = -1;
    let currentInputValue = '';
    
    // Configure marked for safe rendering
    marked.setOptions({
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // Convert line breaks to <br>
        sanitize: false // We'll use DOMPurify for sanitization
    });
    
    // Function to safely render markdown
    function renderMarkdown(text) {
        // Convert markdown to HTML
        const rawHtml = marked.parse(text);
        // Sanitize HTML to prevent XSS
        return DOMPurify.sanitize(rawHtml);
    }
    
    // Function to handle sending messages
    async function sendMessage() {
        const userMessage = messageInput.value.trim();
        if (!userMessage || isWaitingForResponse) return;
        
        // Add message to history for up-arrow recall
        messageHistory.unshift(userMessage);
        messageHistoryIndex = -1;
        currentInputValue = '';
        
        // Clear input
        messageInput.value = '';
        
        // Add user message to UI
        addMessageToUI('user', userMessage);
        
        // Track the message in history
        conversationHistory.push({ role: 'user', content: userMessage });
        
        // Add loading indicator
        const loadingIndicator = addLoadingIndicator();
        
        // Disable input during response
        isWaitingForResponse = true;
        toggleInputState();
        
        try {
            // Call API with streaming response
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    conversationHistory: conversationHistory.slice(0, -1) // Don't send the most recent user message again
                })
            });
            
            // Create a container for the AI response
            const aiMessageElement = createMessageElement('ai', '');
            messagesContainer.appendChild(aiMessageElement);
            const aiMessageText = aiMessageElement.querySelector('.message-text');
            
            // Remove loading indicator
            loadingIndicator.remove();
            
            // Process the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        
                        if (data === '[DONE]') {
                            // End of stream
                            continue;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.delta) {
                                aiResponseText += parsed.delta;
                                // Render markdown for AI responses with sanitization
                                aiMessageText.innerHTML = renderMarkdown(aiResponseText);
                                // Scroll to bottom
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }
            
            // Add the complete AI response to conversation history
            conversationHistory.push({ role: 'assistant', content: aiResponseText });
            
        } catch (error) {
            console.error('Error sending message:', error);
            // Show error in UI
            const errorMessage = 'Sorry, there was an error communicating with the AI Foundry service. Please try again.';
            addMessageToUI('system', errorMessage);
        } finally {
            // Re-enable input
            isWaitingForResponse = false;
            toggleInputState();
            // Focus on input
            messageInput.focus();
        }
    }
    
    // Function to add a message to the UI
    function addMessageToUI(role, text) {
        const messageElement = createMessageElement(role, text);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Function to create a message element
    function createMessageElement(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${role}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        // Set avatar text based on role
        if (role === 'user') {
            avatarDiv.textContent = 'User';
        } else if (role === 'ai') {
            avatarDiv.textContent = 'AI';
        } else {
            avatarDiv.textContent = 'Sys';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        
        // Apply markdown parsing for AI messages
        if (role === 'ai' && text) {
            textDiv.innerHTML = renderMarkdown(text);
        } else {
            textDiv.textContent = text;
        }
        
        contentDiv.appendChild(textDiv);
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        return messageDiv;
    }
    
    // Function to add loading indicator
    function addLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message message-ai';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = 'AI';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'loading-dot';
            loadingIndicator.appendChild(dot);
        }
        
        contentDiv.appendChild(loadingIndicator);
        loadingDiv.appendChild(avatarDiv);
        loadingDiv.appendChild(contentDiv);
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return loadingDiv;
    }
    
    // Toggle input state (enabled/disabled)
    function toggleInputState() {
        messageInput.disabled = isWaitingForResponse;
        sendButton.disabled = isWaitingForResponse;
    }
    
    // Handle send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Handle keyboard events for message input
    messageInput.addEventListener('keydown', (e) => {
        // Send message on Enter (but allow shift+enter for newline)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        
        // Handle Up arrow to recall previous messages
        if (e.key === 'ArrowUp') {
            // If the cursor is at the beginning of the first line
            if (messageInput.selectionStart === 0 || messageInput.value === '') {
                e.preventDefault();
                
                // If this is the first time pressing up, store current input value
                if (messageHistoryIndex === -1) {
                    currentInputValue = messageInput.value;
                }
                
                // Navigate message history if available
                if (messageHistoryIndex < messageHistory.length - 1) {
                    messageHistoryIndex++;
                    messageInput.value = messageHistory[messageHistoryIndex];
                    
                    // Place cursor at end of text
                    setTimeout(() => {
                        messageInput.selectionStart = messageInput.value.length;
                        messageInput.selectionEnd = messageInput.value.length;
                        
                        // Trigger input event to resize textarea
                        const inputEvent = new Event('input');
                        messageInput.dispatchEvent(inputEvent);
                    }, 0);
                }
            }
        }
        
        // Handle Down arrow to recall more recent messages
        if (e.key === 'ArrowDown' && messageHistoryIndex >= 0) {
            e.preventDefault();
            
            messageHistoryIndex--;
            if (messageHistoryIndex === -1) {
                // Restore the current input that was being typed
                messageInput.value = currentInputValue;
            } else {
                messageInput.value = messageHistory[messageHistoryIndex];
            }
            
            // Place cursor at end of text
            setTimeout(() => {
                messageInput.selectionStart = messageInput.value.length;
                messageInput.selectionEnd = messageInput.value.length;
                
                // Trigger input event to resize textarea
                const inputEvent = new Event('input');
                messageInput.dispatchEvent(inputEvent);
            }, 0);
        }
    });
    
    // Auto-resize textarea as user types
    messageInput.addEventListener('input', () => {
        // Reset height to auto to shrink if needed
        messageInput.style.height = 'auto';
        // Set to scrollHeight to expand
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    });
    
    // Focus input on page load
    messageInput.focus();
}); 