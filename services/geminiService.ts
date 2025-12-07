import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Sender } from '../types';

// Lazy initialization to prevent crash on startup if key is missing
let aiInstance: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key is missing. Chat functionality will not work.");
      // We still return an instance, but it will fail on call, preventing white screen on load
      return new GoogleGenAI({ apiKey: "" });
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const streamResponse = async (
  modelId: string,
  history: Message[],
  newMessage: string
): Promise<AsyncGenerator<string, void, unknown>> => {
  try {
    const ai = getAIClient();
    
    // Convert app history to Gemini format
    // Note: We filter out the very last user message because we send it as the `message` arg
    const previousHistory = history.map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: modelId,
      history: previousHistory,
      config: {
        // System instruction for persona
        systemInstruction: "You are VeliciaAI, a helpful, fast, and minimalist AI assistant developed by Cutsz Indonesian Inc.",
      }
    });

    const result = await chat.sendMessageStream({ message: newMessage });

    async function* generator() {
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          yield c.text;
        }
      }
    }

    return generator();

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};