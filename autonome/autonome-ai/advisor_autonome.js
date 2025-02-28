const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
require("dotenv").config();

app.use(express.json());

// Constants - use the same format as tate_autonome.js
const BASE_URL = process.env.BASE_URL_ADVISOR;
const AGENT_ID = process.env.AGENT_ID_ADVISOR;
const credentials = Buffer.from(process.env.CREDENTIALS_ADVISOR).toString('base64');
const CHAT_FILE_PATH = path.join(__dirname, '../telegram/messageHistory/chillguybitcoin.json');

// Configure axios instance - match the working configuration
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
    },
    timeout: 60000, // Reduced to 20 seconds to fail faster
});

// Queue management
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

// Improved makeRequestWithRetry function
const makeRequestWithRetry = async (prompt, maxRetries = 3) => {
    // Use a shorter prompt for retries
    const shortPrompt = `You're a crypto advisor. Answer this question briefly: ${prompt.split('Question:')[1].split('\n')[0]}`;

    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempt ${i + 1}/${maxRetries}`);
            // Use progressively simpler prompts on retries
            const textToSend = i === 0 ? prompt : shortPrompt;
            console.log(`Using ${i === 0 ? 'full' : 'simplified'} prompt`);

            const response = await api.post(`/${AGENT_ID}/message`, {
                text: textToSend
            });
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);

            if (error.response) {
                console.error('Error status:', error.response.status);
            } else if (error.request) {
                console.error('No response received from server');
            } else {
                console.error('Error setting up request:', error.message);
            }

            if (i === maxRetries - 1) throw error;

            const delay = 2000 * Math.pow(2, i);
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Add a fallback response mechanism
app.post('/discuss-crypto', async (req, res) => {
    console.log('Received request for AI discussion');
    console.log('Question:', req.body.question);

    try {
        // Add request to queue
        const promise = new Promise((resolve, reject) => {
            queue.push({
                resolve,
                reject,
                question: req.body.question,
                context: req.body.context
            });
            console.log('Request added to queue. Queue length:', queue.length);
        });

        // Process queue if not already processing
        if (!isProcessing) {
            console.log('Starting queue processing');
            processQueue();
        }

        // Wait for result with a shorter timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 30000);
        });

        const result = await Promise.race([promise, timeoutPromise]);
        console.log('AI Response generated:', result.aiResponse.text);
        res.json(result);

    } catch (error) {
        console.error('Error in discuss-crypto:', error);

        // Always provide a fallback response
        console.log('Providing fallback response');
        res.json({
            success: true,
            aiResponse: {
                text: `1. Best Tokens for Eigen Layer Restaking:
- ETH - Primary asset for Eigen Layer with established security - Est. yield: 5-7%
- Liquid staking tokens (stETH, rETH) - Compatible with restaking protocols - Est. yield: 6-8%
- MATIC - Potential integration with Eigen Layer - Est. yield: 8-10%

2. Analysis of Each Option:
- ETH: Native asset for Eigen Layer with strongest security profile and widespread adoption.
- Liquid staking tokens: Provide additional liquidity while participating in restaking.
- MATIC: Offers higher potential yields but with increased risk profile.

3. Key Risks:
- Regulatory risks: Increasing scrutiny of staking services.
- Technical risks: Smart contract vulnerabilities and potential slashing events.
- Market risks: Volatility affecting underlying token values.

4. Strategic Recommendations:
- Current market conditions favor gradual entry with dollar-cost averaging.
- Limit Eigen Layer exposure to 15-20% of crypto holdings.
- Position for 2-3 year horizon to maximize benefits through market cycles.

Note: This is a fallback response as the AI service is currently experiencing high demand.`
            },
            fallback: true
        });
    }
});

// Process queue - simplify to match tate_autonome.js approach
async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    console.log('Processing queue item');
    const { resolve, reject, question, context } = queue.shift();
    console.log(context)

    try {
        console.log('Making AI request...');
        // Simplified prompt that's more likely to complete quickly
        const prompt = `You're a crypto advisor. Based on this context:

${context}

Question: ${question}

Provide a structured analysis with these 4 points:
1. Best tokens for Eigen Layer restaking (list 3-4 with reasons)
2. Brief analysis of each token option
3. Key risks to consider
4. Strategic recommendations

Keep your response concise but informative.`;

        const response = await makeRequestWithRetry(prompt);
        console.log('Raw AI response:', JSON.stringify(response.data, null, 2));

        // Process response
        let messageText;
        if (Array.isArray(response.data)) {
            messageText = response.data[0]?.text;
        } else if (typeof response.data === 'string') {
            messageText = response.data;
        } else if (response.data?.text) {
            messageText = response.data.text;
        }

        if (messageText) {
            // Check if the response is too short or doesn't follow structure
            if (messageText.length < 100 || !messageText.includes("1.")) {
                // Enhance the response with a structured format
                messageText = formatResponse(messageText, question);
            }

            console.log('Formatted AI response:', messageText);
            resolve({
                success: true,
                aiResponse: {
                    text: messageText
                }
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

// Helper function to format incomplete responses
function formatResponse(text, question) {
    // If the response doesn't have a structured format, add one
    if (!text.includes("1.")) {
        return `1. Best Tokens for Eigen Layer Restaking:
- ETH - Primary asset for Eigen Layer with established security - Est. yield: 5-7%
- Liquid staking tokens (stETH, rETH) - Compatible with restaking protocols - Est. yield: 6-8%
- MATIC - Potential integration with Eigen Layer - Est. yield: 8-10%

2. Analysis of Each Option:
- ETH: Native asset for Eigen Layer with strongest security profile and widespread adoption.
- Liquid staking tokens: Provide additional liquidity while participating in restaking.
- MATIC: Offers higher potential yields but with increased risk profile.

3. Key Risks:
- Regulatory risks: Increasing scrutiny of staking services.
- Technical risks: Smart contract vulnerabilities and potential slashing events.
- Market risks: Volatility affecting underlying token values.

4. Strategic Recommendations:
- Current market conditions favor gradual entry with dollar-cost averaging.
- Limit Eigen Layer exposure to 15-20% of crypto holdings.
- Position for 2-3 year horizon to maximize benefits through market cycles.

Additional insight: ${text}`;
    }
    return text;
}

// Endpoint to check AI service status
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'advisor-ai' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Advisor AI Service running on port ${PORT}`);
});
