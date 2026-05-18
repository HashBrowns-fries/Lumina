# Lumina - Changelog

## v1.6.0 (2026-05-18) - Japanese Support & MiniMax AI

### Added
- **Japanese-specific dictionary display** (`JapaneseWordDisplay.tsx`): dedicated card with furigana-style readings, 3-column conjugation table (kanji/kana/romaji), verb type detection (ichidan/godan/irregular), examples, etymology, and nagisa POS badge
- **nagisa Japanese tokenizer** integration: morphological analysis and POS tagging via Python service (port 3010), auto-started by Tauri
- **4-layer reading extraction** for Japanese words: terminative kana, hiragana/historical tags, romanization-to-hiragana conversion, definition parenthetical kana
- **MiniMax AI provider**: OpenAI-compatible integration with `MiniMax-Text-01` default model
- **Dictionary download API** (`dictionary_download_api.py`): download Kaikki.org English Wiktionary subsets for 20+ languages via HTTP API (port 3011)
- **Kaikki JSONL-to-SQLite converter** (`convert_jsonl_to_sqlite.py`): batch convert downloaded dictionary data
- `nagisaService.ts` with `tokenize()` and `getPos()` methods

### Changed
- **Unified backend architecture**: all dictionary queries now go through HTTP API, removed `isTauri` branching
- AI provider list expanded to 9: Gemini, DeepSeek, Qwen, OpenAI, Ollama, llama.cpp, OpenAI Compatible, MiniMax, Alibaba Cloud
- Reader nagisa paragraph extraction uses proper DOM walking instead of regex tag stripping

### Fixed
- **One-word-per-line rendering** in Japanese reader: `<rt>`/`<rp>` tags were replaced with newlines, causing each word to appear on its own line
- Proper block-level element detection for paragraph breaks

---

## v1.5.0 (2025-04-01) - Code Splitting & Performance

### Added
- Double-click to save words to vocabulary
- uv (modern Python package manager) support
- API keys configured via `.env` file
- Code splitting and lazy loading (72% smaller initial bundle)

### Changed
- Improved floating window UI and save functionality
- Enhanced dictionary query precision

### Fixed
- Dictionary path detection for bundled builds

---

## v1.4.0 (2025-02-23) - Tauri 2.0 + Rust Backend

### 🔄 Major Architecture Changes

#### Migrated to Tauri 2.0 + Rust Backend
- **Complete rewrite** of backend from Node.js to Rust
- **7 new Tauri commands** implemented:
  - `search_dictionary` - Precise dictionary queries
  - `get_available_languages` - List installed dictionaries
  - `get_dictionary_stats` - Dictionary statistics
  - `batch_query_dictionary` - Batch word lookup
  - `upload_dictionary_file` - Import Kaikki SQLite databases
  - `check_python_environment` - Verify Python/Sanskrit API
  - `process_text` - Text processing with Sanskrit support
- **Dictionary management commands**:
  - `rescan_dictionary` - Refresh dictionary index
  - `remove_dictionary` - Remove from index
  - `delete_dictionary_file` - Delete dictionary file

### 🐛 Critical Bug Fixes

#### Dictionary Query Precision
- **Fixed "du" query**: Now returns only "du" (pronoun), not "er" or unrelated words
- **Fixed "mich" query**: Returns only "mich" (pronoun)
- **Fixed "kenntest" query**: Correctly shows as inflection of "kennen"
- **Root cause**: Forms table had corrupted entries with "error-unrecognized-form" tags
- **Solution**: 
  - Reversed search order: dictionary table FIRST, forms table SECOND
  - Added error tag filter: `AND tags NOT LIKE '%error%'`
  - Only use forms table for true inflections when dictionary has no match

#### Directory Lookup
- Fixed `get_dict_dir()` to check multiple locations:
  1. Executable directory (production builds)
  2. Parent directory (development: `target/debug` → project root)
  3. Current directory fallback

#### Data Format Support
- Full Kaikki SQLite format support (`dictionary`, `senses`, `forms`, `sounds` tables)
- Fixed serde field naming: snake_case (Rust) → camelCase (TypeScript)

### 📝 Documentation

- **Rewrote README.md** with:
  - Updated version to 1.4.0
  - Tauri 2.0 + Rust backend description
  - Updated project structure
  - Dictionary directory structure documentation
  - Troubleshooting guide expanded
- **Updated CHANGELOG.md** with v1.4.0 changes

### 🧹 Cleanup

- Removed temporary test files (`temp_*.json`, `test_*.json`)
- Removed debug/explore scripts
- Removed backup files (`*.backup*`)
- Cleaned Python cache (`__pycache__/`)
- Kept `node_modules` and `.venv` for faster rebuilds

### 📦 Build System

- Updated `package.json` version: `1.3.3` → `1.4.0`
- Updated `Cargo.toml` version: `1.3.1` → `1.4.0`
- GitHub Actions workflow ready for `v1.4.0` tag

---

## v1.3.3 (2025-02-22)

### 🕉️ Sanskrit Support

Sanskrit support is a core feature!

- **Dharma Mitra API Integration** - Sanskrit grammar analysis
- **Sandhi Word Segmentation** - Automatic compound word splitting
- **Root Word Lookup** - Dictionary root word search
- **Grammar Analysis** - Part-of-speech tagging, verb conjugation
- **Meaning Extraction** - Multiple meanings display
- **Transliteration Support** - Devanagari, IAST, SLP1, Harvard-Kyoto, ITRANS, WX, Velthuis, ISO 15919
- **Automatic Processing** - Auto-analysis when selecting Sanskrit words

### UI/UX Improvements

#### 1. Dictionary Results - Prominent Display
- Moved Wiktionary results to a separate, prominent section at the top of the sidebar
- Added part of speech filtering (noun, verb, adj, adv)
- Implemented deduplication of entries
- Added visual markers for:
  - Root words (green badge)
  - Variants (amber badge)
  - Inflections (purple badge)
- Enhanced display with:
  - IPA pronunciation
  - Etymology
  - Synonyms and antonyms
  - Usage examples

#### 2. Continue Reading Feature
- Added "Reader" button to navigation bar
- Shows "Continue" badge when there's a last read document
- Clicking continues from the last reading position
- Falls back to most recent document if last read was deleted

#### 3. Theme Unification
- Unified theme colors across all components:
  - TermSidebar
  - LibraryView
  - Navigation bar
- All 7 themes now consistently apply:
  - Light
  - Dark
  - Sepia
  - Night
  - High Contrast
  - Paper
  - Auto

#### 4. Book Cover Display
- Added gradient book covers with depth effect
- Color coding by source type:
  - Rose gradient (PDF)
  - Emerald gradient (EPUB)
  - Indigo gradient (plain text)
- Added shadow and overlay effects

#### 5. Vocabulary Highlighting in Reader
- Fixed term lookup to properly find vocabulary words
- Words in vocabulary are now highlighted based on learning status:
  - Learning1: Rose background
  - Learning2: Orange background
  - Learning3: Amber background
  - Learning4: Lime background
  - WellKnown: Medium weight text
  - Ignored: Strikethrough

### Bug Fixes
- Fixed book card click functionality in Library
- Removed redundant Continue button from book cards
- Various UI refinements

---

## Previous Releases

### v1.1.0
- Complete theming support
- Bug fixes and improvements

### v1.0.0
- Initial release
- PDF/EPUB/Text reading
- Vocabulary building with spaced repetition
- Wiktionary integration
- AI-powered analysis
- Multi-language support
- Theme customization

### 🔥 Sanskrit Support (最重要功能!)

梵语支持是本应用的核心功能!

- **Dharma Mitra API集成** - 梵语语法分析
- **Sandhi分词** - 自动拆分复合词
- **词根查找** - 词典词根查询
- **语法分析** - 词性标注、动词变位
- **含义提取** - 多重含义显示
- **转写方案支持** - Devanagari, IAST, SLP1, Harvard-Kyoto, ITRANS, WX, Velthuis, ISO 15919等
- **自动处理** - 选择梵语词汇时自动分析

### UI/UX Improvements

#### 1. Dictionary Results - Prominent Display
- Moved Wiktionary results to a separate, prominent section at the top of the sidebar
- Added part of speech filtering (noun, verb, adj, adv)
- Implemented deduplication of entries
- Added visual markers for:
  - Root words (green badge)
  - Variants (amber badge)
  - Inflections (purple badge)
- Enhanced display with:
  - IPA pronunciation
  - Etymology
  - Synonyms and antonyms
  - Usage examples

#### 2. Continue Reading Feature
- Added "Reader" button to navigation bar
- Shows "Continue" badge when there's a last read document
- Clicking continues from the last reading position
- Falls back to most recent document if last read was deleted

#### 3. Theme Unification
- Unified theme colors across all components:
  - TermSidebar
  - LibraryView
  - Navigation bar
- All 7 themes now consistently apply:
  - Light
  - Dark
  - Sepia
  - Night
  - High Contrast
  - Paper
  - Auto

#### 4. Book Cover Display
- Added gradient book covers with depth effect
- Color coding by source type:
  - Rose gradient (PDF)
  - Emerald gradient (EPUB)
  - Indigo gradient (plain text)
- Added shadow and overlay effects

#### 5. Vocabulary Highlighting in Reader
- Fixed term lookup to properly find vocabulary words
- Words in vocabulary are now highlighted based on learning status:
  - Learning1: Rose background
  - Learning2: Orange background
  - Learning3: Amber background
  - Learning4: Lime background
  - WellKnown: Medium weight text
  - Ignored: Strikethrough

### Bug Fixes
- Fixed book card click functionality in Library
- Removed redundant Continue button from book cards
- Various UI refinements

---

## Previous Releases

### v1.1.0
- Complete theming support
- Bug fixes and improvements

### v1.0.0
- Initial release
- PDF/EPUB/Text reading
- Vocabulary building with spaced repetition
- Wiktionary integration
- AI-powered analysis
- Multi-language support
- Theme customization
