# @autonome

A powerful AI agent integration system for crypto-focused applications, built on the Autonome platform.

## Overview

@autonome is a backend service that integrates AI agents from the Autonome platform into applications. It currently provides two specialized AI agents:

1. **Tate Autonome** - A crypto enthusiast AI that participates in Telegram group chats with natural, conversational responses about cryptocurrency topics.

2. **Advisor Autonome** - A crypto advisor AI that provides structured analysis and recommendations about cryptocurrency investments, particularly focused on Eigen Layer restaking.

## Features

- **Queue Management**: Handles concurrent requests efficiently with a queue system
- **Retry Logic**: Implements exponential backoff for API request retries
- **Fallback Responses**: Provides reliable responses even when the AI service is unavailable
- **Chat History Integration**: Reads from and writes to Telegram chat history
- **Structured Responses**: Formats advisor responses in a consistent, structured format

## Technical Architecture

The system consists of two main services:

### Tate Autonome (`tate_autonome.js`)

- Express.js server that provides a `/discuss-crypto` endpoint
- Reads recent messages from Telegram chat history
- Generates casual, conversational responses about crypto topics
- Appends AI responses to the chat history
- Uses queue management for handling concurrent requests

### Advisor Autonome (`advisor_autonome.js`)

- Express.js server that provides a `/discuss-crypto` endpoint for structured advice
- Accepts questions and context about crypto investments
- Generates structured analysis with token recommendations, risks, and strategies
- Implements enhanced error handling and fallback responses
- Provides a `/health` endpoint for service monitoring

## API Endpoints

### Tate Autonome
- `POST /discuss-crypto`: Generates a casual crypto-related message based on recent chat history
- `GET /chat-history`: Returns the current chat history

### Advisor Autonome
- `POST /discuss-crypto`: Generates structured crypto investment advice
  - Request body: `{ "question": "string", "context": "string" }`
- `GET /health`: Returns service health status

## Setup and Configuration

1. Install dependencies:
   ```
   npm install express axios dotenv
   ```

2. Configure environment variables in `.env`:
   ```
   BASE_URL_TATE=https://autonome.alt.technology/tate-eixurt
   AGENT_ID_TATE=
   CREDENTIALS_TATE=

   BASE_URL_ADVISOR=https://autonome.alt.technology/andrew-tocrjv
   AGENT_ID_ADVISOR=
   CREDENTIALS_ADVISOR=
   ```

3. Start the services:
   ```
   node tate_autonome.js
   node advisor_autonome.js
   ```

## Credits

Built with [Autonome](https://autonome.alt.technology/) AI platform. 