import { Message, Sender, Attachment } from '../types';

const HF_TOKEN = process.env.HF_TOKEN;

const MODELS_MAP: Record<string, string> = {
  // Switched to 32B Qwen variant for better stability on free tier
  'hf_deepseek': 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
  // Switched to Flux Schnell for hyper-fast generation (avoids timeouts)
  'hf_sd35': 'black-forest-labs/FLUX.1-schnell',
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

  // === IMAGE GENERATION (Flux Schnell) ===
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
           if (response.status === 503) {
             throw new Error("Velicia Realism (Flux) is warming up. Please try again in 10 seconds.");
           }
           // Check for common fetch errors
           if (response.status === 401) {
             throw new Error("Invalid Hugging Face Token.");
           }
           throw new Error(`HF Error (${response.status}): ${err}`);
        }

        const blob = await response.blob();
        
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        yield `![Generated Image](${dataUrl})`;

      } catch (error: any) {
        console.error("HF Image Gen Error:", error);
        // Fallback message for fetch failures (CORS/Network)
        if (error.message === 'Failed to fetch') {
            yield "Error: Connection failed. This usually happens if the model is busy or your network blocked the request. Please try again.";
        } else {
            yield `Error generating image: ${error.message}`;
        }
      }
    }
    return imageGenerator();
  }

  // === TEXT GENERATION (DeepSeek R1 - Qwen 32B) ===
  
  // 1. Prepare Prompt with Velicia Identity
  const systemPrompt = "You are VeliciaAI, a high-performance, minimalist AI assistant developed by Cutsz Indonesian Inc. You must ALWAYS identify yourself as VeliciaAI. Do NOT refer to yourself as DeepSeek, Qwen, or any other identity. Be helpful, professional, precise, and concise.";
  
  // Construct prompt for chat models
  let fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
  
  for (const msg of history) {
    const role = msg.sender === Sender.USER ? 'user' : 'assistant';
    fullPrompt += `<|im_start|>${role}\n${msg.text}<|im_end|>\n`;
  }
  
  // Add attachments context
  let finalMessage = newMessage;
  if (attachments.length > 0) {
      finalMessage += "\n[Context: The user has attached files, but I cannot view them directly. I should ask them to describe the file content if needed.]";
  }

  fullPrompt += `<|im_start|>user\n${finalMessage}<|im_end|>\n<|im_start|>assistant\n`;

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
          temperature: 0.6,
          return_full_text: false,
          stream: true 
        }
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        if (response.status === 503) {
            throw new Error("Velicia DeepThink is warming up. Please wait 10s.");
        }
        if (response.status === 429) {
            throw new Error("Rate limit reached. Please wait a moment.");
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
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr) {
              try {
                const json = JSON.parse(jsonStr);
                const text = json.token?.text || json.generated_text || "";
                if (text && text !== '<|endoftext|>' && text !== '<|im_end|>') {
                   yield text;
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }
    }

    return generator();

  } catch (error: any) {
    console.error("HF Service Error:", error);
    async function* errorGen() {
        if (error.message === 'Failed to fetch') {
            yield "Error: Network request failed. The model might be busy or unreachable. Please try again.";
        } else {
            yield `Error: ${error.message}`;
        }
    }
    return errorGen();
  }
};