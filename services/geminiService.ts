import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Sender, Attachment } from '../types';

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
  newMessage: string,
  attachments: Attachment[] = []
): Promise<AsyncGenerator<string, void, unknown>> => {
  try {
    const ai = getAIClient();
    
    // Convert app history to Gemini format
    const previousHistory = history.map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: modelId,
      history: previousHistory,
      config: {
        // System instruction for persona - STRICT IDENTITY ENFORCEMENT
        systemInstruction: "You are VeliciaAI, a high-performance, minimalist AI assistant developed by Cutsz Indonesian Inc. You must ALWAYS identify yourself as VeliciaAI. Do NOT refer to yourself as Gemini, Google's AI, or any other identity. Be helpful, professional, precise, and concise.",
      }
    });

    // Prepare current message content
    // If there are attachments, we need to send a complex object with parts
    let messageContent: any = newMessage;

    if (attachments && attachments.length > 0) {
      const parts = [];
      
      // Add attachments
      for (const att of attachments) {
        // Remove data:image/png;base64, prefix
        const base64Data = att.data.split(',')[1];
        
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: base64Data
          }
        });
      }

      // Add text prompt
      if (newMessage.trim()) {
        parts.push({ text: newMessage });
      }

      messageContent = { parts };
    }

    const result = await chat.sendMessageStream({ message: messageContent });

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