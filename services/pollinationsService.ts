
import { Message, Sender } from '../types';

export const streamPollinationsResponse = async (
  modelId: string,
  history: Message[],
  newMessage: string
): Promise<AsyncGenerator<string, void, unknown>> => {
  try {
    // Format messages for Pollinations/OpenAI standard
    const messages = [
      { 
        role: 'system', 
        content: 'You are VeliciaAI, a helpful, fast, and minimalist AI assistant developed by Cutsz Indonesian Inc. You are professional, concise, and friendly.' 
      },
      ...history.map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: newMessage }
    ];

    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages,
        model: modelId, // openai, claude, deepseek, llama, etc.
        seed: Math.floor(Math.random() * 1000),
        jsonMode: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Pollinations API Error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body from Pollinations");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    async function* generator() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // Pollinations usually returns raw text stream directly
        if (chunk) {
          yield chunk;
        }
      }
    }

    return generator();

  } catch (error) {
    console.error("Pollinations Service Error:", error);
    throw error;
  }
};
