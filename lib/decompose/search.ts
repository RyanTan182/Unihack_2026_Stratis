// lib/decompose/search.ts

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

export async function searchNode(
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return "No Perplexity API key configured. Using LLM inference only.";
  }

  // Timeout after 120s if no abort signal provided (deep-research can be slow)
  const timeoutSignal = AbortSignal.timeout(120_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const resp = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-deep-research",
      messages: [
        {
          role: "system",
          content:
            "You are a supply chain research assistant. Provide factual, data-driven answers with specific figures, percentages, and country names. Be concise.",
        },
        { role: "user", content: query },
      ],
    }),
    signal: combinedSignal,
  });

  if (!resp.ok) {
    throw new Error(`Perplexity API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}
