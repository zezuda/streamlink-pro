
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "../types";

// Always use the API key from environment variables directly as per SDK guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getChatInsights = async (messages: ChatMessage[]) => {
  if (messages.length === 0) return null;

  const chatTranscript = messages.map(m => `[${m.platform}] ${m.author}: ${m.text}`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following live stream chat transcript. 
      1. Summarize the general sentiment.
      2. Identify the top 3 most interesting questions or topics being discussed.
      3. Flag any potential toxicity if present.
      
      Transcript:
      ${chatTranscript}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING },
            topTopics: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            toxicityLevel: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
