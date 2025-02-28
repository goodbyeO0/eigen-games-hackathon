const express = require("express");
const fs = require("fs");
const Groq = require("groq-sdk/index.mjs");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

app.use(express.json());

const groqApiKey = process.env.GROQ_API_KEY;
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const telegramSession = process.env.TELEGRAM_SESSION;
const stringSession =
  new StringSession(telegramSession) || new StringSession("");
const PORT = process.env.PORT || 3000;
let client;

// groq
const groq = new Groq({
  apiKey: groqApiKey,
});
async function askGroq(question) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: question,
      },
    ],
    model: "llama-3.3-70b-versatile",
  });
}

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
    //* can test functions here
    console.log(await beingAddedToNewGroup());
    // await joinPrivateGroupWithLink("https://t.me/+t_HlZBeo6xM4OWZl");
    // await sendMessageToUser("@goodbye000000", "watashi sigman");
    // await joinPublicGroup("https://t.me/pubSigman");
    // await joinNewGroupViaLink("t.me/chillguybitcoin");
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

// Start the server and initialize the client
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  login();
});

// get specific id of group
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

// get all id of group
const getAllGroupId = async () => {
  try {
    // Get and print all dialogs
    const dialogs = await client.getDialogs();
    console.log("Available chats:");
    dialogs.forEach((dialog, index) => {
      console.log(`${index + 1}. Title: ${dialog.title} (ID: ${dialog.id})`);
    });
  } catch (err) {
    console.error("Error:", err);
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
          limit: 1000,
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

    // Process messages with detailed information
    const processedMessages = (
      await Promise.all(
        messages.map(async (msg) => {
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

          // Handle media content
          if (msg.media) {
            try {
              if (msg.media.photo || msg.media.document) {
                const buffer = await client.downloadMedia(msg.media);
                messageData.media = {
                  type: msg.media.className,
                  base64: buffer.toString("base64"),
                };
              }
            } catch (err) {
              console.error(
                `Failed to process media from message ${msg.id}:`,
                err.message
              );
            }
          }

          return messageData;
        })
      )
    ).filter((msg) => msg !== null); // Remove any null messages from the final array

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

const beingAddedToNewGroup = async (telegramUsername) => {
  let status = null;
  try {
    // Listen to ALL updates
    client.addEventHandler(async (update) => {
      if (update.className === "UpdateChannel") {
        const groupName = await getGroupName(update.channelId.value);
        status =
          groupName === "Not a member"
            ? "Left/Kicked from group"
            : "Added to group";

        console.log("New update:", {
          type: update.className,
          status: status,
          groupName: groupName,
          channelId: update.channelId.value,
        });

        const result = await fetchChatHistory(groupName);

        if (result && result.filePath) {
          // Read and parse the JSON file
          const messageHistoryDir = path.join(__dirname, "messageHistory");
          const filePath = path.join(messageHistoryDir, result.filePath);

          try {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const jsonData = JSON.parse(fileContent);

            // Arrays to store different types of messages
            const textMessages = [];
            const mediaMessages = [];

            // Process each message
            jsonData[0].messages.forEach((msg) => {
              if (msg.media) {
                // If message has media, add to mediaMessages
                mediaMessages.push(msg);
              } else if (msg.message !== null) {
                // If message has text but no media, add to textMessages
                textMessages.push(msg);
              }
            });

            // aiQueryText({
            //   question: `based on the following messages that i got from a telegram group chat which is ${
            //     jsonData[0].title
            //   }, can you identify if the group is a scam or not and why it is a scam group, make sure mention back the group name , your answer don't need to be long and make it in point, because i will use your response to forward it to someone from by using telegram and i use automation, so make it like you chat with someone: ${textMessages
            //     .map((data) => data.message)
            //     .join(" ")}`,
            // }).then((response) => {
            //   console.log(response.text);
            //   sendMessageToUser("@goodbye000000", response.text);
            // });

            const response = await askGroq(
              `based on the following messages that i got from a telegram group chat which is ${jsonData[0].title
              }, can you identify if the group is a scam or not and why it is a scam group, make sure mention back the group name , your answer don't need to be long and make it in point, because i will use your response to forward it to someone from by using telegram and i use automation, so make it like you chat with someone: ${textMessages
                .map((data) => data.message)
                .join(" ")}`
            );
            const text = response.choices[0]?.message?.content || "";
            console.log(text);
            sendMessageToUser(telegramUsername || "goodbye000000", text);
            return text || "";
          } catch (error) {
            console.error("Error processing JSON file:", error);
          }
        }
      }
    });
    console.log("Event handler setup complete");
    return status;
  } catch (error) {
    console.error("Error setting up event handlers:", error);
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
const processChatHistory = async (groupName, telegramUsername) => {
  try {
    const result = await fetchChatHistory(groupName);

    if (!result || !result.filePath) {
      throw new Error("Failed to fetch chat history");
    }

    const messageHistoryDir = path.join(__dirname, "messageHistory");
    const filePath = path.join(messageHistoryDir, result.filePath);

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = JSON.parse(fileContent);

    // Debug the messages
    console.log("Raw messages:", jsonData[0].messages);

    // Extract only the text messages and filter out null/empty messages
    const textMessages = jsonData[0].messages
      .filter((msg) => msg.message && msg.message.trim() !== "")
      .map((msg) => msg.message);

    console.log("Filtered text messages:", textMessages);

    if (textMessages.length === 0) {
      console.log("No text messages found!");
      return;
    }

    // Join messages with spaces and add quotes for clarity
    const messageText = textMessages.join(" ");
    console.log("Combined message text:", messageText);

    const response = await askGroq(
      `Based on these actual messages from the telegram group "${jsonData[0].title}": "${messageText}", 
      can you analyze if this group is a scam? Please provide specific examples from the messages to support your analysis. 
      Make your response conversational, as if you're chatting with someone.`
    );

    const text = response.choices[0]?.message?.content || "";
    console.log("AI Response:", text);

    if (text) {
      await sendMessageToUser(telegramUsername || "@goodbye000000", text);
    }

    return text;
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

app.post("/api/joinGroupViaLink", async (req, res) => {
  try {
    const { inviteLink } = req.body;

    if (!inviteLink) {
      return res.status(400).json({
        success: false,
        error: "Invite link is required",
      });
    }

    console.log("Received request to join group:", inviteLink);

    // Call the existing joinNewGroupViaLink function
    const result = await joinNewGroupViaLink(inviteLink);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        groupName: result.groupName,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Failed to join group",
      });
    }
  } catch (error) {
    console.error("Error in joinGroupViaLink endpoint:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

// Add OPTIONS handler for CORS preflight
app.options("/api/joinGroupViaLink", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Max-Age", "86400");
  res.send();
});

app.post("/api/register", async (req, res) => {
  try {
    const { fullName, email, password, telegramUsername } = req.body;

    // Read the existing users file
    const usersFilePath = path.join(__dirname, "frontend/username/users.json");
    let userData = { users: [] };

    try {
      const fileContent = fs.readFileSync(usersFilePath, "utf8");
      userData = JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist or is empty, we'll use the default empty users array
      console.log("No existing users file, creating new one");
    }

    // Check if email already exists
    if (userData.users.some((user) => user.email === email)) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create new user object
    const newUser = {
      fullName,
      email,
      password,
      telegramUsername,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };

    // Add new user to array
    userData.users.push(newUser);

    // Write back to file using writeFileSync
    fs.writeFileSync(usersFilePath, JSON.stringify(userData, null, 2));

    // Return success response (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      message: "Registration successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Add this new endpoint to get users
app.get("/api/users", (req, res) => {
  try {
    const usersFilePath = path.join(__dirname, "frontend/username/users.json");
    const fileContent = fs.readFileSync(usersFilePath, "utf8");
    const userData = JSON.parse(fileContent);
    res.json(userData);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Add this as a separate endpoint and change to POST
app.post("/api/startMonitoring", (req, res) => {
  try {
    const { telegramUsername } = req.body;
    console.log("Received telegram username:", telegramUsername);

    if (!telegramUsername) {
      return res.status(400).json({
        error: "Telegram username is required",
      });
    }

    beingAddedToNewGroup(telegramUsername);
    res.json({
      success: true,
      message: "Monitoring started",
      username: telegramUsername,
    });
  } catch (error) {
    console.error("Error starting monitoring:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start monitoring",
    });
  }
});
