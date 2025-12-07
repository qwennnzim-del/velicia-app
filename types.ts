export enum Sender {
  USER = 'user',
  BOT = 'model',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ModelConfig {
  id: string;
  name: string;
}
