import { Message, Sender, Attachment } from '../types';

const HF_TOKEN = process.env.HF_TOKEN;

const MODELS_MAP: Record<string, string> = {
  'hf_deepseek': 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  'hf_sd35': 'stabilityai/stable-diffusion-3.5-large',
};

export const streamHuggingFaceResponse = async (
  modelId: string,
  history: Message[],
  newMessage: string,
  attachments: Attachment[] = []
): Promise<AsyncGenerator<string, void, unknown>> => {
  
  if (!HF_TOKEN) {
    throw new Error("Hugging Face Token is missing. Please check your settings.");
  }

  const hfModel = MODELS_MAP[modelId];
  const url = `https://api-inference.huggingface.co/models/${hfModel}`;

  // === IMAGE GENERATION (Stable Diffusion) ===
  if (modelId === 'hf_sd35') {
    async function* imageGenerator() {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: newMessage }),
        });

        if (!response.ok) {
           const err = await response.text();
           // Handle "Model is loading" 503 error
           if (response.status === 503) {
             throw new Error("Velicia Realism is warming up (Cold Boot). Please try again in 30 seconds.");
           }
           throw new Error(`HF Error: ${err}`);
        }

        const blob = await response.blob();
        
        // Fix: Use FileReader to convert Blob to Data URL (Browser compatible replacement for Buffer)
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        yield `![Generated Image](${dataUrl})`;

      } catch (error: any) {
        yield `Error generating image: ${error.message}`;
      }
    }
    return imageGenerator();
  }

  // === TEXT GENERATION (DeepSeek R1) ===
  
  // 1. Prepare Prompt with Velicia Identity
  const systemPrompt = "You are VeliciaAI, a high-performance, minimalist AI assistant developed by Cutsz Indonesian Inc. You must ALWAYS identify yourself as VeliciaAI. Do NOT refer to yourself as DeepSeek, Llama, or any other identity. Be helpful, professional, precise, and concise.";
  
  // Simplified prompt construction for Llama-based models (DeepSeek Distill is Llama based)
  let fullPrompt = `<|system|>\n${systemPrompt}\n`;
  
  for (const msg of history) {
    if (msg.sender === Sender.USER) {
      fullPrompt += `<|user|>\n${msg.text}\n`;
    } else {
      fullPrompt += `<|assistant|>\n${msg.text}\n`;
    }
  }
  
  // Add attachments context if any
  let finalMessage = newMessage;
  if (attachments.length > 0) {
      finalMessage += "\n[Context: The user has attached files, but I cannot view them directly. I should ask them to describe the file content if needed.]";
  }

  fullPrompt += `<|user|>\n${finalMessage}\n<|assistant|>\n`;

  // 2. Fetch Stream
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.7,
          return_full_text: false,
          stream: true 
        }
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        if (response.status === 503) {
            throw new Error("Velicia DeepThink is warming up. Please wait 20s and try again.");
        }
        throw new Error(`HF API Error: ${response.status} - ${errText}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* generator() {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // HF stream data comes as "data: {...}\n\n"
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr) {
              try {
                const json = JSON.parse(jsonStr);
                // DeepSeek/Llama format usually returns 'token' object or 'generated_text'
                const text = json.token?.text || json.generated_text || "";
                if (text && text !== '<|endoftext|>') {
                   yield text;
                }
              } catch (e) {
                // ignore parse error
              }
            }
          }
        }
      }
    }

    return generator();

  } catch (error: any) {
    console.error("HF Service Error:", error);
    // Return a generator that yields the error
    async function* errorGen() {
        yield `Error: ${error.message}`;
    }
    return errorGen();
  }
};