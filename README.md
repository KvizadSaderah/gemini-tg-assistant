# Gemini 3 Telegram Assistant 🚀

Advanced Telegram bot powered by **Google Gemini 3 Flash**. Featuring real-time web search, voice interactions, and a professional CLI dashboard for monitoring and management.

## ✨ Features

- 🧠 **Gemini 3 Flash Engine**: High-speed, multimodal AI (Text, Images, Audio).
- 🔍 **Google Search Integration**: Real-time web browsing for up-to-date information.
- 🎙️ **Voice Support**:
  - Understands incoming voice messages.
  - Optional TTS (Text-to-Speech) responses (toggle via `/voice`).
- 🖼️ **Image Analysis**: Send any photo and ask questions about it.
- 📊 **Interactive CLI Dashboard**:
  - Real-time interaction monitoring.
  - SQLite-backed message history.
  - **Admin Reply**: Respond to users directly from your terminal.
- 🛡️ **Advanced Security**: 
  - Whitelist-based access (ID or @username).
  - Automatic ID-to-Username association.

## 🛠 Tech Stack

- **Runtime**: Node.js (TypeScript)
- **AI SDK**: `@google/generative-ai`
- **Bot Framework**: `grammy`
- **Database**: `better-sqlite3`
- **UI**: `blessed-contrib`
- **Logging**: `winston`

## 🚀 Quick Start

### 1. Prerequisites
- Node.js v20+
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### 2. Installation
```bash
git clone <your-repo-url>
cd gemini-tg-assistant
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_token_here
GEMINI_API_KEY=your_api_key_here
ALLOWED_USERS=@your_username,12345678
LOG_LEVEL=info
```

### 4. Running
**Start the Bot Service:**
```bash
# Recommended for production/background
NO_DASHBOARD=true npm start
```

**Start the Admin Panel:**
```bash
# In a separate terminal
npm run dashboard
```

## 🎮 Commands

- `/start` - Initialize chat and get your ID.
- `/clear` - Wipe current conversation history.
- `/voice` - Toggle Voice Response mode (ON/OFF).
- Send a **Voice Message** - Bot will transcribe and answer.
- Send a **Photo** - Bot will analyze the image.

## 🛡 Security & Privacy
This project uses a local SQLite database (`bot_data.db`) to store logs and stats. Ensure this file is backed up and kept private.

## 📄 License
MIT
