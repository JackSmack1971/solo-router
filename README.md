# SoloRouter Chat

A **local-first**, **privacy-focused** chat interface for Large Language Models. SoloRouter runs entirely in your browser with no backend server, connecting directly to [OpenRouter](https://openrouter.ai/) or your local LLM endpoint.

> **Philosophy:** Simple, hackable, and respectful of your privacy. Think "personal text editor for AI chat" rather than SaaS platform.

---

## ✨ Features

- **🔒 Privacy First**: API keys stored in session memory only, conversations saved locally
- **⚡ Real-Time Streaming**: Server-Sent Events (SSE) for immediate response display
- **📝 Rich Markdown**: Full rendering with syntax highlighting and code copy buttons
- **🎨 Multiple Themes**: Light, dark, and system-based theme support
- **⚙️ Flexible Configuration**: Model selection, temperature, max tokens, and custom system prompts
- **📤 Data Portability**: Export and import conversations as JSON
- **🚫 No Backend**: Direct browser-to-API communication, no intermediate servers

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** (or npm/yarn)
- **OpenRouter API Key** ([Get one here](https://openrouter.ai/keys))

### Installation

```bash
# Clone the repository
git clone https://github.com/jacksmack1971/solo-router.git
cd solo-router

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`

---

## 🔑 Configuration

### Getting an OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or log in
3. Navigate to [API Keys](https://openrouter.ai/keys)
4. Create a new key
5. Copy your key (starts with `sk-or-...`)

### Setting Up Your Key

1. Open SoloRouter in your browser
2. Click the **Settings** icon (⚙️)
3. Paste your API key in the "OpenRouter API Key" field
4. Select your preferred default model
5. Adjust temperature and other settings as desired

**Security Note:** Your API key is stored in `sessionStorage` only and is cleared when you close the browser tab. It is never persisted to disk or sent anywhere except directly to OpenRouter.

---

## 💡 Usage

### Starting a Conversation

1. Type your message in the input field at the bottom
2. Press **Enter** or click **Send**
3. Watch the AI response stream in real-time

### Managing Conversations

- **New Chat**: Click the "New Chat" button
- **Switch Chats**: Click on any conversation in the sidebar
- **Delete Chat**: Click the trash icon next to a conversation
- **Export Data**: Settings → Export (saves all conversations as JSON)
- **Import Data**: Settings → Import (restore from backup file)

### Keyboard Shortcuts

- **Ctrl/Cmd + Enter**: Send message
- **Ctrl/Cmd + K**: New conversation
- **Ctrl/Cmd + /**: Toggle settings

---

## 🛠️ Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
pnpm type-check   # TypeScript type checking
```

### Tech Stack

- **React 19** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 7** - Build tool
- **Zustand 5** - State management
- **Tailwind CSS 3** - Styling
- **Marked** - Markdown parsing
- **DOMPurify** - XSS protection
- **Highlight.js** - Syntax highlighting
- **Vitest** - Testing framework

### Project Structure

```
src/
├── components/      # React UI components
│   ├── ChatInterface.tsx
│   ├── Markdown.tsx
│   ├── SettingsModal.tsx
│   └── __tests__/   # Component tests
├── hooks/           # Custom React hooks
├── services/        # API clients (OpenRouter)
├── store/           # Zustand state management
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
    ├── storage.ts   # localStorage/sessionStorage utilities
    └── __tests__/   # Utility tests
```

---

## 🔒 Security

SoloRouter takes security seriously, even as a client-only application:

- **XSS Prevention**: All model output is sanitized with DOMPurify before rendering
- **API Key Protection**: Keys stored in sessionStorage only, never logged or persisted
- **No Data Leakage**: All conversations stored locally in your browser's localStorage
- **Direct API Calls**: No intermediate servers that could intercept your data

---

## 📖 Documentation

For detailed information about the project:

- **[SPEC.md](./SPEC.md)** - Functional requirements and specifications
- **[CODING_STANDARDS.md](./CODING_STANDARDS.md)** - Architecture and coding conventions
- **[CLAUDE.md](./CLAUDE.md)** - AI collaboration guide

---

## 🧪 Testing

SoloRouter includes comprehensive tests for critical functionality:

```bash
# Run all tests
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run with coverage
pnpm test:run --coverage
```

Test coverage focuses on:
- **Security**: XSS prevention, sanitization
- **Storage**: localStorage vs sessionStorage usage
- **Markdown**: Rendering correctness

---

## 🤝 Contributing

This is a personal project, but contributions are welcome! Please ensure:

1. Tests pass (`pnpm test:run`)
2. Linting passes (`pnpm lint`)
3. Types check (`pnpm type-check`)
4. Code follows existing patterns

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai/) - LLM API aggregation service
- [Anthropic](https://www.anthropic.com/) - Claude models
- [OpenAI](https://openai.com/) - GPT models

---

**Built with ❤️ for privacy-conscious AI enthusiasts**
