
/**
 * 浏览器端测试词典数据导入 - Sa
 * 生成自: public/test-dictionary-data.json
 */

import { browserDictionaryService } from '../services/browserDictionaryService';

// 测试数据
const TEST_DATA = [
  {
    "word": "पद्धति",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "पद् (pad, “foot”) + हति (hati, “stroke, blow”), with internal sandhi of the ह (ha).",
    "pronunciation": "/pɐd.dʱɐ.ti/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "a \"foot-stroke\", a way, path, course, line",
        "example": ""
      },
      {
        "gloss": "a sign, token",
        "example": ""
      },
      {
        "gloss": "name of a class of writings (described as guidebooks or manuals for particular rites and ceremonies and the texts relating to them) and of several works",
        "example": ""
      }
    ]
  },
  {
    "word": "ධීර",
    "lang_code": "Sanskrit",
    "pos": "adj",
    "etymology_text": "",
    "pronunciation": "",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "Sinhalese script form of धीर (“firm”)",
        "example": ""
      }
    ]
  },
  {
    "word": "गन्तास्मस्",
    "lang_code": "Sanskrit",
    "pos": "verb",
    "etymology_text": "",
    "pronunciation": "/ɡɐn.tɑːs.mɐs/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "periphrastic future first-person plural of गम् (gam)",
        "example": ""
      }
    ]
  },
  {
    "word": "नष्ट",
    "lang_code": "Sanskrit",
    "pos": "verb",
    "etymology_text": "From Proto-Indo-Aryan *naṣṭás, from Proto-Indo-Iranian *naštás, from Proto-Indo-European *neḱ-tós, from *neḱ- (“to perish, disappear”). Cognate to Avestan 𐬥𐬀𐬱𐬙𐬀 (našta).",
    "pronunciation": "/nɐʂ.ʈɐ́/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "past passive participle of नश् (naś, “to perish, disappear”)",
        "example": ""
      }
    ]
  },
  {
    "word": "अन्तरीय",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "",
    "pronunciation": "",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "lower garment",
        "example": ""
      }
    ]
  },
  {
    "word": "विवाह",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "Etymology tree\nProto-Indo-European *wí\nSanskrit वि- (vi-)\nProto-Indo-European *weǵʰ-\nProto-Indo-Iranian *waȷ́ʰ-\nSanskrit वह् (vah)\nSanskrit वाह (vāha)\nSanskrit विवाह\nFrom वि- (vi-, “away”) + वाह (vāha, “taking, carrying”), literally “leading away [the bride]”.",
    "pronunciation": "/ʋi.ʋɑː.ɦɐ́/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "marriage; marriage with (with instrumental case, with or without सह (saha))",
        "example": ""
      },
      {
        "gloss": "vehicle",
        "example": ""
      }
    ]
  },
  {
    "word": "ऋभुणा",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "",
    "pronunciation": "",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "instrumental singular of ऋभु (ṛbhu)",
        "example": ""
      }
    ]
  },
  {
    "word": "रक्षित",
    "lang_code": "Sanskrit",
    "pos": "adj",
    "etymology_text": "Etymology tree\nProto-Indo-European *h₂lek-\nSanskrit रक्ष् (rakṣ)\nProto-Indo-European *-tós\nProto-Indo-Iranian *-tás\nSanskrit -इत (-ita)\nSanskrit र॒क्षि॒त\nFrom रक्ष् (rakṣ) + -इत (-ita).",
    "pronunciation": "/ɾɐk.ʂi.tɐ́/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "protected, guarded, saved, preserved",
        "example": ""
      }
    ]
  },
  {
    "word": "त्वं",
    "lang_code": "Sanskrit",
    "pos": "pron",
    "etymology_text": "",
    "pronunciation": "/tʋɐm/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "combining form of त्वम् (tvam)",
        "example": ""
      }
    ]
  },
  {
    "word": "क्षत्र",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "From Proto-Indo-Aryan *kṣatrám, from Proto-Indo-Iranian *kšatrám, possibly from Proto-Indo-European *tek- (“to obtain”). Cognate with Avestan 𐬑𐬱𐬀𐬚𐬭𐬀 (xšaθra, “kingdom”), Bactrian ϸαο (šao), Old Persian 𐎧𐏁𐏂𐎶 (xšaça-, “kingdom, realm”), whence Persian شَهر (šahr), and Old Armenian աշխարհ (ašxarh).",
    "pronunciation": "/kʂɐt.ɾɐ́/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "dominion, supremacy, power, might",
        "example": ""
      },
      {
        "gloss": "government, governing body",
        "example": ""
      },
      {
        "gloss": "kshatriya",
        "example": ""
      }
    ]
  },
  {
    "word": "जीवापित",
    "lang_code": "Sanskrit",
    "pos": "verb",
    "etymology_text": "",
    "pronunciation": "/d͡ʑiː.ʋɑː.pi.tɐ/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "causative past participle of जीव् (jīv); restored to life",
        "example": ""
      }
    ]
  },
  {
    "word": "धनम्",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "",
    "pronunciation": "/dʱɐ́.nɐm/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "neuter nominative/accusative singular of धन (dhána, “wealth, treasure”)",
        "example": ""
      }
    ]
  },
  {
    "word": "प्राणिन्",
    "lang_code": "Sanskrit",
    "pos": "adj",
    "etymology_text": "From प्राण (prāṇá, “breath”) + -इन् (-ín, “possessor”).",
    "pronunciation": "/pɾɑː.ɳín/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "breathing, living, alive",
        "example": ""
      }
    ]
  },
  {
    "word": "भिक्षुणी",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "भिक्षु (bhikṣu) + -णी (-ṇī).",
    "pronunciation": "",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "Buddhist nun",
        "example": ""
      }
    ]
  },
  {
    "word": "अवि",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "From Proto-Indo-Aryan *Háwiṣ, from Proto-Indo-Iranian *Háwiš, from Proto-Indo-European *h₂ówis. Cognate with Latin ovis, Hittite 𒇻𒅖 (ḫāwis), and Old English eowu (whence English ewe).",
    "pronunciation": "/ɐ́.ʋi/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "sheep (mentioned with reference to its wool being used for the soma strainer)",
        "example": ""
      },
      {
        "gloss": "the woollen soma strainer",
        "example": ""
      }
    ]
  },
  {
    "word": "प्रायश्चित्त",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "प्रायश् (prāyaś) + चित्त (citta)",
    "pronunciation": "",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "atonement, expiation, repentance",
        "example": ""
      }
    ]
  },
  {
    "word": "उच्च",
    "lang_code": "Sanskrit",
    "pos": "adj",
    "etymology_text": "From उच्चा (uccā́); ultimately from Proto-Indo-European *úds-kʷeh₁.",
    "pronunciation": "/ut.t͡ɕɐ/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "deep (Caurap.)",
        "example": ""
      },
      {
        "gloss": "high, elevated",
        "example": ""
      },
      {
        "gloss": "intense, violent",
        "example": ""
      },
      {
        "gloss": "loud (Bhartṛ., VarBṛS.)",
        "example": ""
      },
      {
        "gloss": "tall",
        "example": ""
      }
    ]
  },
  {
    "word": "दुष्",
    "lang_code": "Sanskrit",
    "pos": "root",
    "etymology_text": "From Proto-Indo-European *dus- (“bad”). Cognate with Ancient Greek δυσ- (dus-) whence English dys-.",
    "pronunciation": "/duʂ/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "to be defiled, impure",
        "example": ""
      },
      {
        "gloss": "to be ruined, perish",
        "example": ""
      },
      {
        "gloss": "to become bad, corrupted",
        "example": ""
      },
      {
        "gloss": "to sin",
        "example": ""
      }
    ]
  },
  {
    "word": "राहु",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "From the root रभ् (rabh, “to grasp”).",
    "pronunciation": "/ɾɑː.ɦu/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "Rahu, one of the Navagrahas.",
        "example": ""
      },
      {
        "gloss": "an eclipse or (rather) the moment of the beginning of an occultation or obscuration",
        "example": ""
      }
    ]
  },
  {
    "word": "व्रिश्",
    "lang_code": "Sanskrit",
    "pos": "noun",
    "etymology_text": "Borrowed from Dravidian; ultimately from Proto-Dravidian *wir-.",
    "pronunciation": "/ʋɾiɕ/",
    "synonyms": [],
    "antonyms": [],
    "senses": [
      {
        "gloss": "fingers",
        "example": ""
      }
    ]
  }
];

/**
 * 导入测试数据到IndexedDB
 */
export async function importTestDictionaryData() {
  try {
    console.log('开始导入Sa测试词典数据...');
    
    // 清空现有数据
    await browserDictionaryService.clearDatabase();
    
    // 导入测试数据
    const success = await browserDictionaryService.importData(TEST_DATA);
    
    if (success) {
      console.log(`成功导入 ${TEST_DATA.length} 个Sa测试词条`);
      
      // 验证导入
      const testWords = ["\u092a\u0926\u094d\u0927\u0924\u093f", "\u0db0\u0dd3\u0dbb", "\u0917\u0928\u094d\u0924\u093e\u0938\u094d\u092e\u0938\u094d", "\u0928\u0937\u094d\u091f", "\u0905\u0928\u094d\u0924\u0930\u0940\u092f"];
      for (const word of testWords) {
        const result = await browserDictionaryService.queryDictionary(word, { 
          id: 'sa', 
          name: 'Sa' 
        });
        if (result.success && result.entries.length > 0) {
          console.log(`✓ "${word}" 查询成功`);
        } else {
          console.log(`✗ "${word}" 未找到`);
        }
      }
      
      return true;
    } else {
      console.error('导入测试数据失败');
      return false;
    }
    
  } catch (error) {
    console.error('导入测试词典数据失败:', error);
    return false;
  }
}

/**
 * 检查是否需要导入数据
 */
export async function checkAndImportDictionaryData() {
  try {
    // 检查当前有多少词条
    const wordCount = await browserDictionaryService.getWordCount('sa');
    
    if (wordCount < 10) {  // 如果词条太少，导入测试数据
      console.log(`Sa词典只有 ${wordCount} 个词条，导入测试数据...`);
      return await importTestDictionaryData();
    } else {
      console.log(`Sa词典已有 ${wordCount} 个词条，跳过导入`);
      return true;
    }
    
  } catch (error) {
    console.error('检查词典数据失败:', error);
    return false;
  }
}
