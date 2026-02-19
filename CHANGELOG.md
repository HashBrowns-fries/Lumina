# Luminous Lute - Language Learning Reader

## Recent Updates (2025-02-19)

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

### v1.0.0 (2025-01-XX)
- Initial release
- PDF/EPUB/Text reading
- Vocabulary building with spaced repetition
- Wiktionary integration
- AI-powered analysis
- Multi-language support
- Theme customization
