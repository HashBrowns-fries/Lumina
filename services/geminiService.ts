
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiSuggestion } from "../types";

// Note: Use process.env.GEMINI_API_KEY for Gemini API

export const suggestTermInfo = async (term: string, context: string, language: string): Promise<GeminiSuggestion> => {
  // Initialize right before making the call as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Using gemini-3-pro-preview for complex reasoning/linguistic analysis
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Task: Analyze the word "${term}" specifically within this context: "${context}".
Language: ${language}.
Required Information:
1. A concise translation in English.
2. A contextual grammar analysis (e.g., "Third-person singular present form of...", "Masculine plural noun acting as...", "Irregular verb in the subjunctive...").
3. The root word (dictionary/parent form).
4. Two natural example sentences demonstrating common usage.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translation: { type: Type.STRING },
          grammar: { type: Type.STRING, description: "Detailed grammatical breakdown based on the context provided." },
          rootWord: { type: Type.STRING, description: "The base dictionary form of the word." },
          examples: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["translation", "grammar", "examples"],
        propertyOrdering: ["translation", "grammar", "rootWord", "examples"]
      }
    }
  });

  // Accessing text property directly as per guidelines
  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr);
};

export const generateTermImage = async (term: string, translation: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `A clean, minimalist 2D illustrative icon or artistic representation of the concept "${term}" (${translation}). 
  Style: modern, educational, white background, vibrant colors. No text.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      // Correctly identifying image part in inlineData
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("[geminiService] Image generation failed", error);
  }
  return null;
};
