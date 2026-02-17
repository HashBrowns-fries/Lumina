
import { GoogleGenAI, Type } from "@google/genai";
import { AIConfig, GeminiSuggestion } from "../types";
import { queryWiktionary, getWiktionaryUrl, WiktionaryResponse } from "./wiktionaryService.ts";

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
    // 收集所有条目信息
    const entriesInfo = wiktionaryData.entries.map((entry, index) => {
      const pos = entry.partOfSpeech || 'unknown';
      const definitions = entry.definitions.slice(0, 2).join('; ');
      const isInflection = entry.isInflection || false;
      const rootWord = entry.rootWord || entry.word;
      return `Entry ${index + 1}: "${entry.word}" (${pos})${isInflection ? ` [inflection of ${rootWord}]` : ''} - ${definitions || 'No definition'}`;
    }).join('\n');
    
    const firstEntry = wiktionaryData.entries[0];
    const wiktionaryTranslations = firstEntry.translations.join(', ');
    const wiktionaryDefinitions = firstEntry.definitions.join('\n- ');
    const partOfSpeech = firstEntry.partOfSpeech || 'unknown';
    
    prompt = `WIKTIONARY-BASED LINGUISTIC ANALYSIS

WORD: "${term}"
SENTENCE CONTEXT: "${context}"
LANGUAGE: ${language.name}

WIKTIONARY DATA (AUTHORITATIVE SOURCE):
Available dictionary entries:
${entriesInfo}

Primary entry details:
Part of Speech: ${partOfSpeech}
${wiktionaryDefinitions ? `Definitions:\n- ${wiktionaryDefinitions}` : 'No definitions found'}
${wiktionaryTranslations ? `Translations: ${wiktionaryTranslations}` : 'No translations found'}

TASK: Based on the Wiktionary data above AND the sentence context, provide a complete linguistic analysis. 
You MUST analyze the word's actual grammatical function IN THE GIVEN SENTENCE, not just the most common dictionary entry.

CRITICAL CONTEXT ANALYSIS INSTRUCTIONS:
1. **CONTEXT-BASED PART OF SPEECH**: First determine the word's actual part of speech IN THE SENTENCE CONTEXT:
   - Look at grammatical markers: articles (der/die/das/ein), prepositions (am, im, zur, etc.), sentence position
   - For German: Pay special attention to NOUNIZED ADJECTIVES (substantivierte Adjektive) like "der Alte", "das Gute", "die Weisen"
   - If preceded by an article (der/die/das) and capitalized, it's likely a NOUNIZED ADJECTIVE functioning as a noun
   - Example: "der Weisen" in context "am Gespräch der Weisen" = noun (genitive plural of "der Weise")

2. **GRAMMAR ANALYSIS**: Provide detailed grammatical analysis based on ACTUAL CONTEXTUAL FUNCTION:
   - For NOUNS (including nounized adjectives): Analyze case, gender, number
   - For VERBS: Analyze tense, mood, person, number, voice  
   - For ADJECTIVES (attributive): Analyze degree, gender, number, case
   - For ADVERBS: Analyze degree
   - For PRONOUNS: Analyze case, gender, number, person
   - For OTHER: Provide relevant grammatical features

3. **ENTRY SELECTION**: Choose the most appropriate dictionary entry based on context:
   - If multiple entries exist (e.g., adjective "weise" and noun "Weise"), select based on sentence function
   - For "der Weisen": select noun entry (genitive plural of "der Weise"), NOT adjective "weise"

4. **TRANSLATION**: Provide English translation(s) based on selected dictionary entry. Use Wiktionary translations when available.

5. **EXPLANATION**: Provide a brief, concise explanation of this word in this context (1-2 sentences). Explain its grammatical function and meaning in the given sentence.

6. **ROOT WORD**: Identify dictionary form (lemma) of the selected entry.

7. **EXAMPLES**: Provide 2 natural example sentences in ${language.name} showing similar usage.

RETURN JSON with: translation, grammar, explanation, rootWord, examples`;
  } else {
    // 回退到标准prompt
    prompt = `LINGUISTIC ANALYSIS TASK

WORD: "${term}"
SENTENCE CONTEXT: "${context}"
LANGUAGE: ${language.name}

TASK: Analyze the word's grammatical function IN THE GIVEN SENTENCE CONTEXT, not just its most common dictionary form.

CRITICAL CONTEXT ANALYSIS INSTRUCTIONS:
1. **CONTEXT-BASED PART OF SPEECH**: First determine the word's actual part of speech IN THE SENTENCE:
   - Analyze grammatical markers: articles (der/die/das/ein), prepositions (am, im, zur, etc.), sentence position
   - For German: Pay special attention to NOUNIZED ADJECTIVES (substantivierte Adjektive) like "der Alte", "das Gute", "die Weisen"
   - If preceded by an article (der/die/das) and capitalized, it's likely a NOUNIZED ADJECTIVE functioning as a noun
   - Example: "der Weisen" in context "am Gespräch der Weisen" = noun (genitive plural of "der Weise")

2. **GRAMMAR ANALYSIS**: Provide detailed grammatical analysis based on ACTUAL CONTEXTUAL FUNCTION:
   - For NOUNS (including nounized adjectives): Analyze case, gender, number
   - For VERBS: Analyze tense, mood, person, number, voice  
   - For ADJECTIVES (attributive): Analyze degree, gender, number, case
   - For ADVERBS: Analyze degree
   - For PRONOUNS: Analyze case, gender, number, person
   - For OTHER: Provide relevant grammatical features

3. **TRANSLATION**: Provide primary English translation(s) based on contextual function.

4. **EXPLANATION**: Provide a brief, concise explanation of this word in this context (1-2 sentences). Explain its grammatical function and meaning in the given sentence.

5. **ROOT WORD**: Identify dictionary form (lemma) based on selected analysis.

6. **EXAMPLES**: Provide 2 natural example sentences in ${language.name} showing similar usage.

RETURN JSON with: translation, grammar, explanation, rootWord, examples`;
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
       // Use the same prompt as other providers
      response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
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
               explanation: {
                 type: Type.STRING,
                 description: "Brief explanation of the word in context (1-2 sentences)"
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
             required: ["translation", "grammar", "explanation", "rootWord", "examples"]
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
        explanation: "Could not parse AI response",
        rootWord: term,
        examples: []
      };
    }

    // Ensure required fields exist
    if (!suggestion.translation) suggestion.translation = "No translation provided";
    if (!suggestion.grammar) suggestion.grammar = "No grammar analysis provided";
    if (!suggestion.explanation) suggestion.explanation = "No explanation provided";
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
      explanation: String(suggestion.explanation || ''),
      rootWord: String(suggestion.rootWord || ''),
      examples: Array.isArray(suggestion.examples) ? suggestion.examples.map(e => String(e || '')) : [],
      sources: [] // Sources removed as per user request
    };
    
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
             explanation: "Could not parse AI response",
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
          if (!suggestion.explanation) suggestion.explanation = "No explanation provided";
          if (!suggestion.rootWord) suggestion.rootWord = term;
          if (!suggestion.examples) suggestion.examples = [];
         
           // Normalize response structure for all providers
           const result = {
             translation: String(suggestion.translation || ''),
             grammar: suggestion.grammar, // Can be string or object
             explanation: String(suggestion.explanation || ''),
             rootWord: String(suggestion.rootWord || ''),
             examples: Array.isArray(suggestion.examples) ? suggestion.examples.map(e => String(e || '')) : [],
             sources: [] // Sources removed as per user request
           };
        
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
