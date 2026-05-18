// @ts-nocheck
import {
  loadDefaultJapaneseParser,
  loadDefaultSimplifiedChineseParser,
  loadDefaultTraditionalChineseParser,
} from 'budoux';

const jaParser = loadDefaultJapaneseParser();
const zhSimplifiedParser = loadDefaultSimplifiedChineseParser();
const zhTraditionalParser = loadDefaultTraditionalChineseParser();

function getParser(langId: string) {
  if (langId === 'ja') return jaParser;
  if (langId === 'zh') return zhSimplifiedParser;
  return null;
}

const SCRIPTIO_CONTINUA_REGEX = /[ऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ฀-๿຀-໿က-႟ក-៿]/;

function segmentWithIntl(text: string, locale: string): string[] {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const segments: string[] = [];
    for (const seg of segmenter.segment(text)) {
      if (seg.isWordLike) {
        segments.push(seg.segment);
      } else if (seg.segment.trim()) {
        segments.push(seg.segment);
      }
    }
    return segments;
  }
  return text.match(/\p{L}+/gu) || [text];
}

function tokenizeScriptioContinua(text: string, langId: string): string {
  const segments = segmentWithIntl(text, langId);
  return segments.join(' ');
}

export function tokenizeCJKText(text: string, langId: string): string {
  const parser = getParser(langId);
  if (parser) {
    return parser.parse(text).join(' ');
  }
  return tokenizeScriptioContinua(text, langId);
}

export function tokenizeHtml(html: string, langId: string): string {
  if (!html) return html;

  const parser = getParser(langId);

  return html.replace(/>([^<]+)</g, (match, textContent) => {
    if (!textContent.trim()) return match;
    let tokenized: string;
    if (parser) {
      tokenized = parser.parse(textContent).join(' ');
    } else if (SCRIPTIO_CONTINUA_REGEX.test(textContent)) {
      tokenized = tokenizeScriptioContinua(textContent, langId);
    } else {
      return match;
    }
    return `>${tokenized}<`;
  });
}

const SCRIPTIO_CONTINUA_LANGUAGES = new Set(['ja', 'zh', 'th', 'sa', 'hi', 'km', 'my', 'lo']);

export function needsCJKTokenization(langId: string): boolean {
  return SCRIPTIO_CONTINUA_LANGUAGES.has(langId);
}
