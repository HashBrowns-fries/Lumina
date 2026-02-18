# 词典数据管理指南

## 概述

Luminous Lute 现在支持动态语言发现和统一命名约定的词典数据库。系统会自动扫描 `dict/` 目录下的所有语言数据库文件，无需手动配置。

## 文件命名约定

推荐使用以下命名约定：

```
dict/{LanguageName}/{iso_code}_dict.db
```

例如：
- `dict/German/de_dict.db` - 德语词典
- `dict/Sanskrit/sa_dict.db` - 梵语词典
- `dict/English/en_dict.db` - 英语词典

系统也兼容旧格式：
- `dict/German/german_dict.db` - 会自动映射到 `de`

## 支持的ISO语言代码

系统支持以下ISO语言代码：

| ISO代码 | 语言名称 | 示例文件名 |
|---------|----------|------------|
| de | German | `de_dict.db` |
| en | English | `en_dict.db` |
| es | Spanish | `es_dict.db` |
| fr | French | `fr_dict.db` |
| it | Italian | `it_dict.db` |
| pt | Portuguese | `pt_dict.db` |
| ru | Russian | `ru_dict.db` |
| zh | Chinese | `zh_dict.db` |
| ja | Japanese | `ja_dict.db` |
| ko | Korean | `ko_dict.db` |
| ar | Arabic | `ar_dict.db` |
| nl | Dutch | `nl_dict.db` |
| pl | Polish | `pl_dict.db` |
| sv | Swedish | `sv_dict.db` |
| da | Danish | `da_dict.db` |
| fi | Finnish | `fi_dict.db` |
| no | Norwegian | `no_dict.db` |
| la | Latin | `la_dict.db` |
| tr | Turkish | `tr_dict.db` |
| el | Greek | `el_dict.db` |
| he | Hebrew | `he_dict.db` |
| hi | Hindi | `hi_dict.db` |
| sa | Sanskrit | `sa_dict.db` |
| th | Thai | `th_dict.db` |
| vi | Vietnamese | `vi_dict.db` |

## 如何添加新语言词典

### 方法1：使用转换脚本（推荐）

1. 从 [kaikki.org](https://kaikki.org/dictionary/) 下载相应语言的JSONL文件
2. 运行转换脚本：

```bash
cd scripts
python convert_jsonl_to_sqlite.py kaikki.org-dictionary-English.jsonl en
```

脚本会自动：
- 创建 `dict/English/` 目录
- 生成 `en_dict.db` 数据库文件
- 使用ISO代码 `en` 注册语言

### 方法2：手动放置数据库文件

1. 将数据库文件按正确命名约定放入 `dict/` 目录：
   ```
   dict/{LanguageName}/{iso_code}_dict.db
   ```

2. 重启服务器，系统会自动发现新语言

## API端点

### 获取可用语言列表
```
GET /api/dictionary/languages
```

响应示例：
```json
{
  "success": true,
  "languages": [
    {
      "code": "de",
      "name": "German",
      "hasLocal": true,
      "wordCount": 364332,
      "senseCount": 952074,
      "formCount": 3634687,
      "path": "E:\\luminous-lute\\dict\\German\\de_dict.db"
    },
    {
      "code": "sa",
      "name": "Sanskrit",
      "hasLocal": true,
      "wordCount": 13909,
      "senseCount": 29429,
      "formCount": 482794,
      "path": "E:\\luminous-lute\\dict\\Sanskrit\\sa_dict.db"
    }
  ],
  "total": 2,
  "timestamp": "2026-02-18T03:37:50.988Z"
}
```

### 获取所有词典统计
```
GET /api/dictionary/stats
```

### 查询单词
```
GET /api/dictionary/query/{languageCode}/{word}
```

例如：
```
GET /api/dictionary/query/de/Haus
GET /api/dictionary/query/sa/पद्धति
```

## 前端集成

前端可以通过以下方式获取可用语言列表：

```javascript
// 获取可用语言
const response = await fetch('http://localhost:3006/api/dictionary/languages');
const data = await response.json();

if (data.success) {
  const availableLanguages = data.languages;
  // 显示语言选择器
}
```

## 故障排除

### 问题1：语言未被发现
- 检查数据库文件命名是否正确：`{iso_code}_dict.db`
- 检查文件是否在正确的目录：`dict/{LanguageName}/`
- 检查文件权限：确保服务器可以读取文件

### 问题2：查询返回错误
- 检查语言代码是否正确（小写，如 `de`, `en`, `sa`）
- 检查服务器日志中的错误信息

### 问题3：数据库损坏
- 尝试重新生成数据库文件
- 使用 `sqlite3` 命令行工具检查数据库完整性

## 维护脚本

### 列出所有词典
```bash
python scripts/manage_dictionaries.py list
```

### 添加新词典
```bash
python scripts/manage_dictionaries.py add <jsonl_file> <iso_code>
```

### 删除词典
```bash
python scripts/manage_dictionaries.py remove <iso_code>
```

### 检查词典完整性
```bash
python scripts/manage_dictionaries.py check <iso_code>
```

## 目录结构示例

```
dict/
├── German/
│   ├── de_dict.db
│   ├── de_dict.db-shm
│   └── de_dict.db-wal
├── Sanskrit/
│   ├── sa_dict.db
│   ├── sa_dict.db-shm
│   └── sa_dict.db-wal
├── English/
│   └── en_dict.db
└── French/
    └── fr_dict.db
```

## 注意事项

1. 数据库文件可能很大（几百MB），确保有足够的磁盘空间
2. 首次查询某种语言时，数据库连接可能需要几秒钟建立
3. 系统使用缓存提高查询性能，缓存时间为5分钟
4. 支持的最大缓存条目数为1000

## 前端词典管理界面

Luminous Lute 现在包含一个完整的前端词典管理界面，可以在应用的设置页面中找到。

### 功能特性

1. **词典概览**
   - 显示所有可用的本地词典
   - 实时统计信息（词条数、词义数、词形数）
   - 词典文件大小和路径信息

2. **添加新词典**
   - 三种添加方式：
     - **转换JSONL文件**：上传kaikki.org的JSONL文件并转换为SQLite格式
     - **上传SQLite数据库**：直接上传预转换的SQLite数据库文件
     - **下载指南**：提供kaikki.org下载链接和说明

3. **词典管理**
   - 查看词典详细信息
   - 删除不再需要的词典
   - 实时刷新词典列表

4. **服务器状态监控**
   - 显示后端服务器连接状态
   - 错误处理和重试机制
   - 最后更新时间戳

### 访问方式

1. 启动Luminous Lute应用
2. 点击顶部导航栏的设置图标（⚙️）
3. 在设置页面中找到"Dictionary Management"卡片
4. 确保后端服务器运行在 http://localhost:3006

### 界面元素

- **统计卡片**：显示词典总数、总词条数、总词义数、总词形数
- **词典列表**：每个词典显示语言代码、名称、大小和状态
- **添加按钮**：打开添加词典表单
- **刷新按钮**：重新加载词典信息
- **服务器状态指示器**：显示连接状态

## 常见错误

### 错误1: "name 'language_code' is not defined"
**原因**: 转换脚本中的变量名错误
**解决方案**: 
1. 更新到最新版本的 `convert_jsonl_to_sqlite.py`
2. 或手动修复：将第381行的 `language_code` 改为 `iso_code`

### 错误2: "第 {line_num} 行JSON解析错误"
**原因**: JSONL文件格式不正确或损坏
**解决方案**: 
1. 重新下载kaikki.org词典文件
2. 检查文件编码是否为UTF-8
3. 确保文件完整，没有截断

### 错误3: 服务器连接失败
**原因**: 后端服务器未运行或端口被占用
**解决方案**:
1. 检查服务器是否启动：`cd server && npm run dev`
2. 检查端口3006是否被占用：`netstat -ano | findstr :3006`
3. 停止占用进程或修改服务器端口

### 错误4: 数据库文件锁定
**原因**: 数据库文件被其他进程占用
**解决方案**:
1. 关闭所有使用该数据库的应用程序
2. 删除数据库的 `-shm` 和 `-wal` 临时文件
3. 重启应用程序

## 未来增强

1. 自动从kaikki.org下载词典数据
2. 词典版本管理和更新
3. 词典数据压缩和优化
4. 多语言用户界面支持
5. 批量词典导入/导出功能