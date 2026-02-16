
import { GoogleGenAI, Type } from "@google/genai";
import { AIConfig, GeminiSuggestion } from "../types";
import { queryWiktionary, getWiktionaryUrl, WiktionaryResponse } from "./wiktionaryService";

/**
 * 将语言名称映射到语言代码
 */
const getLanguageCode = (languageName: string): string => {
  const mapping: Record<string, string> = {
    'german': 'de',
    'german (germany)': 'de',
    'deutsch': 'de',
    'english': 'en',
    'spanish': 'es',
    'french': 'fr',
    'chinese': 'zh',
    'japanese': 'ja',
    'korean': 'ko',
    'russian': 'ru',
    'italian': 'it',
    'portuguese': 'pt',
    'dutch': 'nl',
    'polish': 'pl',
    'swedish': 'sv',
    'danish': 'da',
    'finnish': 'fi',
    'norwegian': 'no',
    'turkish': 'tr',
    'arabic': 'ar',
    'hindi': 'hi',
    'thai': 'th',
    'vietnamese': 'vi'
  };
  
  const normalized = languageName.toLowerCase().trim();
  return mapping[normalized] || 'en'; // 默认英语
};

export const analyzeTerm = async (
  term: string,
  context: string,
  languageName: string,
  config: AIConfig,
  options?: { signal?: AbortSignal }
): Promise<GeminiSuggestion> => {
  const signal = options?.signal;
  
  // 创建语言对象（简化版）
  const language = {
    id: getLanguageCode(languageName),
    name: languageName,
    dictionaryUrl: `https://en.wiktionary.org/wiki/###`
  };
  
  console.debug('[llmService] analyzeTerm called:', { 
    term, 
    language: language.name,
    languageCode: language.id,
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKeys?.[config.provider],
    baseUrl: config.baseUrl 
  });
  
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  
  // 第一步：尝试从Wiktionary获取权威数据
  console.debug('[llmService] Step 1: Querying Wiktionary for authoritative data');
  let wiktionaryData: WiktionaryResponse | null = null;
  
  try {
    wiktionaryData = await queryWiktionary(term, language);
    console.debug('[llmService] Wiktionary response:', {
      success: wiktionaryData.success,
      entriesCount: wiktionaryData.entries.length,
      hasTranslations: wiktionaryData.entries.some(e => e.translations.length > 0)
    });
  } catch (error) {
    console.debug('[llmService] Wiktionary query failed:', error);
  }
  
  // 第二步：基于Wiktionary数据构建prompt
  let prompt: string;
  
  if (wiktionaryData?.success && wiktionaryData.entries.length > 0) {
    // 使用Wiktionary数据构建增强prompt
    const entry = wiktionaryData.entries[0];
    const wiktionaryTranslations = entry.translations.join(', ');
    const wiktionaryDefinitions = entry.definitions.join('\n- ');
    
    prompt = `WIKTIONARY-BASED LINGUISTIC ANALYSIS

WORD: "${term}"
SENTENCE CONTEXT: "${context}"
LANGUAGE: ${language.name}

WIKTIONARY DATA (AUTHORITATIVE SOURCE):
${wiktionaryDefinitions ? `Definitions:\n- ${wiktionaryDefinitions}` : 'No definitions found'}
${wiktionaryTranslations ? `Translations: ${wiktionaryTranslations}` : 'No translations found'}

TASK: Based on the Wiktionary data above, provide a complete linguistic analysis.

INSTRUCTIONS:
1. **DEFINITION**: Provide the primary English definition(s) based on Wiktionary data. If Wiktionary has definitions, use those. If not, provide your best definition.
2. **GRAMMAR**: Provide detailed grammatical analysis for this word in this context.
3. **ROOT WORD**: Identify the dictionary form.
4. **EXAMPLES**: Provide 2 natural example sentences in ${language.name}.

CRITICAL: The definition MUST be based on Wiktionary data when available.

RETURN JSON with: definition, grammar, rootWord, examples`;
  } else {
    // 回退到标准prompt
    prompt = `LINGUISTIC ANALYSIS TASK

WORD: "${term}"
SENTENCE: "${context}"
LANGUAGE: ${language.name}

INSTRUCTIONS:
1. Provide the primary English definition(s) for this word
2. Give detailed grammatical analysis
3. Identify dictionary form (root word)
4. Provide 2 example sentences in ${language.name}

RETURN JSON with: definition, grammar, rootWord, examples`;
  }
  
  // 添加Wiktionary URL作为来源
  const wiktionaryUrl = await getWiktionaryUrl(term, language);
  
  console.debug('[llmService] Final prompt length:', prompt.length);
  console.debug('[llmService] Wiktionary URL:', wiktionaryUrl);
  
  // 继续原有的API调用逻辑...

  if (config.provider === 'gemini') {
    console.debug('[llmService] Using Gemini provider');
    const apiKey = config.apiKeys?.['gemini'] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[llmService] Gemini API key missing');
      throw new Error('Gemini API key is required. Please add it in Settings > AI Engine.');
    }
    console.debug('[llmService] Gemini API key found, length:', apiKey.length);
    const ai = new GoogleGenAI({ apiKey });
    let response;
    try {
      // Gemini-specific prompt with search instructions
      const geminiPrompt = `DICTIONARY-BASED LINGUISTIC ANALYSIS

WORD: "${term}"
SENTENCE: "${context}"
LANGUAGE: ${language}

INSTRUCTIONS:
1. USE GOOGLE SEARCH to look up "${term}" in ${language} dictionaries (Duden for German, RAE for Spanish, etc.)
2. Find authoritative dictionary definitions and primary translations
3. Based on search results, provide the most accurate English translation for this context
4. Include detailed grammatical analysis
5. Identify dictionary form (root word)
6. Provide 2 usage examples

RETURN JSON with: translation, grammar, rootWord, examples

Search query should be: "${term} ${language} dictionary definition translation"`;

      response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: geminiPrompt,
        config: {
          tools: [{ googleSearch: {} }], // Enable Search Grounding
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translation: { 
                type: Type.STRING,
                description: "English translation based on dictionary lookup"
              },
              grammar: { 
                type: Type.STRING,
                description: "Grammatical analysis based on dictionary information"
              },
              rootWord: { 
                type: Type.STRING, 
                description: "Dictionary form from authoritative sources"
              },
              examples: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Usage examples from dictionary or corpus"
              }
            },
            required: ["translation", "grammar", "rootWord", "examples"]
          }
        }
      });
    } catch (error) {
      console.error('[llmService] Gemini API call failed:', error);
      if (error instanceof Error && error.message.includes('API key')) {
        throw new Error('Invalid Gemini API key. Please check your API key in Settings > AI Engine.');
      }
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.debug('[llmService] Gemini response received:', {
      hasText: !!response.text,
      textLength: response.text?.length,
      candidates: response.candidates?.length
    });

     let suggestion;
    try {
      // Clean markdown code blocks from Gemini response
      let cleanedText = response.text || "{}";
      if (cleanedText.includes('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      } else if (cleanedText.includes('```')) {
        cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      }
      suggestion = JSON.parse(cleanedText);
      console.debug('[llmService] Gemini suggestion keys:', Object.keys(suggestion));
      console.debug('[llmService] Gemini response parsed successfully:', {
        hasTranslation: !!suggestion.translation,
        hasGrammar: !!suggestion.grammar,
        hasRootWord: !!suggestion.rootWord,
        examplesCount: suggestion.examples?.length || 0
      });
    } catch (error) {
      console.error("[llmService] Failed to parse Gemini response:", error);
      suggestion = {
        translation: "Parse error",
        grammar: "Could not parse AI response",
        rootWord: term,
        examples: []
      };
    }

    // Ensure required fields exist
    if (!suggestion.translation) suggestion.translation = "No translation provided";
    if (!suggestion.grammar) suggestion.grammar = "No grammar analysis provided";
    if (!suggestion.rootWord) suggestion.rootWord = term;
    if (!suggestion.examples) suggestion.examples = [];

    // Extract grounding sources if available
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      suggestion.sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title);
    }

    console.debug('[llmService] Returning Gemini suggestion');
    
    // Normalize response structure for all providers
    const result = {
      translation: String(suggestion.translation || ''),
      grammar: suggestion.grammar, // Can be string or object
      rootWord: String(suggestion.rootWord || ''),
      examples: Array.isArray(suggestion.examples) ? suggestion.examples.map(e => String(e || '')) : [],
      sources: suggestion.sources || []
    };
    
         // 不再自动添加Wiktionary来源，因为已经在UI中单独显示
    
    return result;
  } else {
    console.debug('[llmService] Using other provider:', config.provider);
    const baseUrl = config.baseUrl || (
      config.provider === 'ollama' ? 'http://localhost:11434/v1' :
      config.provider === 'deepseek' ? 'https://api.deepseek.com/v1' :
      config.provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' :
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );
    
    console.debug('[llmService] Using baseUrl:', baseUrl);

    const envApiKey = config.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY :
                      config.provider === 'aliyun' ? process.env.ALIYUN_API_KEY :
                      config.provider === 'qwen' ? process.env.QWEN_API_KEY :
                      config.provider === 'ollama' ? process.env.OLLAMA_API_KEY || '' :
                      process.env.API_KEY;
    
    const apiKey = config.apiKeys?.[config.provider] || envApiKey;
    console.debug('[llmService] API key status:', {
      fromConfig: !!config.apiKeys?.[config.provider],
      fromEnv: !!envApiKey,
      apiKeyLength: apiKey?.length || 0
    });
    
    // Check API key for providers that require it (except Ollama which can be local)
    if (config.provider !== 'ollama' && !apiKey) {
      throw new Error(`${config.provider} API key is required. Please add it in Settings > AI Engine.`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

      try {
        console.debug('[llmService] Making API request to:', `${baseUrl}/chat/completions`);
        console.debug('[llmService] Request headers:', {
          ...headers,
          Authorization: headers.Authorization ? `Bearer ${apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4) : 'None'}` : 'None'
        });
        console.debug('[llmService] Request payload:', {
          model: config.model,
          messageCount: 2,
          promptLength: prompt.length,
          provider: config.provider,
          baseUrl,
          signalPresent: !!signal
        });
        
        console.debug('[llmService] Starting fetch request...');
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: 'You are a linguistic expert helper. Always return valid JSON following the schema for language learning analysis.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,  // 降低随机性，提高一致性
            max_tokens: 500    // 限制响应长度，加快响应
          })
        });
        const endTime = Date.now();
        console.debug('[llmService] Fetch completed, duration:', endTime - startTime, 'ms');

      if (!response.ok) {
        let errorMessage = `AI Provider Error (${config.provider}): ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } catch {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

       const data = await response.json();
       console.debug('[llmService] API response received:', {
         status: response.status,
         hasData: !!data,
         hasChoices: !!data.choices,
         choicesCount: data.choices?.length
       });
      
      // Validate response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        console.error('[llmService] Invalid API response structure:', data);
        throw new Error(`Invalid API response structure from ${config.provider}`);
      }
      
       const content = data.choices[0].message.content;
       console.debug('[llmService] Response content length:', content.length);
       console.debug('[llmService] Raw response content (first 500 chars):', content.substring(0, 500));
        
        // Clean markdown code blocks from response
        let cleanedContent = content;
        if (cleanedContent.includes('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        } else if (cleanedContent.includes('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        }
        
        let suggestion;
        try {
          suggestion = JSON.parse(cleanedContent);
          console.debug('[llmService] Suggestion keys:', Object.keys(suggestion));
          console.debug('[llmService] Full suggestion object:', suggestion);
          
          // Normalize DeepSeek response structure
          if (config.provider === 'deepseek') {
            console.debug('[llmService] Normalizing DeepSeek response...');
            // Check for definition field first
            if (suggestion.definition && !suggestion.translation) {
              console.debug('[llmService] Using definition as translation');
              suggestion.translation = suggestion.definition;
            } else if (suggestion.englishTranslation && !suggestion.translation) {
              console.debug('[llmService] Using englishTranslation as translation');
              suggestion.translation = suggestion.englishTranslation;
            }
            if (suggestion.fullInfinitive && !suggestion.rootWord) {
              console.debug('[llmService] Using fullInfinitive as rootWord');
              suggestion.rootWord = suggestion.fullInfinitive;
            }
          }
          
          console.debug('[llmService] Response parsed successfully:', {
            provider: config.provider,
            hasTranslation: !!suggestion.translation,
            translation: suggestion.translation,
            hasGrammar: !!suggestion.grammar,
            grammarType: typeof suggestion.grammar,
            hasRootWord: !!suggestion.rootWord,
            rootWord: suggestion.rootWord,
            examplesCount: suggestion.examples?.length || 0
          });
        } catch (error) {
          console.error(`[llmService] Failed to parse ${config.provider} response:`, error);
          suggestion = {
            translation: "Parse error",
            grammar: "Could not parse AI response",
            rootWord: term,
            examples: []
          };
        }
        
         // Ensure required fields exist and are strings
         if (!suggestion.translation) {
           // If we have definition but no translation, use definition
           if (suggestion.definition) {
             suggestion.translation = suggestion.definition;
           } else {
             suggestion.translation = "No definition provided";
           }
         }
         if (!suggestion.grammar) suggestion.grammar = "No grammar analysis provided";
         if (!suggestion.rootWord) suggestion.rootWord = term;
         if (!suggestion.examples) suggestion.examples = [];
         
         // Normalize response structure for all providers
         const result = {
           translation: String(suggestion.translation || ''),
           grammar: suggestion.grammar, // Can be string or object
           rootWord: String(suggestion.rootWord || ''),
           examples: Array.isArray(suggestion.examples) ? suggestion.examples.map(e => String(e || '')) : [],
           sources: suggestion.sources || []
         };
        
        // 添加Wiktionary作为来源
        const wiktionaryUrl = await getWiktionaryUrl(term, language);
        if (!result.sources.some(s => s.uri === wiktionaryUrl)) {
          result.sources.push({
            uri: wiktionaryUrl,
            title: `Wiktionary: ${term}`
          });
        }
        
        console.debug('[llmService] Returning suggestion from', config.provider);
        return result;
     } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.debug('[llmService] Request aborted');
        throw error;
      }
      
      console.error(`[llmService] Error calling ${config.provider} API:`, error);
      
      // Provide more helpful error messages
      let errorMessage = `Failed to connect to ${config.provider} AI service`;
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = `Network error: Cannot connect to ${config.provider} API. Check your internet connection and CORS settings.`;
        if (config.provider === 'ollama' && baseUrl.includes('localhost')) {
          errorMessage += ' Make sure Ollama is running locally at http://localhost:11434.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }
};
