const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize bot with your token
const bot = new Telegraf(process.env.BOT_TOKEN);

// Constants
const CHAT_FILE_PATH = path.join(__dirname, 'messageHistory/chillguybitcoin.json');
const AI_SERVICE_URL = 'http://localhost:3001';

// Read chat history
const readChatHistory = () => {
    try {
        const data = fs.readFileSync(CHAT_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading chat history:', error);
        return null;
    }
};

// Format recent messages for context
const getRecentContext = () => {
    const chatHistory = readChatHistory();
    if (!chatHistory || !chatHistory[0].messages) {
        return 'No chat history available.';
    }

    // Get last 10 messages
    return chatHistory[0].messages
        .slice(0, 10)
        .map(msg => `${msg.sender.username || 'Anonymous'}: ${msg.message}`)
        .join('\n');
};

// Handle /start command
bot.command('start', (ctx) => {
    ctx.reply('Hello! I am your crypto AI assistant. Ask me anything about crypto, and I\'ll provide insights based on the latest group discussions.');
});

// Handle /help command
bot.command('help', (ctx) => {
    ctx.reply(
        'Available commands:\n' +
        '/start - Start the bot\n' +
        '/help - Show this help message\n' +
        'Just send any question, and I\'ll analyze it along with recent chat history!'
    );
});

// Handle text messages
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return; // Ignore other commands

    try {
        // Show typing indicator
        ctx.replyWithChatAction('typing');

        // Get recent context
        const recentContext = getRecentContext();

        // Make request to AI service
        const response = await axios.post(`${AI_SERVICE_URL}/discuss-crypto`, {
            question: ctx.message.text,
            context: recentContext
        });

        if (response.data && response.data.aiResponse && response.data.aiResponse.text) {
            // Send the entire response as one message
            await ctx.reply(response.data.aiResponse.text, {
                parse_mode: 'Markdown',
                reply_to_message_id: ctx.message.message_id
            });
        } else {
            throw new Error('Invalid AI response format');
        }
    } catch (error) {
        console.error('Error processing message:', error);
        ctx.reply('Sorry, I encountered an error while processing your question. Please try again later.');
    }
});

// Handle errors
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('An error occurred. Please try again later.');
});

// Start the bot
bot.launch()
    .then(() => {
        console.log('Bot is running...');
    })
    .catch((err) => {
        console.error('Error starting bot:', err);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
