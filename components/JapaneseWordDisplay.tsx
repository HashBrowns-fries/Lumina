// @ts-nocheck
import React, { useMemo } from 'react';
import { BookOpen, Volume2, Layers, Quote, Info, Tag } from 'lucide-react';
import { WiktionaryEntry } from '../services/wiktionaryService.ts';

interface ThemeClasses {
  bg: string; text: string; border: string;
  cardBg: string; hoverBg: string;
  mutedText: string; mutedBg: string;
  accentBg: string; accentText: string;
}

interface JapaneseWordDisplayProps {
  entries: WiktionaryEntry[];
  word: string;
  theme: ThemeClasses;
  nagisaPos?: string | null;
}

function parseTags(tagsStr?: string): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return tagsStr.split(/[,|]/).map(s => s.trim()).filter(Boolean);
}

const META_KEYWORDS = ['table-tags', 'inflection-template', 'class', 'Unicode', 'Hira=', 'Kana=', 'head-form'];
function isMetadataForm(tags: string[]): boolean {
  return tags.some(t => META_KEYWORDS.some(kw => t.includes(kw)));
}

function isKana(str: string): boolean {
  return /^[぀-ゟ゠-ヿㇰ-ㇿ･-ﾟー]+$/.test(str);
}

function isRomaji(str: string): boolean {
  return /^[a-zA-Zāīūēō]+$/.test(str);
}

function hasKanji(str: string): boolean {
  return /[一-鿿㐀-䶿]/.test(str);
}

interface FormTriple {
  kanji: string | null;
  kana: string | null;
  romaji: string | null;
}

interface ConjugationRow {
  label: string;
  labelJa: string;
  variants: FormTriple[];
  extra: string[];
}

function romajiToHiragana(romaji: string): string {
  const map: Record<string, string> = {
    'a':'あ','i':'い','u':'う','e':'え','o':'お',
    'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
    'sa':'さ','shi':'し','si':'し','su':'す','se':'せ','so':'そ',
    'ta':'た','chi':'ち','ti':'ち','tsu':'つ','tu':'つ','te':'て','to':'と',
    'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
    'ha':'は','hi':'ひ','fu':'ふ','hu':'ふ','he':'へ','ho':'ほ',
    'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
    'ya':'や','yu':'ゆ','yo':'よ',
    'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
    'wa':'わ','wi':'ゐ','we':'ゑ','wo':'を','n':'ん',
    'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
    'za':'ざ','ji':'じ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
    'da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど',
    'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
    'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
    'kya':'きゃ','kyu':'きゅ','kyo':'きょ',
    'sha':'しゃ','shu':'しゅ','sho':'しょ',
    'cha':'ちゃ','chu':'ちゅ','cho':'ちょ',
    'nya':'にゃ','nyu':'にゅ','nyo':'にょ',
    'hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ',
    'mya':'みゃ','myu':'みゅ','myo':'みょ',
    'rya':'りゃ','ryu':'りゅ','ryo':'りょ',
    'gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ',
    'ja':'じゃ','ju':'じゅ','jo':'じょ',
    'bya':'びゃ','byu':'びゅ','byo':'びょ',
    'pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ',
  };
  let result = '';
  let i = 0;
  const s = romaji.toLowerCase().replace(/ō/g,'ou').replace(/ū/g,'uu').replace(/ā/g,'aa').replace(/ī/g,'ii').replace(/ē/g,'ei');
  while (i < s.length) {
    // Double consonant → っ
    if (i + 1 < s.length && s[i] === s[i+1] && !'aiueon'.includes(s[i])) {
      result += 'っ'; i++; continue;
    }
    let matched = false;
    for (const len of [3, 2, 1]) {
      const chunk = s.substring(i, i + len);
      if (map[chunk]) { result += map[chunk]; i += len; matched = true; break; }
    }
    if (!matched) { result += s[i]; i++; }
  }
  return result;
}

function getReading(entries: WiktionaryEntry[]): string | null {
  for (const entry of entries) {
    if (!entry.inflectionForms) continue;
    // 1) Verb conjugation kana: terminative form in kana (e.g. たべる)
    for (const f of entry.inflectionForms) {
      const tags = parseTags(f.tags);
      if (tags.includes('terminative') && f.form && isKana(f.form)) {
        return f.form;
      }
    }
    // 2) Explicit hiragana tag or canonical kana form
    for (const f of entry.inflectionForms) {
      const tags = parseTags(f.tags);
      if ((tags.includes('hiragana') || tags.includes('historical')) && f.form && isKana(f.form) && f.form !== entry.word) {
        return f.form;
      }
    }
  }

  // 3) For nouns/single kanji: convert romanization to hiragana
  for (const entry of entries) {
    if (!entry.inflectionForms) continue;
    if (entry.partOfSpeech === 'character' || entry.partOfSpeech === 'name') continue;
    for (const f of entry.inflectionForms) {
      const tags = parseTags(f.tags);
      if (tags.includes('romanization') && f.form && isRomaji(f.form) && !f.form.includes('-')) {
        const hira = romajiToHiragana(f.form);
        if (hira && hira !== entry.word) return hira;
      }
    }
  }

  // 4) Extract kana from character entry definitions like "road, way (みち)"
  for (const entry of entries) {
    if (entry.partOfSpeech === 'character' && entry.definitions) {
      for (const def of entry.definitions) {
        const m = def.match(/\(([ぁ-ゟァ-ヿー]+)\)/);
        if (m) return m[1];
      }
    }
  }

  return null;
}

function getVerbType(entries: WiktionaryEntry[]): string | null {
  for (const entry of entries) {
    if (!entry.inflectionForms) continue;
    for (const f of entry.inflectionForms) {
      const tags = parseTags(f.tags);
      if (tags.includes('canonical') && f.form && !isKana(f.form) && !isRomaji(f.form)) {
        // e.g. "食べる transitive ichidan" or "走る intransitive godan"
        const parts = f.form.split(/\s+/).slice(1);
        if (parts.length > 0) return parts.join(' ');
      }
    }
  }
  return null;
}

const CONJ_ORDER: Array<{ key: string; label: string; labelJa: string; match: (tags: string[]) => boolean }> = [
  { key: 'imperfective', label: 'Imperfective', labelJa: '未然形', match: t => t.includes('imperfective') },
  { key: 'continuative', label: 'Continuative', labelJa: '連用形', match: t => t.includes('continuative') || t.includes('conjunctive') },
  { key: 'terminative', label: 'Terminal', labelJa: '終止形', match: t => t.includes('terminative') },
  { key: 'attributive', label: 'Attributive', labelJa: '連体形', match: t => t.includes('attributive') },
  { key: 'hypothetical', label: 'Conditional', labelJa: '仮定形', match: t => t.includes('hypothetical') || t.includes('conditional') || t.includes('provisional') },
  { key: 'imperative', label: 'Imperative', labelJa: '命令形', match: t => t.includes('imperative') },
  { key: 'volitional', label: 'Volitional', labelJa: '意志形', match: t => t.includes('volitional') },
  { key: 'passive', label: 'Passive', labelJa: '受身', match: t => t.includes('passive') },
  { key: 'causative', label: 'Causative', labelJa: '使役', match: t => t.includes('causative') },
  { key: 'potential', label: 'Potential', labelJa: '可能', match: t => t.includes('potential') },
];

function buildConjugationTable(inflectionForms: Array<{ form: string; tags?: string }>): ConjugationRow[] {
  const used = new Set<number>();
  const rows: ConjugationRow[] = [];

  for (const conj of CONJ_ORDER) {
    const indices: number[] = [];
    inflectionForms.forEach((f, idx) => {
      if (used.has(idx) || !f.form?.trim()) return;
      const tags = parseTags(f.tags);
      if (isMetadataForm(tags)) { used.add(idx); return; }
      if (tags.includes('romanization') || tags.includes('canonical')) return;
      if (conj.match(tags)) indices.push(idx);
    });

    if (indices.length === 0) continue;

    // Group by extra qualifiers (e.g. "colloquial", "literary")
    const byQualifier = new Map<string, { kanji: string | null; kana: string | null; romaji: string | null }>();

    for (const idx of indices) {
      const f = inflectionForms[idx];
      const tags = parseTags(f.tags);
      const qualifier = tags.filter(t =>
        !['imperfective', 'continuative', 'conjunctive', 'terminative', 'attributive',
          'hypothetical', 'conditional', 'provisional', 'imperative', 'volitional',
          'passive', 'causative', 'potential', 'negative', 'past', 'formal', 'stem'].includes(t)
      ).sort().join(',') || '_default';

      if (!byQualifier.has(qualifier)) byQualifier.set(qualifier, { kanji: null, kana: null, romaji: null });
      const triple = byQualifier.get(qualifier)!;

      if (isRomaji(f.form)) {
        triple.romaji = f.form;
      } else if (isKana(f.form)) {
        triple.kana = f.form;
      } else {
        triple.kanji = f.form;
      }
      used.add(idx);
    }

    const variants: FormTriple[] = [];
    const extra: string[] = [];
    for (const [qual, triple] of byQualifier) {
      variants.push(triple);
      if (qual !== '_default') extra.push(qual);
    }

    rows.push({ label: conj.label, labelJa: conj.labelJa, variants, extra });
  }

  return rows;
}

const JP_FONT = { fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif' };

const JapaneseWordDisplay: React.FC<JapaneseWordDisplayProps> = ({ entries, word, theme, nagisaPos }) => {
  const primaryEntry = entries[0];
  const allEntries = entries;

  const reading = useMemo(() => getReading(allEntries), [allEntries]);
  const verbType = useMemo(() => getVerbType(allEntries), [allEntries]);

  const allDefinitions = useMemo(() => {
    const defs: Array<{ def: string; pos?: string }> = [];
    const seen = new Set<string>();
    for (const e of allEntries) {
      for (const d of (e.definitions || [])) {
        if (d && !seen.has(d)) { seen.add(d); defs.push({ def: d, pos: e.partOfSpeech }); }
      }
    }
    return defs;
  }, [allEntries]);

  const allExamples = useMemo(() => {
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const e of allEntries) {
      for (const ex of (e.examples || [])) {
        if (ex && !seen.has(ex)) { seen.add(ex); examples.push(ex); }
      }
    }
    return examples;
  }, [allEntries]);

  const conjugationRows = useMemo(() => {
    const allForms: Array<{ form: string; tags?: string }> = [];
    for (const e of allEntries) {
      if (e.inflectionForms) allForms.push(...e.inflectionForms);
    }
    return buildConjugationTable(allForms);
  }, [allEntries]);

  const etymology = primaryEntry?.etymology;
  const pronunciation = primaryEntry?.pronunciation;

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <div className={`${theme.cardBg} rounded-2xl overflow-hidden border-2 border-rose-400/30 shadow-md`}>
        <div className="bg-rose-500/10 px-4 py-3 border-b border-rose-400/20">
          {/* Word + Reading as ruby-style */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {reading && (
                <span className="text-xs text-rose-400 tracking-widest mb-0.5" style={JP_FONT}>
                  {reading}
                </span>
              )}
              <span className={`text-2xl font-bold ${theme.text}`} style={JP_FONT}>
                {primaryEntry?.word || word}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {nagisaPos && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-600 border border-rose-200">
                  {nagisaPos}
                </span>
              )}
              {verbType && (
                <span className={`text-[10px] ${theme.mutedText} italic`}>
                  {verbType}
                </span>
              )}
            </div>
          </div>
          {/* POS + IPA */}
          <div className="flex items-center gap-3 mt-1.5">
            {primaryEntry?.partOfSpeech && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.accentText}`}>
                {primaryEntry.partOfSpeech}
              </span>
            )}
            {pronunciation && (
              <span className={`text-xs ${theme.mutedText} font-mono flex items-center gap-1`}>
                <Volume2 size={10} />
                {pronunciation.replace(/^\[|\]$/g, '')}
              </span>
            )}
          </div>
        </div>

        {/* Definitions */}
        {allDefinitions.length > 0 && (
          <div className="px-4 py-3">
            <div className="space-y-1.5">
              {allDefinitions.slice(0, 8).map((d, i) => (
                <div key={i} className={`text-sm leading-relaxed ${theme.text}`}>
                  <span className="font-bold text-rose-400 mr-2">{i + 1}.</span>
                  {d.def}
                  {d.pos && allDefinitions.length > 1 && i > 0 && d.pos !== allDefinitions[0].pos && (
                    <span className={`ml-2 text-[9px] ${theme.mutedText} uppercase`}>({d.pos})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Examples */}
      {allExamples.length > 0 && (
        <div className={`${theme.cardBg} rounded-2xl overflow-hidden border ${theme.border} shadow-sm`}>
          <div className="px-4 py-2 border-b border-rose-200/50 flex items-center gap-2">
            <Quote size={14} className="text-rose-400" />
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Examples</span>
            <span className={`text-[10px] ${theme.mutedText}`}>例文</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {allExamples.slice(0, 5).map((ex, i) => (
              <div key={i} className={`text-sm ${theme.text} leading-relaxed`} style={JP_FONT}>
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conjugation Table — 3-column: kanji / kana / romaji */}
      {conjugationRows.length > 0 && (
        <div className={`${theme.cardBg} rounded-2xl overflow-hidden border-2 border-sky-400/30 shadow-sm`}>
          <div className="bg-sky-500/10 px-4 py-2 border-b border-sky-400/20 flex items-center gap-2">
            <Layers size={14} className="text-sky-500" />
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Conjugation</span>
            <span className={`text-[10px] ${theme.mutedText}`}>活用表</span>
          </div>
          <div className="px-2 py-2 overflow-x-auto">
            <table className="w-full text-xs" style={JP_FONT}>
              <thead>
                <tr className={`${theme.mutedText} text-[9px] uppercase tracking-wider`}>
                  <th className="text-left py-1 px-2 font-bold">Form</th>
                  <th className="text-left py-1 px-2 font-bold">漢字</th>
                  <th className="text-left py-1 px-2 font-bold">かな</th>
                  <th className="text-left py-1 px-2 font-bold">Romaji</th>
                </tr>
              </thead>
              <tbody>
                {conjugationRows.map((row) => (
                  row.variants.map((v, vi) => (
                    <tr key={`${row.label}-${vi}`} className={`border-t ${theme.border}`}>
                      {vi === 0 ? (
                        <td className="py-1.5 px-2 align-top" rowSpan={row.variants.length}>
                          <div className="text-[10px] font-bold text-sky-600">{row.label}</div>
                          <div className={`text-[9px] ${theme.mutedText}`}>{row.labelJa}</div>
                          {row.extra.length > 0 && row.extra[0] !== '_default' && (
                            <div className="text-[8px] text-amber-500 mt-0.5">{row.extra.join(', ')}</div>
                          )}
                        </td>
                      ) : null}
                      <td className={`py-1.5 px-2 font-medium ${theme.text}`}>
                        {v.kanji && (
                          <span className={v.kanji === word ? 'text-sky-500 font-bold' : ''}>
                            {v.kanji}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-rose-400">
                        {v.kana || ''}
                      </td>
                      <td className={`py-1.5 px-2 ${theme.mutedText} font-mono text-[10px]`}>
                        {v.romaji || ''}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Etymology */}
      {etymology && (
        <div className={`${theme.cardBg} rounded-2xl overflow-hidden border ${theme.border} shadow-sm`}>
          <div className="px-4 py-2 border-b border-amber-200/50 flex items-center gap-2">
            <Info size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Etymology</span>
            <span className={`text-[10px] ${theme.mutedText}`}>語源</span>
          </div>
          <div className="px-4 py-3">
            <p className={`text-sm leading-relaxed ${theme.mutedText}`}>{etymology}</p>
          </div>
        </div>
      )}

      {/* Multiple entries indicator */}
      {allEntries.length > 1 && (
        <div className={`text-center text-[10px] ${theme.mutedText} flex items-center justify-center gap-1`}>
          <Tag size={10} />
          {allEntries.length} dictionary entries
        </div>
      )}
    </div>
  );
};

export default JapaneseWordDisplay;
