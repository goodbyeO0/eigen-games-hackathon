const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
require("dotenv").config();

app.use(express.json());

// Constants
const BASE_URL = process.env.BASE_URL_TATE;
const AGENT_ID = process.env.AGENT_ID_TATE; // Your agent ID
const credentials = Buffer.from(process.env.CREDENTIALS_TATE).toString('base64');
const CHAT_FILE_PATH = path.join(__dirname, '../telegram/messageHistory/chillguybitcoin.json');

// Configure axios instance with timeout and retry config
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
    },
    timeout: 30000, // 30 second timeout
});

// Add queue management for better handling of concurrent requests
const queue = [];
let isProcessing = false;

// Function to read chat history
const readChatHistory = () => {
    try {
        const data = fs.readFileSync(CHAT_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading chat history:', error);
        return null;
    }
};

// Function to append new message to chat history
const appendMessage = (aiResponse) => {
    try {
        const chatHistory = readChatHistory();
        if (!chatHistory || !chatHistory[0].messages) return false;

        const newMessage = {
            id: chatHistory[0].messages.length + 139, // Starting from last ID + 1
            date: new Date().toLocaleString(),
            message: aiResponse,
            sender: {
                id: "AI_ASSISTANT",
                username: "ai_assistant",
                firstName: "AI",
                lastName: "Assistant"
            }
        };

        chatHistory[0].messages.unshift(newMessage); // Add to beginning of array
        fs.writeFileSync(CHAT_FILE_PATH, JSON.stringify(chatHistory, null, 2));
        return true;
    } catch (error) {
        console.error('Error appending message:', error);
        return false;
    }
};

// Add retry logic
const makeRequestWithRetry = async (prompt, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await api.post(`/${AGENT_ID}/message`, {
                text: prompt
            });
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error; // If last retry, throw error
            console.log(`Attempt ${i + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        }
    }
};

// Update the discuss-crypto endpoint to use queue
app.post('/discuss-crypto', async (req, res) => {
    console.log('Received request for AI discussion');
    try {
        // Add request to queue
        const promise = new Promise((resolve, reject) => {
            queue.push({ resolve, reject });
            console.log('Request added to queue. Queue length:', queue.length);
        });

        // Process queue if not already processing
        if (!isProcessing) {
            console.log('Starting queue processing');
            processQueue();
        }

        // Wait for result
        const result = await promise;
        console.log('AI Response generated:', result.aiResponse.text);
        res.json(result);

    } catch (error) {
        console.error('Error in discuss-crypto:', error);
        res.status(500).json({
            error: 'Failed to process discussion',
            details: error.message
        });
    }
});

async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    console.log('Processing queue item');
    const { resolve, reject } = queue.shift();

    try {
        const chatHistory = readChatHistory();
        if (!chatHistory) {
            throw new Error('Could not read chat history');
        }

        console.log('Successfully read chat history');
        const recentMessages = chatHistory[0].messages
            .slice(0, 10)
            .map(msg => msg.message)
            .join('\n\n');

        console.log('Making AI request...');
        console.log(recentMessages)
        const prompt = `You're a crypto enthusiast in a Telegram group. Based on these recent messages:

${recentMessages}

Share your thoughts about crypto opportunities, but keep it natural and casual. provide slang like ngmi/gmgm/lfg or many more. Make sure you cant repeat what the messages say. just give your opinion. Break your response into 1-2 short sentences, each ending with a period. Make it sound conversational and use some crypto slang, but don't overdo it. Focus on:
- Potential gains
- Staking opportunities
- Market trends
- Risk factors

Remember to keep each sentence short and natural, like real Telegram messages.`;

        const response = await makeRequestWithRetry(prompt);
        console.log('Raw AI response:', JSON.stringify(response.data, null, 2));

        // Ensure we're working with a string response
        let messageText;
        if (Array.isArray(response.data)) {
            messageText = response.data[0]?.text;
        } else if (typeof response.data === 'string') {
            messageText = response.data;
        } else if (response.data?.text) {
            messageText = response.data.text;
        }

        if (messageText) {
            console.log('Formatted AI response:', messageText);

            const appendSuccess = appendMessage(messageText);
            if (!appendSuccess) {
                throw new Error('Failed to append message to chat history');
            }
            console.log('Successfully appended message to chat history');

            resolve({
                success: true,
                aiResponse: {
                    text: messageText  // Changed format to match what Telegram bots expect
                },
                message: 'AI response added to chat history'
            });
        } else {
            throw new Error('Invalid AI response format');
        }

    } catch (error) {
        console.error('Error in processQueue:', error);
        reject(error);
    } finally {
        isProcessing = false;
        if (queue.length > 0) {
            console.log('Processing next item in queue');
            setTimeout(processQueue, 1000);
        }
    }
}

// Endpoint to get chat history
app.get('/chat-history', (req, res) => {
    try {
        const chatHistory = readChatHistory();
        res.json(chatHistory);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get chat history',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});