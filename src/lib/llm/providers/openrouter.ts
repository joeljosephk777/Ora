import type { ChatMessage, LLMOptions } from "@/lib/llm/gateway";

const defaultModel = "nvidia/nemotron-3-super-120b-a12b:free";
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
};

function getModel(options?: LLMOptions) {
  return options?.model ?? process.env.OPENROUTER_MODEL ?? defaultModel;
}

function getHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/joeljosephk777/Ora",
    "X-Title": "Ora AI Chat",
  };
}

async function callOpenRouter(messages: ChatMessage[], options: LLMOptions | undefined, stream: boolean) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const payload = {
    model: getModel(options),
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? (stream ? 175 : 1000),
    stream,
    ...(options?.responseFormat ? { response_format: { type: options.responseFormat } } : {}),
  };

  const response = await fetch(openRouterUrl, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText || response.statusText}`);
  }

  return response;
}

export async function streamOpenRouter(messages: ChatMessage[], options?: LLMOptions): Promise<ReadableStream<Uint8Array>> {
  const response = await callOpenRouter(messages, options, true);

  if (!response.body) {
    throw new Error("OpenRouter returned an empty stream.");
  }

  return response.body;
}

export async function completeOpenRouter(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
  const response = await callOpenRouter(messages, options, false);
  const payload = (await response.json()) as OpenRouterChunk;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty completion.");
  }

  return content;
}

export function extractOpenRouterStreamText(chunk: string) {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as OpenRouterChunk;
        return parsed.choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    })
    .join("");
}
