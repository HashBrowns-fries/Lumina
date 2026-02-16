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
- Node.js 18+ 
- npm 或 yarn
- Gemini API 密钥（用于AI功能）

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd luminous-lute
   ```

2. **安装依赖**
   ```bash
   # 安装前端依赖
   npm install
   
   # 安装词典服务器依赖
   cd server
   npm install
   cd ..
   ```

3. **环境配置**
   复制 `.env.local.example` 到 `.env.local` 并设置：
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **启动应用**
   ```bash
   # 启动前端开发服务器（端口5173）
   npm run dev
   
    # 在另一个终端启动词典服务器（端口3003）
   cd server
   node index.js
   ```

5. **访问应用**
   打开浏览器访问：http://localhost:5173

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

### 常见问题

1. **词典服务器无法启动**
   ```
    检查端口3003是否被占用：
    netstat -an | findstr ":3003"
    或使用不同端口：
    PORT=3004 node server/index.js
   ```

2. **AI功能不可用**
   - 检查 `.env.local` 中的 `GEMINI_API_KEY`
   - 确认网络连接
   - 查看浏览器控制台错误

3. **词形变化检测不准确**
   - 确保词典服务器运行正常
   - 检查数据库连接
   - 查看服务器日志

### 日志查看
```bash
# 前端日志 - 浏览器开发者工具控制台
# 后端日志 - server/server.log 文件
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