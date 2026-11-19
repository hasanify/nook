import { getAccountToken } from "./ipc";

export interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  apiKey?: string | undefined;
  model?: string | undefined;
  endpoint?: string | undefined;
}

export async function callAI(options: AICallOptions): Promise<string> {
  let token = options.apiKey?.trim();
  if (!token) {
    const aiKey = await getAccountToken("ai").catch(() => null);
    const openaiKey = await getAccountToken("openai").catch(() => null);
    token = (aiKey || openaiKey || "").trim();
  }

  if (!token) {
    throw new Error(
      "No AI API key found. Add your API key in Settings (Accounts) or widget settings.",
    );
  }

  let baseUrl = (options.endpoint || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  if (!baseUrl.endsWith("/chat/completions")) {
    baseUrl = `${baseUrl}/chat/completions`;
  }

  const model = (options.model || "gpt-4o-mini").trim();

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      max_tokens: options.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    let errMsg = `AI Request Failed (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI returned empty response");
  }

  return content.trim();
}
