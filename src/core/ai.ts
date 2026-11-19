import { getAccountToken, getAppConfig } from "./ipc";

export type AIProviderId =
  "openai" | "openrouter" | "gemini" | "anthropic" | "bedrock" | "groq" | "ai";

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-4o-mini",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultEndpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-haiku-20241022",
  },
  bedrock: {
    id: "bedrock",
    name: "AWS Bedrock",
    defaultEndpoint:
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-5-haiku-20241022-v1:0/invoke",
    defaultModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
  },
  groq: {
    id: "groq",
    name: "Groq",
    defaultEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  ai: {
    id: "ai",
    name: "Custom AI",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
  },
};

export interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  apiKey?: string | undefined;
  model?: string | undefined;
  endpoint?: string | undefined;
}

export async function resolveActiveAI(options?: Partial<AICallOptions>): Promise<{
  provider: AIProviderId;
  token: string;
  endpoint: string;
  model: string;
}> {
  // 1. If explicit apiKey passed in widget options
  if (options?.apiKey?.trim()) {
    const key = options.apiKey.trim();
    let detectedProvider: AIProviderId = "openai";
    if (key.startsWith("sk-ant-")) detectedProvider = "anthropic";
    else if (key.startsWith("sk-or-")) detectedProvider = "openrouter";
    else if (key.startsWith("AIza")) detectedProvider = "gemini";
    else if (key.startsWith("gsk_")) detectedProvider = "groq";

    const cfg = AI_PROVIDERS[detectedProvider];
    return {
      provider: detectedProvider,
      token: key,
      endpoint: options.endpoint || cfg.defaultEndpoint,
      model: options.model || cfg.defaultModel,
    };
  }

  // 2. Fetch app config to check for defaultAiProvider preference
  let preferred: string | undefined;
  try {
    const appConfig = await getAppConfig();
    preferred = appConfig.app.defaultAiProvider;
  } catch {
    // Ignore config load error
  }

  // If a specific provider is preferred and not "auto"
  if (preferred && preferred !== "auto" && preferred in AI_PROVIDERS) {
    const pId = preferred as AIProviderId;
    const token = await getAccountToken(pId).catch(() => null);
    if (token && token.trim()) {
      const cfg = AI_PROVIDERS[pId];
      let customEndpoint = options?.endpoint;
      if (!customEndpoint && pId === "bedrock") {
        const ep = await getAccountToken("bedrock_endpoint").catch(() => null);
        if (ep) customEndpoint = ep.trim();
      }
      return {
        provider: pId,
        token: token.trim(),
        endpoint: customEndpoint || cfg.defaultEndpoint,
        model: options?.model || cfg.defaultModel,
      };
    }
  }

  // 3. Auto-pick: scan configured providers in order of priority
  const scanOrder: AIProviderId[] = [
    "openai",
    "openrouter",
    "gemini",
    "anthropic",
    "groq",
    "bedrock",
    "ai",
  ];

  for (const pId of scanOrder) {
    const token = await getAccountToken(pId).catch(() => null);
    if (token && token.trim()) {
      const cfg = AI_PROVIDERS[pId];
      let customEndpoint = options?.endpoint;
      if (!customEndpoint && pId === "bedrock") {
        const ep = await getAccountToken("bedrock_endpoint").catch(() => null);
        if (ep) customEndpoint = ep.trim();
      }
      return {
        provider: pId,
        token: token.trim(),
        endpoint: customEndpoint || cfg.defaultEndpoint,
        model: options?.model || cfg.defaultModel,
      };
    }
  }

  throw new Error(
    "No AI API key found. Add an API key for OpenAI, OpenRouter, Google Gemini, Anthropic, AWS Bedrock, or Groq in Settings (Accounts).",
  );
}

export async function callAI(options: AICallOptions): Promise<string> {
  const resolved = await resolveActiveAI(options);

  if (resolved.provider === "anthropic") {
    const res = await fetch(resolved.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": resolved.token,
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      },
      body: JSON.stringify({
        model: resolved.model,
        max_tokens: options.maxTokens,
        system: options.systemPrompt,
        messages: [{ role: "user", content: options.userPrompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      let errMsg = `Anthropic Error (${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch {
        // Ignored
      }
      throw new Error(errMsg);
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const content = data?.content?.[0]?.text;
    if (!content) throw new Error("Anthropic returned empty response");
    return content.trim();
  }

  // All other providers use standard OpenAI chat completions format
  let endpoint = resolved.endpoint.trim().replace(/\/+$/, "");
  if (resolved.provider === "openai" || resolved.provider === "ai") {
    if (!endpoint.endsWith("/chat/completions")) {
      endpoint = `${endpoint}/chat/completions`;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolved.token}`,
  };

  if (resolved.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/hasanify/nook";
    headers["X-Title"] = "Nook Desktop Widgets";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: resolved.model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      max_tokens: options.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    let errMsg = `${AI_PROVIDERS[resolved.provider].name} Error (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${AI_PROVIDERS[resolved.provider].name} returned empty response`);
  }

  return content.trim();
}
