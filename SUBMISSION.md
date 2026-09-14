# Decision Brief Generator — Submission

**Challenge attempted:** #1 (Decision Brief Generator), combined with #3 (three takeaways + one action point).

## 100-word summary
Decision Brief Generator turns a raw CSV into a decision-ready brief: three evidence-backed takeaways and one recommended action with a confidence rating. The browser profiles the data locally — computing per-column statistics, top categories, and correlations — so raw records never leave the user's machine; only a compact statistical summary is sent to the model under a strict JSON contract. This keeps the tool privacy-safe, fast, and provider-agnostic. I built it as a deployable Next.js app (one API route, one page) rather than a notebook, so an operator can drop in any dataset and get an actionable brief in seconds.

## Dataset
Self-created dummy marketing dataset (`public/sample-marketing.csv`): channel-level spend, impressions, clicks, conversions, and revenue across three months — no confidential data.

## What to submit
- Public link: your Vercel deployment URL (after importing the repo and setting `ANTHROPIC_API_KEY`)
- Repo: the GitHub repo you push this folder to
- Dataset: `sample-marketing.csv` (included)
- Summary: the 100 words above
