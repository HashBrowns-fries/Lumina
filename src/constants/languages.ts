import { Language } from '../../types';

export const STANDARD_LANGUAGES: Language[] = [
  { id: 'de', name: 'German', dictionaryUrl: 'https://de.wiktionary.org/wiki/###' },
  { id: 'en', name: 'English', dictionaryUrl: 'https://en.wiktionary.org/wiki/###' },
  { id: 'es', name: 'Spanish', dictionaryUrl: 'https://es.wiktionary.org/wiki/###' },
  { id: 'fr', name: 'French', dictionaryUrl: 'https://fr.wiktionary.org/wiki/###' },
  { id: 'it', name: 'Italian', dictionaryUrl: 'https://it.wiktionary.org/wiki/###' },
  { id: 'pt', name: 'Portuguese', dictionaryUrl: 'https://pt.wiktionary.org/wiki/###' },
  { id: 'ru', name: 'Russian', dictionaryUrl: 'https://ru.wiktionary.org/wiki/###' },
  { id: 'zh', name: 'Chinese', dictionaryUrl: 'https://zh.wiktionary.org/wiki/###' },
  { id: 'ja', name: 'Japanese', dictionaryUrl: 'https://ja.wiktionary.org/wiki/###' },
  { id: 'ko', name: 'Korean', dictionaryUrl: 'https://ko.wiktionary.org/wiki/###' },
  { id: 'ar', name: 'Arabic', dictionaryUrl: 'https://ar.wiktionary.org/wiki/###' },
  { id: 'nl', name: 'Dutch', dictionaryUrl: 'https://nl.wiktionary.org/wiki/###' },
  { id: 'pl', name: 'Polish', dictionaryUrl: 'https://pl.wiktionary.org/wiki/###' },
  { id: 'sv', name: 'Swedish', dictionaryUrl: 'https://sv.wiktionary.org/wiki/###' },
  { id: 'da', name: 'Danish', dictionaryUrl: 'https://da.wiktionary.org/wiki/###' },
  { id: 'fi', name: 'Finnish', dictionaryUrl: 'https://fi.wiktionary.org/wiki/###' },
  { id: 'no', name: 'Norwegian', dictionaryUrl: 'https://no.wiktionary.org/wiki/###' },
  { id: 'la', name: 'Latin', dictionaryUrl: 'https://la.wiktionary.org/wiki/###' },
  { id: 'tr', name: 'Turkish', dictionaryUrl: 'https://tr.wiktionary.org/wiki/###' },
  { id: 'el', name: 'Greek', dictionaryUrl: 'https://el.wiktionary.org/wiki/###' },
  { id: 'he', name: 'Hebrew', dictionaryUrl: 'https://he.wiktionary.org/wiki/###' },
  { id: 'hi', name: 'Hindi', dictionaryUrl: 'https://hi.wiktionary.org/wiki/###' },
  { id: 'th', name: 'Thai', dictionaryUrl: 'https://th.wiktionary.org/wiki/###' },
  { id: 'vi', name: 'Vietnamese', dictionaryUrl: 'https://vi.wiktionary.org/wiki/###' }
];

export const DEFAULT_LANGUAGES: Language[] = [
  { id: 'de', name: 'German', dictionaryUrl: 'https://de.wiktionary.org/wiki/###' },
  { id: 'en', name: 'English', dictionaryUrl: 'https://en.wiktionary.org/wiki/###' },
  { id: 'es', name: 'Spanish', dictionaryUrl: 'https://es.wiktionary.org/wiki/###' },
  { id: 'fr', name: 'French', dictionaryUrl: 'https://fr.wiktionary.org/wiki/###' },
  { id: 'zh', name: 'Chinese', dictionaryUrl: 'https://zh.wiktionary.org/wiki/###' }
];

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  'german': 'de',
  'deutsch': 'de',
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'italian': 'it',
  'portuguese': 'pt',
  'russian': 'ru',
  'chinese': 'zh',
  'japanese': 'ja',
  'korean': 'ko',
  'arabic': 'ar',
  'dutch': 'nl',
  'polish': 'pl',
  'swedish': 'sv',
  'danish': 'da',
  'finnish': 'fi',
  'norwegian': 'no',
  'turkish': 'tr',
  'greek': 'el',
  'hebrew': 'he',
  'hindi': 'hi',
  'thai': 'th',
  'vietnamese': 'vi'
};

export function fixLanguageIds(languages: Language[]): Language[] {
  const standardCodes = STANDARD_LANGUAGES.map(lang => lang.id);
  
  return languages.map(lang => {
    const normalizedName = lang.name.toLowerCase().trim();
    
    // If already a standard code, keep as is
    if (standardCodes.includes(lang.id)) {
      return lang;
    }
    
    // If name matches a standard language, fix ID
    if (LANGUAGE_NAME_TO_CODE[normalizedName]) {
      const code = LANGUAGE_NAME_TO_CODE[normalizedName];
      console.log(`Fixing language ID: "${lang.name}" from "${lang.id}" to "${code}"`);
      return {
        ...lang,
        id: code,
        dictionaryUrl: `https://${code}.wiktionary.org/wiki/###`
      };
    }
    
    // Otherwise keep as is
    return lang;
  });
}