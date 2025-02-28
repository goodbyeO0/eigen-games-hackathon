node getChat.js# @telegram

A powerful Telegram integration system for crypto communities, featuring AI-powered bots and automated chat participation.

## Overview

@telegram is a backend service that provides Telegram integration for crypto communities. It consists of three main components:

1. **Telegram Bot** (`bot.js`) - A standard Telegram bot that responds to user queries with AI-powered crypto advice.

2. **Tate Telegram Clients** (`tate1_telegram.js` & `tate2_telegram.js`) - Two automated Telegram clients that join crypto groups, monitor conversations, and participate with AI-generated messages in a coordinated manner.

3. **Message History Management** - A system for storing, retrieving, and analyzing Telegram chat history to provide context for AI responses.

4. **Data Verification with Othentic** - A verification layer that ensures all data is validated and authenticated before being processed by the AI services.

## Features

- **AI-Powered Responses**: Integrates with the @autonome AI services to generate contextually relevant crypto discussions
- **Multi-Account Coordination**: Uses two separate Telegram accounts that take turns posting to appear more natural
- **Group Management**: Automatically joins public and private Telegram groups via invite links
- **Chat History**: Stores and processes message history for context-aware AI responses
- **Express API**: Provides endpoints for controlling the Telegram clients and retrieving chat data
- **Data Verification**: Uses Othentic to verify and authenticate all data before AI processing

## Technical Architecture

The system consists of three main services:

### Telegram Bot (`bot.js`)

- Standard Telegraf-based bot that responds to user commands and messages
- Integrates with the Advisor Autonome AI service for structured crypto advice
- Provides `/start` and `/help` commands for user interaction
- Handles error cases gracefully with appropriate user feedback

### Tate Telegram Client 1 (`tate1_telegram.js`)

- Uses the Telegram client library to authenticate with a real Telegram account
- Monitors specified crypto groups and stores message history
- Participates in conversations with AI-generated messages from Tate Autonome
- Coordinates with Tate Client 2 to alternate messages for natural conversation flow

### Tate Telegram Client 2 (`tate2_telegram.js`)

- Similar functionality to Client 1 but with a separate Telegram account
- Alternates posting with Client 1 to create a more natural conversation pattern
- Shares message history storage with Client 1 for consistent context

### Othentic Data Verification

- Verifies the authenticity and integrity of all incoming data
- Validates message sources and content before processing
- Filters out spam, scams, and potentially harmful content
- Ensures only verified data is passed to the AI services for processing
- Provides an additional layer of security and reliability

## API Endpoints

### Telegram Bot
- Responds to Telegram commands and messages directly through the Telegram API

### Tate Telegram Clients
- `GET /chat-history/:groupName`: Retrieves chat history for a specific group
- `POST /join-group`: Joins a new Telegram group via invite link
- `POST /send-message`: Sends a message to a specified Telegram group
- `POST /start-ai-chat`: Starts the AI chat rotation in a specified group

## Setup and Configuration

1. Install dependencies:
   ```
   npm install express telegram telegraf axios dotenv cors input othentic
   ```

2. Configure environment variables in `.env`:
   ```
   # Telegram API credentials for first account
   API_ID_1=your_api_id_1
   API_HASH_1=your_api_hash_1
   TELEGRAM_SESSION_1=your_session_string_1
   
   # Telegram API credentials for second account
   API_ID_2=your_api_id_2
   API_HASH_2=your_api_hash_2
   TELEGRAM_SESSION_2=your_session_string_2
   
   # Telegram Bot Token
   BOT_TOKEN=your_bot_token
   
   # Othentic API credentials
   OTHENTIC_API_KEY=your_othentic_api_key
   OTHENTIC_ENDPOINT=https://api.othentic.io/verify
   ```

3. Obtain Telegram API credentials:
   - Visit https://my.telegram.org/apps to create a Telegram application
   - Note your API ID and API Hash
   - For session strings, run the clients once without a session string and save the output

4. Obtain Othentic API credentials:
   - Register for an Othentic account at https://othentic.io
   - Generate an API key from your dashboard
   - Configure verification settings for your specific use case

5. Start the services:
   ```
   # Start the standard Telegram bot
   node bot.js
   
   # Start the Tate Telegram clients
   node tate1_telegram.js
   node tate2_telegram.js
   ```

## Usage Examples

### Using the Telegram Bot

1. Start a chat with your bot on Telegram
2. Send `/start` to initialize the bot
3. Ask any crypto-related question
4. The bot will verify your data with Othentic and respond with AI-generated advice

### Joining a New Telegram Group

```javascript
// Example request to join a new group
fetch('http://localhost:3000/join-group', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inviteLink: 'https://t.me/+abcdefghijklmn',
    telegramUsername: 'your_group_username'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Starting AI Chat Rotation

```javascript
// Example request to start AI chat rotation in a group
fetch('http://localhost:3000/start-ai-chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    groupName: 'chillguybitcoin'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Message History Structure

Chat history is stored in JSON files in the `messageHistory` directory. Each file is named after the group (e.g., `chillguybitcoin.json`) and contains:

- Group information (name, ID)
- Array of messages with:
  - Message ID
  - Timestamp
  - Message content
  - Sender information (ID, username, first/last name)
  - Verification status from Othentic

## Data Verification Process using Othentic

The Othentic verification process includes:

1. **Source Authentication**: Verifies the identity of message senders
2. **Content Validation**: Checks message content for spam, scams, or harmful material
3. **Integrity Verification**: Ensures messages haven't been tampered with
4. **Reputation Scoring**: Assigns trust scores to message sources
5. **Filtering**: Removes or flags suspicious content before AI processing

This verification process ensures that only legitimate and safe data is used for AI training and responses, improving the quality and reliability of the system.

## Security Considerations

- The `.env` file contains sensitive Telegram API and Othentic credentials and should not be committed to version control
- Telegram session strings provide full access to Telegram accounts and should be kept secure
- Consider implementing rate limiting for production deployments to avoid Telegram API restrictions
- Be aware of Telegram's terms of service regarding automated clients and bots
- Regularly update Othentic verification rules to adapt to new threats

## Integration with @autonome

This system integrates with the @autonome AI services:

- The Telegram bot uses the Advisor Autonome service for structured crypto advice
- The Tate Telegram clients use the Tate Autonome service for casual crypto conversation
- Both services receive verified data from Othentic before processing
- All services read from and write to the same message history for consistent context


## Credits

Built with [Telegram Client Library](https://github.com/gram-js/gramjs), [Telegraf](https://github.com/telegraf/telegraf), and [Othentic](https://othentic.io) verification services. 