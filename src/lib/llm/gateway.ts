import { completeOpenRouter, streamOpenRouter } from "@/lib/llm/providers/openrouter";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object";
};

function getProvider() {
  return process.env.LLM_PROVIDER ?? "openrouter";
}

export function getLLMModel(options?: LLMOptions) {
  switch (getProvider()) {
    case "openrouter":
      return options?.model ?? process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
    default:
      throw new Error(`Unsupported LLM provider: ${getProvider()}`);
  }
}

export async function streamLLMResponse(messages: ChatMessage[], options?: LLMOptions): Promise<ReadableStream<Uint8Array>> {
  switch (getProvider()) {
    case "openrouter":
      return streamOpenRouter(messages, options);
    default:
      throw new Error(`Unsupported LLM provider: ${getProvider()}`);
  }
}

export async function completeLLMResponse(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
  switch (getProvider()) {
    case "openrouter":
      return completeOpenRouter(messages, options);
    default:
      throw new Error(`Unsupported LLM provider: ${getProvider()}`);
  }
}
