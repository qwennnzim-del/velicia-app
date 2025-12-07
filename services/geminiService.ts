import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Sender } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const streamResponse = async (
  modelId: string,
  history: Message[],
  newMessage: string
): Promise<AsyncGenerator<string, void, unknown>> => {
  try {
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