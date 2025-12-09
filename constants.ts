
export const APP_NAME = "VeliciaAI";
export const APP_VERSION = "Version 1.0";
export const COPYRIGHT_TEXT = "2025 Cutsz Indonesian Inc.";

export const MODELS = [
  // Utama - Text Reasoning (OpenAI via Pollinations)
  { 
    id: 'openai', 
    name: 'Velicia X4.2',
    description: 'Advanced reasoning, coding, research, search.'
  },
  // Generasi Gambar (Flux via Pollinations)
  { 
    id: 'flux', 
    name: 'Velicia Canvas',
    description: 'High-quality AI image generation model.'
  },
  // Google Model (Gemini)
  { 
    id: 'gemini-2.5-flash', 
    name: 'Velicia X3.5',
    description: 'Fastest model, suitable for daily tasks.'
  },
  // Hugging Face Models (Direct API)
  {
    id: 'hf_deepseek',
    name: 'Velicia DeepThink R1',
    description: 'Deep reasoning & logic (DeepSeek 32B).'
  },
  {
    id: 'hf_sd35',
    name: 'Velicia Realism',
    description: 'Hyper-fast photorealistic generation (Flux Schnell).'
  }
];

export const DEFAULT_MODEL = 'openai';