// Type definitions for Anthropic SDK
export interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;
      temperature?: number;
    }): Promise<{
      content: Array<{
        text: string;
        type: string;
      }>;
    }>;
  };
}

export class Anthropic {
  constructor(config: { apiKey: string });
  messages: AnthropicClient['messages'];
}