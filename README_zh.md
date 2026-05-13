# 🌟 Lumina - 智能语言学习应用

<img src="src-tauri/icons/icon.png" width="128" height="128" align="right" />

> 一款现代化的桌面语言学习应用，集成智能词典、形态分析和间隔重复系统
> 基于 Tauri 2.0 + Rust 后端

![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-green.svg)
![Backend](https://img.shields.io/badge/backend-Rust%20%2B%20Tauri-orange.svg)

---

## 📥 下载与安装

### 推荐：使用 GitHub Releases

从以下地址下载最新安装包：

**https://github.com/HashBrowns-fries/Lumina/releases**

| 平台 | 安装包 | 安装方式 |
|------|--------|----------|
| Windows | `.msi` | 双击安装（推荐） |
| Windows | `.exe` (NSIS) | 双击安装 |
| macOS | `.dmg` | 拖到应用程序文件夹 |
| Linux | `.AppImage` | 添加执行权限后运行 |
| Linux | `.deb` | `sudo dpkg -i *.deb` |

> **注意**：首次启动可能需要几秒钟初始化。

#### 系统要求

- **Windows 10/11**（需要 WebView2，大多数系统已预装）
- **macOS 10.15+**
- **Linux**：需要 WebKit2GTK
- **Python 3.8+**（可选，用于梵语 API）

---

## ✨ 核心功能

### 📚 智能词典系统

- **多条目显示**：不同词性显示为独立编号条目
- **变形式检测**：自动识别动词/名词变位并显示原形
- **多语言支持**：德语、英语、梵语及 20+ 种语言
- **离线支持**：导入本地 SQLite 词典数据库
- **精确查询**：精确匹配，无模糊匹配
- **双击保存**：双击快速保存单词到词汇本（可在设置中切换）

### 🤖 AI 增强学习

- **语法分析**：AI 驱动的详细语法解析
- **上下文感知翻译**：智能翻译与建议
- **多 AI 提供商**：Google Gemini、DeepSeek、阿里 Qwen、Ollama

### 🔄 间隔重复系统

- **SM-2 算法**：基于科学的记忆曲线优化
- **5 个学习级别**：新词、不熟、熟悉、掌握、已复习

### 🕉️ 梵语支持

- **高精度分析**：Dharma Mitra 梵语语法 API
- **多种转写**：天城文、IAST、SLP1、Harvard-Kyoto

### 🎨 多主题界面

- **7 种主题**：浅色、深色、夜间、羊皮纸、纸张、高对比度、自动

---

## ⚙️ 配置

### AI 配置

首次使用 AI 分析：

1. 点击右上角 **设置**
2. 进入 **AI 配置**
3. 选择 AI 提供商并输入 API 密钥

**💡 技巧**：将 API 密钥存储在 `.env` 文件中更方便管理：
```bash
cp .env.example .env
# 编辑 .env 并添加密钥
```

详细设置说明请参阅 [API_KEYS.md](API_KEYS.md)。

**支持的 AI 提供商**：

| 提供商 | 描述 | 需要 API 密钥 |
|--------|------|--------------|
| Google Gemini | Google AI（推荐） | ✅ |
| DeepSeek | DeepSeek AI | ✅ |
| 阿里 Qwen | 阿里云 | ✅ |
| OpenAI | GPT 模型 | ✅ |
| Ollama | 本地部署 | ❌（免费） |

### 环境变量

通过 `.env` 文件配置 API 密钥和默认值：

```bash
# 复制示例文件
cp .env.example .env

# 使用您的 API 密钥进行编辑
# - GEMINI_API_KEY
# - DEEPSEEK_API_KEY
# - ALIYUN_API_KEY
# - OPENAI_API_KEY（可选）
# - OLLAMA_BASE_URL（用于本地 AI）
```

详细参考请参阅 [API_KEYS.md](API_KEYS.md)。

### 数据目录

桌面应用数据存储位置：
- **Windows**：`%APPDATA%\com.lumina.app\`
- **macOS**：`~/Library/Application Support/com.lumina.app/`
- **Linux**：`~/.config/com.lumina.app/`

### 词典目录

将词典数据库放置于：
- **Windows**：`%APPDATA%\com.lumina.app\dict\`
- **开发**：`<项目根目录>\dict\`

支持的格式：Kaikki SQLite（`dictionary.db` 或 `<lang>_dict.db`）

目录结构：
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

## 🙏 致谢

### Dharma Mitra

特别感谢 **Dharma Mitra**（https://github.com/versed-in/dharmamitra_sanskrit_grammar）提供梵语语法分析 API，驱动 Lumina 的梵语学习功能。

---

## 🛠️ 开发指南

### 前置要求

- **Node.js 18+**：[下载](https://nodejs.org/)
- **Rust**（用于 Tauri 桌面应用）：[通过 rustup 安装](https://rustup.rs/)
- **Python 3.8+**（可选，用于梵语 API）
  - 或使用 **uv**（现代化 Python 包管理器）：[安装](https://astral.sh/uv)

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/HashBrowns-fries/Lumina.git
cd Lumina

# 安装依赖
npm install

# 启动开发（前端 + Tauri）
npm run dev:tauri

# 可选：启动梵语 API
npm run dev:sanskrit-api
```

这将启动：
- 前端：http://localhost:3000
- 梵语 API：http://localhost:3008（可选）

### 构建桌面应用

```bash
# 安装 Rust（如未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 为当前平台构建
npm run build:tauri

# 或为所有平台构建（需要 CI/CD）
# 参见 .github/workflows/release.yml
```

输出位置：
- `src-tauri/target/release/lumina.exe`（Windows）
- `src-tauri/target/release/bundle/`（安装包）

---

## 📁 项目结构

```
Lumina/
├── src-tauri/              # Tauri 2.0 Rust 后端
│   ├── src/
│   │   ├── main.rs         # 应用入口
│   │   ├── db.rs           # SQLite 词典查询
│   │   ├── commands/       # Tauri 命令
│   │   └── floating.rs     # 浮动窗口管理器
│   ├── tauri.conf.json     # Tauri 配置
│   └── Cargo.toml          # Rust 依赖
├── src/                    # React + TypeScript 前端
├── components/             # React 组件
├── services/               # 前端服务
├── scripts/                # Python 脚本（梵语 API）
│   ├── enhanced_sanskrit_api.py
│   ├── sandhi_api.py
│   └── manage_dictionaries.py
├── dict/                   # 词典数据库（Kaikki 格式）
├── data/                   # 静态数据文件
├── .github/workflows/      # GitHub Actions CI/CD
│   └── release.yml         # 发布自动化
├── package.json            # Node.js 依赖
├── vite.config.ts          # Vite 构建配置
├── README.md               # 英文说明
├── README_zh.md            # 中文说明
└── README.md
```

---

## 🔧 故障排除

### AI 分析不工作

1. **检查 API 密钥**：确保设置中配置了有效的 API 密钥
2. **网络连接**：验证与 AI 提供商的连接
3. **错误信息**：查看错误消息了解具体问题
4. **尝试其他提供商**：在设置中切换到其他 AI 提供商

### 双击保存不工作

1. **在设置中启用**：设置 → 语言与词典 → 切换"双击保存"
2. **检查是否已保存**：已在词汇本中的单词不会再次保存
3. **验证语言**：确保在正确的语言下阅读

### 词典查询返回错误结果

1. **词典格式**：确保是 Kaikki SQLite 格式
2. **目录结构**：验证 `dict/<语言>/<lang>_dict.db`
3. **重新扫描词典**：使用设置 → 重新扫描词典

### Python/uv 未检测到

**对于 Python：**
```bash
# 安装 Python 3.8+
# Windows: https://python.org
# macOS: brew install python
# Linux: sudo apt install python3
```

**对于 uv（推荐）：**
```bash
# 安装 uv（现代化 Python 包管理器）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 验证安装
uv --version
```

### 构建错误

**找不到 Rust：**
```bash
rustup install stable
rustup default stable
```

**缺少 WebView2（Windows）：**
从以下地址下载：https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 端口冲突

如果端口 3000/3008 被占用：
- Windows：`netstat -ano | findstr "3000"`
- 终止进程或更改配置中的端口

---

## 📊 性能

得益于 v1.5.0 中的代码分割和懒加载：

| 指标 | 之前 | 之后 | 改善 |
|------|------|------|------|
| 初始包大小 | 710 KB | 202 KB | ↓ 72% |
| 首次加载时间 | ~2.0s | ~0.8s | ↓ 60% |
| 供应商缓存 | 差 | 优秀 | ✅ |

---

## 📄 许可证

MIT 许可证

---

## 📝 更新日志

详细版本历史请参阅 [CHANGELOG.md](CHANGELOG.md)。

### 最新：v1.5.0

**主要更新：**
- ✨ 添加词典下载页面（Kaikki.org 21 种语言）
- 🎯 新增视线追踪和双视阅读功能
- 🚀 更新的外观设置与新主题选项
- 🐛 各种错误修复

---

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

**报告问题**：https://github.com/HashBrowns-fries/Lumina/issues

---

**Lumina v1.5.0** - 基于 Tauri 2.0 + Rust 构建