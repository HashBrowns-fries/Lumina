# 🌟 Lumina - Intelligent Language Learning App

<img src="src-tauri/icons/icon.png" width="128" height="128" align="right" />

> A modern desktop application for language learning with intelligent dictionary, morphology analysis, and spaced repetition system  
> Powered by Tauri 2.0 + Rust backend

![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-green.svg)
![Backend](https://img.shields.io/badge/backend-Rust%20%2B%20Tauri-orange.svg)

---

## 📥 Download & Install

### Recommended: Use GitHub Releases

Download the latest installer from:

**https://github.com/HashBrowns-fries/Lumina/releases**

| Platform | Installer | Installation |
|----------|-----------|--------------|
| Windows | `.msi` | Double-click to install (Recommended) |
| Windows | `.exe` (NSIS) | Double-click to install |
| macOS | `.dmg` | Drag to Applications folder |
| Linux | `.AppImage` | Add execute permission and run |
| Linux | `.deb` | `sudo dpkg -i *.deb` |

> **Note**: First launch may take a few seconds to initialize.

#### System Requirements

- **Windows 10/11** (WebView2 required, pre-installed on most systems)
- **macOS 10.15+**
- **Linux**: WebKit2GTK required
- **Python 3.8+** (Optional, for Sanskrit API)

---

## ✨ Core Features

### 📚 Intelligent Dictionary System

- **Multi-entry Display**: Different parts of speech shown as separate numbered entries
- **Inflection Detection**: Automatically identifies inflected forms and shows lemma
- **Multi-language Support**: German, English, Sanskrit, and 20+ languages
- **Offline Support**: Import local SQLite dictionary databases
- **Precise Queries**: Exact match only, no fuzzy matching
- **Double-Click to Save**: Quickly save words to vocabulary with double-click (toggle in Settings)

### 🤖 AI-Enhanced Learning

- **Grammar Analysis**: AI-powered detailed grammatical breakdown
- **Context-aware Translation**: Smart translation with suggestions
- **Multiple AI Providers**: Google Gemini, DeepSeek, Alibaba Qwen, Ollama

### 🔄 Spaced Repetition System

- **SM-2 Algorithm**: Science-based memory curve optimization
- **5 Learning Levels**: New, Unfamiliar, Familiar, Mastered, Reviewed

### 🕉️ Sanskrit Support

- **High-precision Analysis**: Dharma Mitra Sanskrit grammar API
- **Multiple Transliteration**: Devanagari, IAST, SLP1, Harvard-Kyoto

### 🎨 Multi-Theme Interface

- **7 Themes**: Light, Dark, Night, Sepia, Paper, High Contrast, Auto

---

## ⚙️ Configuration

### AI Configuration

First time using AI analysis:

1. Click **Settings** (top-right)
2. Go to **AI Configuration**
3. Select AI provider and enter API key

**💡 Pro Tip**: Store your API keys in a `.env` file for easier management:
```bash
cp .env.example .env
# Edit .env and add your keys
```

See [API_KEYS.md](API_KEYS.md) for detailed setup instructions.

**Supported AI Providers**:

| Provider | Description | API Key Required |
|----------|-------------|------------------|
| Google Gemini | Google AI (Recommended) | ✅ |
| DeepSeek | DeepSeek AI | ✅ |
| Alibaba Qwen | Alibaba Cloud | ✅ |
| OpenAI | GPT models | ✅ |
| Ollama | Local deployment | ❌ (Free) |

### Environment Variables

Configure API keys and defaults via `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit with your API keys
# - GEMINI_API_KEY
# - DEEPSEEK_API_KEY
# - ALIYUN_API_KEY
# - OPENAI_API_KEY (optional)
# - OLLAMA_BASE_URL (for local AI)
```

See [API_KEYS.md](API_KEYS.md) for complete reference.

### Data Directory

Desktop app stores data at:
- **Windows**: `%APPDATA%\com.lumina.app\`
- **macOS**: `~/Library/Application Support/com.lumina.app/`
- **Linux**: `~/.config/com.lumina.app/`

### Dictionary Directory

Place dictionary databases in:
- **Windows**: `%APPDATA%\com.lumina.app\dict\`
- **Development**: `<project-root>\dict\`

Supported format: Kaikki SQLite (`dictionary.db` or `<lang>_dict.db`)

Structure:
```
dict/
  ├── German/
  │   └── de_dict.db
  ├── English/
  │   └── en_dict.db
  └── Sanskrit/
      └── sa_dict.db
```

---

## 🙏 Acknowledgments

### Dharma Mitra

Special thanks to **Dharma Mitra** (https://github.com/versed-in/dharmamitra_sanskrit_grammar) for providing the Sanskrit grammar analysis API that powers Lumina's Sanskrit learning features.

---

## 🛠️ Development Guide

### Prerequisites

- **Node.js 18+**: [Download](https://nodejs.org/)
- **Rust** (for Tauri desktop app): [Install via rustup](https://rustup.rs/)
- **Python 3.8+** (Optional, for Sanskrit API)
  - Or use **uv** (modern Python package manager): [Install](https://astral.sh/uv)

### Local Development

```bash
# Clone repository
git clone https://github.com/HashBrowns-fries/Lumina.git
cd Lumina

# Install dependencies
npm install

# Start development (frontend + Tauri)
npm run dev:tauri

# Optional: Start Sanskrit API
npm run dev:sanskrit-api
```

This launches:
- Frontend: http://localhost:3000
- Sanskrit API: http://localhost:3008 (optional)

### Build Desktop App

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build for current platform
npm run build:tauri

# Or build for all platforms (requires CI/CD)
# See .github/workflows/release.yml
```

Output location:
- `src-tauri/target/release/lumina.exe` (Windows)
- `src-tauri/target/release/bundle/` (installers)

---

## 📁 Project Structure

```
Lumina/
├── src-tauri/              # Tauri 2.0 Rust backend
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   ├── db.rs           # SQLite dictionary queries
│   │   ├── commands/       # Tauri commands
│   │   └── floating.rs     # Floating window manager
│   ├── tauri.conf.json     # Tauri configuration
│   └── Cargo.toml          # Rust dependencies
├── src/                    # React + TypeScript frontend
├── components/             # React components
├── services/               # Frontend services
├── scripts/                # Python scripts (Sanskrit API)
│   ├── enhanced_sanskrit_api.py
│   ├── sandhi_api.py
│   └── manage_dictionaries.py
├── dict/                   # Dictionary databases (Kaikki format)
├── data/                   # Static data files
├── .github/workflows/      # GitHub Actions CI/CD
│   └── release.yml         # Release automation
├── package.json            # Node.js dependencies
├── vite.config.ts          # Vite build configuration
└── README.md
```

---

## 🔧 Troubleshooting

### AI Analysis Not Working

1. **Check API Key**: Ensure valid API key configured in Settings
2. **Network Connection**: Verify connectivity to AI provider
3. **Error Messages**: Check error message for specific issues
4. **Try Different Provider**: Switch to another AI provider in Settings

### Double-Click Save Not Working

1. **Enable in Settings**: Go to Settings → Languages & Dictionaries → Toggle "Double-Click to Save"
2. **Check if Already Saved**: Words already in vocabulary won't be saved again
3. **Verify Language**: Make sure you're reading in the correct language

### Dictionary Queries Returning Wrong Results

1. **Dictionary Format**: Ensure Kaikki SQLite format
2. **Directory Structure**: Verify `dict/<Language>/<lang>_dict.db`
3. **Rescan Dictionaries**: Use Settings → Rescan Dictionaries

### Python/uv Not Detected

**For Python:**
```bash
# Install Python 3.8+
# Windows: https://python.org
# macOS: brew install python
# Linux: sudo apt install python3
```

**For uv (recommended):**
```bash
# Install uv (modern Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify installation
uv --version
```

### Build Errors

**Rust not found:**
```bash
rustup install stable
rustup default stable
```

**WebView2 missing (Windows):**
Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Port Conflicts

If port 3000/3008 is in use:
- Windows: `netstat -ano | findstr "3000"`
- Kill process or change port in config

---

## 📊 Performance

Thanks to code splitting and lazy loading in v1.5.0:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Bundle | 710 KB | 202 KB | ↓ 72% |
| First Load Time | ~2.0s | ~0.8s | ↓ 60% |
| Vendor Caching | Poor | Excellent | ✅ |

---

## 📄 License

MIT License

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Latest: v1.5.0

**Major Changes:**
- ✨ Migrated to Tauri 2.0 + Rust backend (72% smaller bundle size)
- 🚀 Added double-click to save words to vocabulary
- 🔧 Fixed dictionary path detection for bundled builds
- 🐍 Added uv (modern Python package manager) support
- 📝 API keys now configured via .env file
- 🎨 Improved floating window UI and save functionality
- 🔍 Enhanced dictionary query precision
- 📦 Code splitting and lazy loading for faster initial load

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

**Report issues**: https://github.com/HashBrowns-fries/Lumina/issues

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Lumina v1.5.0** - Built with Tauri 2.0 + Rust
