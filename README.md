# 🌟 Lumina - 智能语言学习应用 / Intelligent Language Learning App

> 一个现代化的语言学习应用，集成了智能词典、词形变化分析和间隔重复系统  
> A modern language learning app with intelligent dictionary, morphology analysis and spaced repetition system

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-green.svg)

---

## 📥 下载安装 / Download & Install

### 🎯 推荐方式：使用安装包 (Recommended: Use Installer)

从 GitHub Releases 下载最新安装包：  
Download the latest installer from GitHub Releases:

**https://github.com/HashBrowns-fries/Lumina/releases**

| 平台 | 安装包类型 | 说明 |
|------|-----------|------|
| Windows | `.msi` / `.exe` | 推荐使用 MSI 安装包 |
| macOS | `.dmg` | 需要签名（测试模式） |
| Linux | `.AppImage` / `.deb` | 暂未发布 |

#### Windows 安装步骤 / Windows Installation Steps

1. 下载 `Lumina_1.3.0_x64_en-US.msi` 或 `Lumina_1.3.0_x64-setup.exe`
2. 双击运行安装程序
3. 按提示完成安装
4. 从开始菜单或桌面快捷方式启动

> **注意**：首次运行可能需要几秒钟启动后端服务。  
> **Note**: First launch may take a few seconds to start backend services.

#### 依赖要求 / Dependencies

- **Windows 10/11** (需要 WebView2，大多数用户已预装)
- **Python 3.8+** (用于梵语 API，可选)

---

## ✨ 核心特性 / Core Features

### 📚 智能词典系统 / Intelligent Dictionary

- **多词条智能显示**：词形变化、不同词性显示为独立编号条目
- **词形变化检测**：自动识别词形变化并切换到词根形式
- **多语言支持**：支持德语、英语、梵语等 20+ 语言

### 🤖 AI 增强学习 / AI-Enhanced Learning

- **语法分析**：AI 驱动的详细语法分析
- **智能翻译**：上下文感知的翻译和建议
- **支持多个 AI 提供商**：Google Gemini、DeepSeek、阿里云通义千问、Ollama

### 🔄 间隔重复系统 / Spaced Repetition System

- **SM-2 算法**：基于科学的记忆曲线
- **5 个学习等级**：新词、陌生、熟悉、掌握、已复习

### 🎨 多主题界面 / Multi-Theme Interface

- **7 种主题**：Light、Dark、Night、Sepia、Paper、High Contrast、Auto

---

## ⚙️ 配置说明 / Configuration

### AI 配置 / AI Configuration

首次使用 AI 分析功能时，需要配置 API 密钥：

1. 点击右上角 **Settings** (设置)
2. 进入 **AI Configuration** (AI 配置)
3. 选择 AI 提供商并输入 API 密钥

**支持的 AI 提供商 / Supported AI Providers**:
| 提供商 | 说明 | 需要 API Key |
|--------|------|-------------|
| Google Gemini | Google AI | ✅ |
| DeepSeek | DeepSeek AI | ✅ |
| 阿里云通义千问 | Alibaba Cloud | ✅ |
| Ollama | 本地运行 | ❌ (可选) |

### 数据目录 / Data Directory

桌面应用的数据存储位置：
- **Windows**: `%APPDATA%\com.lumina.app\`
- **macOS**: `~/Library/Application Support/com.lumina.app/`
- **Linux**: `~/.config/com.lumina.app/`

---

## 🛠️ 开发指南 / Development Guide

### 前提条件 / Prerequisites

- **Node.js 18+**: [下载 / Download](https://nodejs.org/)
- **Python 3.8+** (可选，用于梵语 API)
- **Rust** (仅用于构建桌面应用)

### 本地开发 / Local Development

```bash
# 克隆项目
git clone https://github.com/HashBrowns-fries/Lumina.git
cd Lumina

# 安装依赖
npm install

# 启动开发服务器
npm run dev:all
```

这将启动：
- 前端: http://localhost:3000
- 词典 API: http://localhost:3006
- 梵语 API: http://localhost:3008

### 构建桌面应用 / Build Desktop App

```bash
# 安装 Rust (如未安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 构建
npm run build:tauri
```

输出文件位于：
- `src-tauri/target/release/lumina.exe`
- `src-tauri/target/release/bundle/msi/`

---

## 📁 文件结构 / Project Structure

```
Lumina/
├── src-tauri/           # Tauri 桌面应用
│   ├── src/main.rs      # Rust 入口点
│   └── tauri.conf.json  # 应用配置
├── server/              # Node.js 后端 (端口 3006)
├── scripts/             # Python 后端 (端口 3008)
├── components/          # React 组件
├── services/           # 业务逻辑服务
├── dist/               # 构建输出
└── README.md
```

---

## 🔧 故障排除 / Troubleshooting

### AI 分析不工作 / AI Analysis Not Working

1. **检查 API 密钥**：确保已在设置中配置有效的 API 密钥
2. **检查网络连接**：确保可以访问 AI 提供商
3. **查看错误信息**：错误信息会提示具体问题

### 后端服务未启动 / Backend Services Not Starting

1. 检查 Python 是否已安装：`python --version`
2. 检查 Node.js 是否已安装：`node --version`
3. 查看应用日志了解具体错误

### 端口被占用 / Port Already in Use

如果端口 3006 或 3008 被占用：
- Windows: `netstat -ano | findstr "3006"`
- 关闭占用端口的程序，或修改配置使用其他端口

---

## 📄 许可证 / License

MIT License

---

## 🤝 贡献 / Contributing

欢迎提交 Issue 和 Pull Request！

---

**有问题？请提交 Issue**: https://github.com/HashBrowns-fries/Lumina/issues
