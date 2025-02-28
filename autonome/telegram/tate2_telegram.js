const express = require("express");
const fs = require("fs");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();
const path = require("path");
const cors = require("cors");
const axios = require('axios');

const app = express();
app.use(cors());

app.use(express.json());

const apiId = Number(process.env.API_ID_2);
console.log(apiId)
const apiHash = process.env.API_HASH_2;
console.log(apiHash)
const telegramSession = process.env.TELEGRAM_SESSION_2;
const stringSession = new StringSession(telegramSession) || new StringSession("");
let client;
let isMyTurn = false; // Start with false since tate1 goes first

// login to telegram
async function login() {
    try {
        // Initialize client
        if (telegramSession) {
            client = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 10,
            });
            await client.connect();
            console.log("Connected with existing session");
        } else {
            client = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 5,
            });
            await client.start({
                phoneNumber: async () => await input.text("Please enter your number: "),
                password: async () => await input.text("Please enter your password: "),
                phoneCode: async () =>
                    await input.text("Please enter the code you received: "),
                onError: (err) => console.log(err),
            });
            console.log("You should now be connected.");
            console.log(client.session.save());
        }

        // Test connection
        await client.sendMessage("me", { message: "Hello!" });
        console.log("Test message sent successfully");
        console.log("Setup complete");
        await processChatHistory("chillguybitcoin", "@goodbye000000")
        await startAIChatRotation("chillguybitcoin");
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

const getGroupId = async (GroupUsername) => {
    try {
        // First try to get entity directly
        try {
            const entity = await client.getEntity(GroupUsername);
            console.log("Found entity directly:", entity);
            return entity.id;
        } catch (error) {
            console.log("Failed to get entity directly, trying dialogs...");
        }

        // If direct entity lookup fails, try dialogs
        const dialogs = await client.getDialogs();
        console.log("Searching dialogs for:", GroupUsername);

        // Try to match by title or username
        const group = dialogs.find(
            (dialog) =>
                dialog.title === GroupUsername ||
                (dialog.entity && dialog.entity.username === GroupUsername)
        );

        if (group) {
            console.log("Found group in dialogs:", group);
            return group.id;
        }

        // If still not found, try to resolve the username
        try {
            const resolved = await client.invoke(
                new Api.contacts.ResolveUsername({
                    username: GroupUsername.replace("@", ""),
                })
            );
            console.log("Resolved username:", resolved);
            return resolved.chats[0].id;
        } catch (error) {
            console.log("Failed to resolve username:", error);
        }

        return null;
    } catch (error) {
        console.error("Failed to fetch dialogs:", error);
        throw error;
    }
};

const processMessage = async (msg, client) => {
    try {
        // Get sender information
        const sender = msg.fromId
            ? await client.getEntity(msg.fromId).catch(() => null)
            : null;

        // Get the message content from various possible sources
        const messageContent = msg.message || msg.text || msg.caption || null;

        // Skip this message if there's no content
        if (!messageContent) {
            console.log("Skipping message with no content, ID:", msg.id);
            return null;
        }

        const messageData = {
            id: msg.id,
            date: new Date(msg.date * 1000).toLocaleString("en-US", {
                timeZone: "Asia/Kuala_Lumpur",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
            }),
            message: messageContent,
            sender: sender
                ? {
                    id: sender.id.toString(),
                    username: sender.username || null,
                    firstName: sender.firstName || null,
                    lastName: sender.lastName || null,
                    phone: sender.phone || null,
                }
                : null,
        };

        // Add a flag to indicate if message contains media without downloading it
        if (msg.media) {
            messageData.hasMedia = true;
            messageData.mediaType = msg.media.className;
        }

        return messageData;
    } catch (error) {
        console.error("Error processing message:", error);
        return null;
    }
};

// fetch chat history and store it in another JSON file
const fetchChatHistory = async (GroupUsername) => {
    try {
        // Increase delay to allow Telegram to update dialogs
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const chatHistories = [];
        let groupId;

        // Remove @ if present in GroupUsername
        GroupUsername = GroupUsername.replace("@", "");

        // Try multiple methods to get the group ID
        try {
            groupId = await getGroupId(GroupUsername);
            console.log("Got group ID:", groupId);
        } catch (error) {
            console.error("Error getting group ID:", error);
            throw new Error(`Unable to access group "${GroupUsername}"`);
        }

        if (!groupId) {
            throw new Error(`Unable to find group "${GroupUsername}"`);
        }

        // Try to get messages using different methods
        let messages;
        try {
            // First try with GetHistory
            const result = await client.invoke(
                new Api.messages.GetHistory({
                    peer: groupId,
                    limit: 1000, // get only 30 messages
                    offsetId: 0,
                    offsetDate: 0,
                    addOffset: 0,
                    maxId: 0,
                    minId: 0,
                    hash: 0,
                })
            );
            messages = result.messages;
        } catch (error) {
            console.log("GetHistory failed, trying alternative method...");
            try {
                // Alternative method using searchGlobal
                const result = await client.invoke(
                    new Api.messages.SearchGlobal({
                        q: "",
                        filter: new Api.InputMessagesFilterEmpty(),
                        minDate: 0,
                        maxDate: 0,
                        offsetRate: 0,
                        offsetPeer: groupId,
                        offsetId: 0,
                        limit: 100,
                    })
                );
                messages = result.messages;
            } catch (error) {
                console.error("All methods to fetch messages failed:", error);
                throw new Error("Could not fetch messages");
            }
        }

        const processedMessages = (
            await Promise.all(messages.map(msg => processMessage(msg, client)))
        ).filter(msg => msg !== null);

        chatHistories.push({
            chatId: groupId,
            title: GroupUsername,
            messages: processedMessages,
        });

        // Create messageHistory directory if it doesn't exist
        const messageHistoryDir = path.join(__dirname, "messageHistory");
        if (!fs.existsSync(messageHistoryDir)) {
            fs.mkdirSync(messageHistoryDir);
        }

        // Create filename with group name and current date/time in Malaysia timezone
        const now = new Date()
            .toLocaleString("en-US", {
                timeZone: "Asia/Kuala_Lumpur",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })
            .replace(/[/:,\s]/g, "_");

        const filename = `${GroupUsername}_${now}.json`;
        const filePath = path.join(messageHistoryDir, filename);

        // Write to file
        fs.writeFileSync(filePath, JSON.stringify(chatHistories, null, 2), "utf-8");

        console.log(`Chat history saved to ${filePath}`);
        return { filePath: `${GroupUsername}_${now}.json` };
    } catch (error) {
        console.error("Failed to fetch chat histories:", error);
        throw error;
    }
};

// get group name from id
const getGroupName = async (groupId) => {
    try {
        // Get the chat/channel information
        const entity = await client.getEntity(groupId);

        // The title property contains the group/channel name
        if (entity.title) {
            console.log(`Group Name: ${entity.title}`);
            return entity.title;
        } else {
            return "Unknown Group";
        }
    } catch (error) {
        if (error.errorMessage === "CHANNEL_PRIVATE") {
            return "Not a member";
        } else {
            return "Error getting group name";
        }
    }
};

const joinNewGroupViaLink = async (inviteLink, telegramUsername) => {
    try {
        // Step 1: Identify link type and join group
        let groupName;

        if (inviteLink.includes("/+")) {
            // Private group link
            const joinResult = await joinPrivateGroupWithLink(inviteLink);

            if (!joinResult.success) {
                throw new Error(`Failed to join/access group: ${joinResult.error}`);
            }

            // Add a small delay to allow Telegram to process the join
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get group name using channel ID
            if (!joinResult.channelId) {
                throw new Error("No channel ID received");
            }

            groupName = await getGroupName(joinResult.channelId);
            if (
                groupName === "Error getting group name" ||
                groupName === "Not a member"
            ) {
                throw new Error(`Failed to get valid group name: ${groupName}`);
            }
        } else {
            // Public group link
            groupName = inviteLink.split("t.me/")[1];
            const joinResult = await joinPublicGroup(inviteLink);

            if (!joinResult.success) {
                throw new Error(`Failed to join public group: ${joinResult.error}`);
            }
        }

        // Process chat history and analyze
        await processChatHistory(groupName, telegramUsername);

        return {
            success: true,
            message: "Successfully processed group messages",
            groupName: groupName,
        };
    } catch (error) {
        console.error("Error in joinNewGroupViaLink:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

// Helper function to process chat history and send analysis
// Helper function to process chat history and send analysis
const processChatHistory = async (groupName, telegramUsername) => {
    try {
        const result = await fetchChatHistory(groupName);

        if (!result || !result.filePath) {
            throw new Error("Failed to fetch chat history");
        }

        // Create messageHistory directory if it doesn't exist
        const messageHistoryDir = path.join(__dirname, "messageHistory");
        if (!fs.existsSync(messageHistoryDir)) {
            fs.mkdirSync(messageHistoryDir);
        }

        // Create group-specific filename (without timestamp)
        const groupFileName = `${groupName}.json`;
        const groupFilePath = path.join(messageHistoryDir, groupFileName);

        // Read the new data from the temporary file
        const tempFilePath = path.join(messageHistoryDir, result.filePath);
        const newContent = fs.readFileSync(tempFilePath, "utf-8");
        const newData = JSON.parse(newContent);

        let finalData;

        if (fs.existsSync(groupFilePath)) {
            // If file exists, read and merge with existing data
            try {
                const existingContent = fs.readFileSync(groupFilePath, "utf-8");
                const existingData = JSON.parse(existingContent);

                // Create a map of existing message IDs for quick lookup
                const existingMessageIds = new Set(
                    existingData[0].messages.map(msg => msg.id)
                );

                // Filter out duplicate messages and combine with existing messages
                const uniqueNewMessages = newData[0].messages.filter(
                    msg => !existingMessageIds.has(msg.id)
                );

                // Combine messages and sort by ID in descending order (newest first)
                finalData = [{
                    chatId: existingData[0].chatId,
                    title: existingData[0].title,
                    messages: [...uniqueNewMessages, ...existingData[0].messages]
                        .sort((a, b) => b.id - a.id)
                }];

            } catch (error) {
                console.error("Error processing existing file:", error);
                finalData = newData; // Use new data if there's an error with existing file
            }
        } else {
            // If file doesn't exist, use new data
            finalData = newData;
        }

        // Write the merged data to the group-specific file
        fs.writeFileSync(groupFilePath, JSON.stringify(finalData, null, 2), "utf-8");

        // Clean up the temporary file
        try {
            fs.unlinkSync(tempFilePath);
        } catch (error) {
            console.error("Error deleting temporary file:", error);
        }

        console.log(`Chat history updated in ${groupFileName}`);

        // Send notification to user
        await sendMessageToUser(
            telegramUsername || "@goodbye000000",
            `Successfully updated chat history for ${groupName} with ${finalData[0].messages.length} messages`
        );

        return;
    } catch (error) {
        console.error("Error in processChatHistory:", error);
        throw error;
    }
};

const sendMessageToUser = async (username, message) => {
    try {
        // Make sure username starts with @
        const formattedUsername = username.startsWith("@")
            ? username
            : `@${username}`;

        // Get the entity (user) from username
        const entity = await client.getEntity(formattedUsername);

        if (!entity) {
            throw new Error(`User ${formattedUsername} not found`);
        }

        // Send the message
        const result = await client.sendMessage(entity, {
            message: message,
        });

        console.log(`Message sent successfully to ${formattedUsername}`);
        return {
            success: true,
            messageId: result.id,
            timestamp: new Date().toLocaleString("en-US", {
                timeZone: "Asia/Kuala_Lumpur",
            }),
        };
    } catch (error) {
        console.error(`Failed to send message to ${username}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
};

async function aiQueryText(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/722a1f44-d0d1-42ad-b2c6-01f73fa44fb3",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        }
    );
    const result = await response.json();
    return result;
}

const joinPrivateGroupWithLink = async (inviteLink) => {
    try {
        const hash = inviteLink.split("+").pop();
        let channelId;

        try {
            // First attempt to join
            const result = await client.invoke(
                new Api.messages.ImportChatInvite({
                    hash: hash,
                })
            );
            channelId = result?.chats?.[0]?.id;
        } catch (error) {
            if (error.errorMessage === "USER_ALREADY_PARTICIPANT") {
                // If already a participant, get chat info
                const checkResult = await client.invoke(
                    new Api.messages.CheckChatInvite({
                        hash: hash,
                    })
                );

                // Extract channel ID from the chat info
                channelId = checkResult?.chat?.id;
            } else {
                throw error;
            }
        }

        if (!channelId) {
            throw new Error("Could not get channel ID");
        }

        console.log("Successfully accessed the group, channel ID:", channelId);
        return {
            success: true,
            message: "Successfully accessed the group",
            channelId: channelId,
        };
    } catch (error) {
        console.error("Failed to join/access group:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

const joinPublicGroup = async (groupLink) => {
    try {
        // Extract username from the t.me link
        const username = groupLink.split("t.me/")[1];

        // Join the channel/group using the username
        await client.invoke(
            new Api.channels.JoinChannel({
                channel: username,
            })
        );

        console.log(`Successfully joined public group: ${username}`);
        return {
            success: true,
            message: `Successfully joined public group: ${username}`,
        };
    } catch (error) {
        console.error("Failed to join public group:", error);
        return {
            success: false,
            error: error.message,
            details: error,
        };
    }
};

async function sendMessageToGroup(groupUsername, message) {
    try {
        // Remove any 't.me/' prefix and '@' symbol if present
        groupUsername = groupUsername.replace('t.me/', '').replace('@', '');

        // Get the entity for the group
        const entity = await client.getEntity(groupUsername);

        if (!entity) {
            throw new Error(`Group ${groupUsername} not found`);
        }

        // Send the message
        const result = await client.sendMessage(entity, {
            message: message
        });

        console.log(`Message sent successfully to ${groupUsername}`);
        return {
            success: true,
            messageId: result.id,
            timestamp: new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Kuala_Lumpur'
            })
        };
    } catch (error) {
        console.error(`Failed to send message to ${groupUsername}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Test function
async function testGroupMessage() {
    try {
        const result = await sendMessageToGroup(
            'chillguybitcoin',
            'Hello, this is a test message!'
        );
        console.log('Send message result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

async function startAIChatRotation(groupName) {
    try {
        manageTurns();
        let lastResponse = '';

        while (true) {
            try {
                if (isMyTurn) {
                    const botName = "@goodbye000000";  // Make sure this is @sigmaniac3 in tate1_telegram.js
                    console.log(`${botName}'s turn starting...`);
                    console.log("Requesting AI response...");

                    const response = await axios.post('http://localhost:3000/discuss-crypto');
                    console.log("Received AI response:", response.data);

                    if (!response.data?.aiResponse?.text) {
                        console.error("Invalid response format:", response.data);
                        continue;
                    }

                    const aiText = response.data.aiResponse.text;
                    console.log("Extracted AI text:", aiText);

                    if (aiText === lastResponse) {
                        console.log("Skipping duplicate response");
                        continue;
                    }
                    lastResponse = aiText;

                    // Split messages by full stops (periods) and clean up
                    const messages = aiText
                        .split('.')
                        .map(msg => msg.trim())
                        .filter(msg => msg.length > 0);

                    console.log("Separated messages:", messages);

                    // Important: Save current turn state
                    const currentTurn = isMyTurn;

                    // Send all messages regardless of turn changes
                    for (const message of messages) {
                        const fullMessage = message + '.';
                        console.log(`${botName} sending message:`, fullMessage);

                        try {
                            // Only send if this was our turn when we started
                            if (currentTurn) {
                                await sendMessageToGroup(groupName, fullMessage);
                                // Shorter delay between messages
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (sendError) {
                            console.error('Error sending message:', sendError);
                        }
                    }

                    // Update chat history after all messages are sent
                    if (currentTurn) {
                        try {
                            await processChatHistory(groupName, botName);
                        } catch (historyError) {
                            console.error('Error updating chat history:', historyError);
                        }
                    }

                    // Wait a bit before next iteration to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // Shorter wait between checks
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Error in AI chat rotation:', error.message);
                if (error.response) {
                    console.error('Response error data:', error.response.data);
                }
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    } catch (error) {
        console.error('Fatal error in AI chat rotation:', error);
    }
}

// Update manageTurns to use clearInterval when needed
let turnInterval;

function manageTurns() {
    if (turnInterval) {
        clearInterval(turnInterval);
    }

    turnInterval = setInterval(() => {
        isMyTurn = !isMyTurn;
        console.log(`Turn status for @goodbye000000: ${isMyTurn}`);
    }, 5000);

    // Clean up on process exit
    process.on('SIGINT', () => {
        if (turnInterval) {
            clearInterval(turnInterval);
        }
        process.exit();
    });
}

login()