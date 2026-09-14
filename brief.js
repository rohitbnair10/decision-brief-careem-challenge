// Serverless API route: takes a compact data profile, returns a structured decision brief.
// Uses Anthropic's Messages API. Set ANTHROPIC_API_KEY in Vercel env vars.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const { profile, context } = req.body || {};
  if (!profile) {
    return res.status(400).json({ error: "No data profile provided." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY." });
  }

  const system =
    "You are a business analyst writing a decision brief for a busy operator. " +
    "You are given a compact statistical profile of a dataset (columns, types, ranges, " +
    "top categories, correlations, notable outliers). You do NOT get raw rows. " +
    "Interpret the numbers, surface the patterns that matter for a decision, and be concrete. " +
    "Never invent figures not implied by the profile. If the data can't support a claim, say so. " +
    "Respond ONLY with valid JSON, no markdown, no preamble, matching this shape exactly:\n" +
    '{ "headline": string, "takeaways": [ {"point": string, "evidence": string}, ' +
    '{"point": string, "evidence": string}, {"point": string, "evidence": string} ], ' +
    '"action": {"recommendation": string, "why": string, "confidence": "high"|"medium"|"low"} }';

  const userMsg =
    (context ? `Business context: ${context}\n\n` : "") +
    `Data profile:\n${profile}\n\n` +
    "Write exactly three takeaways and one recommended action.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: `Model call failed: ${t.slice(0, 300)}` });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Model returned unparseable output.", raw: text });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
