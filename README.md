# 🌟 Luminous Lute - 智能德语学习应用

> 一个现代化的德语学习应用，集成了智能词典、词形变化分析和间隔重复系统

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-3178c6.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)

## 🎯 项目概述

Luminous Lute 是一个专为德语学习者设计的现代化语言学习应用。它集成了智能词典系统、AI驱动的语法分析和科学的间隔重复系统(SRS)，帮助用户高效学习德语词汇。

### ✨ 核心特性

#### 📚 **智能德语词典系统**
- **多词条智能显示**：词形变化、不同词性显示为独立编号条目
- **词形变化检测**：自动识别词形变化并切换到词根形式（如"nahm" → "nehmen"）
- **条目分类系统**：`variant`（变体）/`root`（词根）/`normal`（普通）三种类型
- **词条关系可视化**：变体与词根之间的清晰连接指示
- **词性过滤功能**：按动词、名词、形容词等快速筛选条目

#### 🤖 **AI增强学习**
- **语法分析**：DeepSeek AI驱动的详细语法分析
- **智能翻译**：上下文感知的翻译和建议
- **例句生成**：基于上下文的实用例句

#### 🔄 **间隔重复系统(SRS)**
- **科学记忆算法**：基于SM-2算法的智能复习计划
- **学习进度跟踪**：5个学习等级 + 忽略选项
- **词汇库管理**：分类、搜索和统计功能

#### 🌐 **离线支持**
- **本地词典数据库**：包含364,332个德语词条的SQLite数据库
- **离线词形分析**：无需网络即可分析词形变化
- **数据持久化**：浏览器本地存储所有学习数据

## 🏗️ 系统架构

### 前端 (React + TypeScript)
- **React 18**：现代化的组件化UI
- **TypeScript**：类型安全的开发体验
- **Tailwind CSS**：原子化CSS框架
- **Vite**：快速的构建工具

### 后端 (Node.js + Express)
- **词典服务器**：运行在端口3003的REST API
- **SQLite数据库**：德语词典数据存储
- **智能查询引擎**：支持词形变化检测和多条目返回

### 服务层
- `wiktionaryService.ts`：词典API服务接口
- `dictionaryService.js`：核心词典查询逻辑
- `llmService.ts`：AI分析服务
- `srsService.ts`：间隔重复系统

## 🚀 快速开始

### 前提条件

- **Node.js 18+**: [下载安装](https://nodejs.org/)
- **npm** (随 Node.js 一起安装)
- **Git**: [下载安装](https://git-scm.com/)

---

## 🪟 Windows 安装指南

### 1. 安装 Node.js

访问 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本（推荐 20.x）。

安装时确保勾选：
- ✅ `Add to PATH`
- ✅ `Node.js runtime`

安装完成后，打开 **PowerShell** 或 **命令提示符** 验证：

```powershell
node -v
npm -v
```

### 2. 克隆项目

```powershell
git clone https://github.com/ChenhaoMeng/Lumina.git
cd Lumina
```

### 3. 安装依赖

```powershell
# 安装前端依赖
npm install

# 安装词典服务器依赖
cd server
npm install
cd ..
```

### 4. 配置环境变量（可选）

在项目根目录创建 `.env.local` 文件：

```env
GEMINI_API_KEY=your_api_key_here
```

### 5. 启动应用

**方式一：同时启动前端和服务器**
```powershell
# 需要打开两个终端窗口

# 终端 1: 启动前端 (http://localhost:3000)
npm run dev

# 终端 2: 启动词典服务器 (端口 3003)
cd server
node index.js
```

**方式二：一键启动（推荐）**
```powershell
npm run dev:both
```

### 6. 访问应用

打开浏览器访问：http://localhost:3000

---

## 🍎 macOS 安装指南

### 1. 安装 Node.js

**方式一：通过 Homebrew（推荐）**
```bash
brew install node@20
```

**方式二：通过安装包**
访问 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本。

验证安装：
```bash
node -v
npm -v
```

### 2. 克隆项目

```bash
git clone https://github.com/ChenhaoMeng/Lumina.git
cd Lumina
```

### 3. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装词典服务器依赖
cd server
npm install
cd ..
```

### 4. 配置环境变量（可选）

```bash
# 创建环境变量文件
touch .env.local
```

编辑 `.env.local`：
```env
GEMINI_API_KEY=your_api_key_here
```

### 5. 启动应用

**方式一：分终端启动**

```bash
# 终端 1: 启动前端
npm run dev

# 终端 2: 启动词典服务器
cd server
node index.js
```

**方式二：一键启动（推荐）**
```bash
npm run dev:both
```

### 6. 访问应用

打开浏览器访问：http://localhost:3000

---

## 📦 词典数据准备

本应用需要词典数据库文件才能正常工作。请按照以下步骤准备：

### 1. 下载词典数据

从 [kaikki.org](https://kaikki.org/) 下载 Wiktionary 导出文件：

| 语言 | 下载链接 | 解释语言 |
|------|----------|----------|
| 德语 | https://kaikki.org/dictionary/German/ | 英语 |
| 中文 | https://kaikki.org/zhwiktionary/ | 中文 |

点击页面中的 "Raw JSON" 或 "Download" 获取 JSON 格式数据文件。

### 2. 转换数据为 SQLite 数据库

运行项目中的转换脚本：

```bash
# 进入脚本目录
cd scripts

# 安装 Python 依赖（如需要）
pip install -r requirements.txt

# 运行转换脚本
python extract-test-data.py /path/to/dewikt_raw_json.json
```

### 3. 放置数据库文件

将生成的 `german_dict.db` 文件放入对应语言目录：

```
dict/
└── German/
    └── german_dict.db    # 德语词典数据库
```

### 4. 验证安装

启动应用后，词典服务器会自动连接数据库。可以在浏览器控制台查看连接状态。

---

## 📖 使用指南

## 📖 使用指南

### 基本工作流程

1. **阅读德语文本**
   - 粘贴或输入德语文本到阅读器
   - 点击任意单词查看详细分析

2. **词典功能**
   - 侧边栏显示单词的**所有相关形式**（编号显示）
   - **变体形式**（如"bequem"作为"bequemen"的命令式）
   - **词根形式**（如"bequemen"）
   - **普通条目**（如"gut"作为形容词/副词）

3. **保存词汇**
   - 设置学习等级（1-5或忽略）
   - 自动检测词根并保存
   - 变体形式自动链接到词根

4. **复习系统**
   - 根据SRS算法定时复习
   - 跟踪记忆强度和进度
   - 可视化学习统计

### 词典功能详解

#### 🎯 智能词条显示
```
示例："bequem" 显示为：
1. bequem (verb · imperative)
   → Root form: bequemen
   
2. bequem (adjective)
   comfortable, convenient; relaxed, easy
   
3. bequemen (verb · root)
   ↳ Variant: bequem
   to decide to something, with displeasure
```

#### 🔍 词形变化检测
- **自动检测**："nahm" → 自动识别为"nehmen"的过去式
- **智能切换**：文本字段自动设为词根形式，带"Auto-detected"标签
- **用户覆盖**：可手动编辑检测到的词根形式

#### 🎚️ 过滤功能
- **按词性过滤**：All / Verbs / Nouns / Adjectives / Adverbs / Other
- **实时统计**："Showing X of Y entries"
- **颜色编码**：不同词性使用不同颜色

## 🛠️ 开发指南

### 项目结构
```
luminous-lute/
├── components/          # React组件
│   ├── TermSidebar.tsx  # 词典侧边栏（核心）
│   ├── Reader.tsx       # 阅读器组件
│   └── ...             # 其他组件
├── server/             # 词典服务器
│   ├── dictionaryService.js  # 词典查询引擎
│   └── index.js        # Express API服务器
├── services/           # 前端服务层
│   ├── wiktionaryService.ts   # 词典API接口
│   ├── llmService.ts  # AI服务
│   └── ...            # 其他服务
├── dict/              # 词典数据库
│   └── German/german_dict.db  # SQLite词典
└── ...               # 配置文件
```

### 核心组件说明

#### `TermSidebar.tsx`
词典侧边栏的主要组件，负责：
- 显示多词条词典数据
- 处理词形变化检测
- 管理过滤和排序
- 用户交互和保存逻辑

#### `dictionaryService.js`
后端词典服务的核心，提供：
- 多词条查询和去重
- 词形变化分析和分类
- 智能排序（变体→词根→普通）
- 缓存和性能优化

#### `wiktionaryService.ts`
前端词典服务接口，提供：
- 统一的后端API调用
- 响应格式标准化
- 错误处理和降级

### API接口

#### 词典查询
```
GET /api/dictionary/query/:languageCode/:word
示例：GET /api/dictionary/query/de/bequem

响应格式：
{
  "success": true,
  "entries": [
    {
      "word": "bequem",
      "partOfSpeech": "verb",
      "entryType": "variant",
      "rootWord": "bequemen",
      "definitions": [...]
    },
    // 更多条目...
  ]
}
```

## 📊 技术特色

### 词条分类系统
1. **`variant`（变体）**：词形变化形式
   - `isInflection: true`
   - `rootWord` 指向原形
   - 示例："bequem"（命令式）

2. **`root`（词根）**：词典原形，有关联变体
   - `hasInflections: true`
   - `variantOf` 指向查询的变体
   - 示例："bequemen"

3. **`normal`（普通）**：标准词典条目
   - 可能有 `selfInflectionAnalysis`
   - 示例："gut"（形容词）

### 排序算法
```typescript
// 排序优先级：变体 → 词根 → 普通
const typeOrder = { 'variant': 1, 'root': 2, 'normal': 3 };
entries.sort((a, b) => typeOrder[a.entryType] - typeOrder[b.entryType]);
```

## 🔧 故障排除

### Windows

1. **端口被占用**
   ```powershell
   # 查看端口 3003 是否被占用
   netstat -ano | findstr ":3003"
   
   # 结束占用进程
   taskkill /PID <进程ID> /F
   ```

2. **Node.js 版本问题**
   ```powershell
   # 使用 nvm-windows 管理 Node.js 版本
   # 下载: https://github.com/coreybutler/nvm-windows
   nvm install 20
   nvm use 20
   ```

3. **权限错误**
   - 以管理员身份运行 PowerShell
   - 或使用 `Set-ExecutionPolicy RemoteSigned`

### macOS

1. **端口被占用**
   ```bash
   # 查看端口 3003 是否被占用
   lsof -i :3003
   
   # 结束占用进程
   kill -9 <进程ID>
   ```

2. **Node.js 版本问题**
   ```bash
   # 使用 nvm 管理 Node.js 版本
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   nvm use 20
   ```

3. **权限错误**
   ```bash
   # 如果遇到 EACCES 错误
   sudo chown -R $(whoami) ~/.npm
   ```

### 通用问题

1. **AI 功能不可用**
   - 检查 `.env.local` 中的 `GEMINI_API_KEY`
   - 确认网络连接
   - 查看浏览器控制台错误

2. **词典服务器无法启动**
   - 检查端口 3003 是否被占用
   - 确认 SQLite 数据库文件存在
   - 查看服务器日志

3. **构建失败**
   ```bash
   # 清理缓存后重试
   rm -rf node_modules
   npm install
   ```

## 📈 性能优化

### 已完成优化
- ✅ **查询缓存**：高频单词的本地缓存
- ✅ **去重算法**：防止重复条目显示
- ✅ **懒加载**：按需加载词典数据
- ✅ **智能排序**：优先显示最相关条目

### 计划优化
- 🔄 **预加载**：常见单词的预先加载
- 🔄 **压缩传输**：响应数据压缩
- 🔄 **增量更新**：词典数据增量同步

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范
- 使用 TypeScript 严格模式
- 遵循现有代码风格
- 添加适当的注释
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- **德语词典数据**：基于开源词典项目
- **AI提供商**：Google Gemini, DeepSeek
- **开源社区**：React, TypeScript, Vite 等

## 📞 支持与反馈

如有问题或建议，请：
1. 查看 [Issues](https://github.com/your-repo/issues)
2. 提交详细的问题描述
3. 附上相关截图或日志

---

**Luminous Lute** - 让德语学习更智能、更高效 ✨