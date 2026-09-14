# Decision Brief Generator

Turns a raw CSV into three evidence-backed takeaways and one recommended action.

## How it works
1. You upload a CSV. The browser profiles it locally — per-column stats (mean, median, range, sd, missing), top categories, and pairwise correlations.
2. Only that compact statistical profile (never raw rows) is sent to an LLM with a strict JSON contract.
3. The model interprets the numbers and returns a structured brief: headline, 3 takeaways (point + evidence), and 1 action (recommendation, why, confidence).

Privacy by design: raw records stay in the browser.

## Deploy to Vercel (2 minutes)
1. Push this folder to a public GitHub repo.
2. Import it at vercel.com → New Project.
3. Add an environment variable: `ANTHROPIC_API_KEY` = your key.
4. Deploy. Done.

## Run locally
```bash
npm install
ANTHROPIC_API_KEY=sk-... npm run dev
```
Open http://localhost:3000 and upload `public/sample-marketing.csv`.

## Swap the model provider
The API route calls Anthropic's Messages endpoint in `pages/api/brief.js`.
To use OpenAI instead, change the fetch URL, headers, and response parsing there — the JSON contract in the system prompt stays identical.
