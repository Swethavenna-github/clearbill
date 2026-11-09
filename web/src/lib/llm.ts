// Small provider wrapper. Today it calls Google Gemini (free tier via AI Studio).
// To switch providers later, only this file changes.
export function llmConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

type Opts = { system?: string; json?: boolean; timeoutMs?: number; temperature?: number };

export async function llmText(prompt: string, opts: Opts = {}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim();
      return text || null;
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function llmJSON<T>(prompt: string, opts: Opts = {}): Promise<T | null> {
  const text = await llmText(prompt, { ...opts, json: true });
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```json\s*|```$/g, "")) as T;
  } catch {
    return null;
  }
}
