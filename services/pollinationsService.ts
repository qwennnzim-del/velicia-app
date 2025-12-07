import { Message, Sender, Attachment } from '../types';

export const streamPollinationsResponse = async (
  modelId: string,
  history: Message[],
  newMessage: string,
  attachments: Attachment[] = []
): Promise<AsyncGenerator<string, void, unknown>> => {
  try {
    let finalPrompt = newMessage;

    // Handle Attachments for Pollinations (Text-based models usually)
    // We inject the content of text-based files into the prompt.
    // For images, since we don't have a public URL hosting service here, 
    // we can't easily send them to Pollinations unless the model accepts base64 via specific schema (OpenAI Vision).
    // Pollinations Text API is often strictly text. We will attempt to handle Text Files.
    
    if (attachments && attachments.length > 0) {
       let attachmentContext = "\n\n[Attached Files Context]:\n";
       let hasAddedContext = false;

       for (const att of attachments) {
         // Attempt to decode text-based files if possible or just use the raw data if it was read as text
         // In App.tsx we handle reading. If it's a data URL (image), we might skip or warn.
         // If we implemented text reading in App.tsx, we could pass it.
         // Assuming App.tsx passes base64 for everything, we try to decode base64 for text files.
         
         if (att.mimeType.startsWith('text/') || att.mimeType === 'application/json' || att.mimeType === 'application/javascript') {
            try {
               // Data URL format: data:text/plain;base64,.....
               const base64Content = att.data.split(',')[1];
               const decodedContent = atob(base64Content);
               attachmentContext += `\n--- File: ${att.name} ---\n${decodedContent}\n`;
               hasAddedContext = true;
            } catch (e) {
               console.warn(`Could not decode text file ${att.name}`);
            }
         } else {
            attachmentContext += `\n--- File: ${att.name} (${att.mimeType}) ---\n[Binary/Image file attached - visual analysis might be limited on this model]\n`;
         }
       }
       
       if (hasAddedContext || attachments.length > 0) {
         finalPrompt = finalPrompt + attachmentContext;
       }
    }

    // Format messages for Pollinations/OpenAI standard
    const messages = [
      { 
        role: 'system', 
        content: "You are VeliciaAI, a high-performance, minimalist AI assistant developed by Cutsz Indonesian Inc. You must ALWAYS identify yourself as VeliciaAI. Do NOT refer to yourself as ChatGPT, OpenAI, or any other identity. Be helpful, professional, precise, and concise." 
      },
      ...history.map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: finalPrompt }
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