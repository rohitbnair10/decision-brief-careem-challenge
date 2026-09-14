import { useState, useRef } from "react";
import Papa from "papaparse";

// Build a compact statistical profile client-side so we never ship raw rows to the model.
function profileData(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const n = rows.length;
  const lines = [`Rows: ${n}`, `Columns: ${cols.length}`, ""];

  for (const col of cols) {
    const vals = rows.map((r) => r[col]).filter((v) => v !== "" && v != null);
    const nums = vals.map(Number).filter((v) => !Number.isNaN(v));
    const isNumeric = nums.length >= vals.length * 0.8 && vals.length > 0;

    if (isNumeric && nums.length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const sorted = [...nums].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
      lines.push(
        `- ${col} (numeric): mean ${mean.toFixed(2)}, median ${median}, ` +
          `min ${min}, max ${max}, sd ${sd.toFixed(2)}, missing ${n - vals.length}`
      );
    } else {
      const counts = {};
      for (const v of vals) counts[v] = (counts[v] || 0) + 1;
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, c]) => `${k} (${c})`)
        .join(", ");
      lines.push(
        `- ${col} (categorical): ${Object.keys(counts).length} unique, ` +
          `top: ${top}, missing ${n - vals.length}`
      );
    }
  }

  // Pairwise correlations for numeric columns.
  const numCols = cols.filter((col) => {
    const nums = rows.map((r) => Number(r[col])).filter((v) => !Number.isNaN(v));
    return nums.length >= n * 0.8;
  });
  if (numCols.length >= 2) {
    lines.push("", "Notable correlations:");
    for (let i = 0; i < numCols.length; i++) {
      for (let j = i + 1; j < numCols.length; j++) {
        const a = rows.map((r) => Number(r[numCols[i]]));
        const b = rows.map((r) => Number(r[numCols[j]]));
        const c = corr(a, b);
        if (Math.abs(c) >= 0.4) {
          lines.push(`- ${numCols[i]} vs ${numCols[j]}: r = ${c.toFixed(2)}`);
        }
      }
    }
  }
  return lines.join("\n");
}

function corr(a, b) {
  const pairs = a.map((v, i) => [v, b[i]]).filter(([x, y]) => !Number.isNaN(x) && !Number.isNaN(y));
  const n = pairs.length;
  if (n < 3) return 0;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export default function Home() {
  const [status, setStatus] = useState("idle");
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState("");
  const [context, setContext] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setBrief(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => run(profileData(res.data)),
      error: (err) => setError(String(err)),
    });
  }

  async function run(profile) {
    setStatus("thinking");
    try {
      const r = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, context }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Request failed");
      setBrief(data);
      setStatus("done");
    } catch (e) {
      setError(String(e.message || e));
      setStatus("idle");
    }
  }

  const conf = brief?.action?.confidence;
  const confColor = { high: "#2f7d4f", medium: "#b5820b", low: "#a3413a" }[conf] || "#555";

  return (
    <main>
      <div className="wrap">
        <header>
          <h1>Decision Brief</h1>
          <p className="sub">
            Drop a CSV. Get three takeaways and one recommended action, grounded in the numbers.
          </p>
        </header>

        <label className="ctx">
          What decision are you weighing? <span>(optional, sharpens the brief)</span>
          <textarea
            rows={2}
            placeholder="e.g. Should we shift ad spend from search to social next quarter?"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </label>

        <div
          className="drop"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input ref={inputRef} type="file" accept=".csv" onChange={onFile} hidden />
          <span className="dropMain">
            {fileName ? fileName : "Choose a CSV file"}
          </span>
          <span className="dropHint">Rows never leave your browser — only summary stats are sent</span>
        </div>

        {status === "thinking" && <p className="working">Reading the data…</p>}
        {error && <p className="err">{error}</p>}

        {brief && (
          <section className="brief">
            <h2>{brief.headline}</h2>
            <ol className="takeaways">
              {brief.takeaways?.map((t, i) => (
                <li key={i}>
                  <span className="point">{t.point}</span>
                  <span className="evidence">{t.evidence}</span>
                </li>
              ))}
            </ol>
            <div className="action">
              <div className="actionHead">
                <h3>Recommended action</h3>
                <span className="conf" style={{ color: confColor, borderColor: confColor }}>
                  {conf} confidence
                </span>
              </div>
              <p className="rec">{brief.action?.recommendation}</p>
              <p className="why">{brief.action?.why}</p>
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        main {
          min-height: 100vh;
          background: #12100e;
          color: #ece7df;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          padding: 48px 20px 80px;
        }
        .wrap { max-width: 620px; margin: 0 auto; }
        header { margin-bottom: 32px; }
        h1 {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 44px; font-weight: 500; letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .sub { color: #9c948a; font-size: 16px; line-height: 1.5; margin: 0; max-width: 46ch; }
        .ctx {
          display: block; font-size: 14px; color: #b8b0a5; margin-bottom: 20px;
        }
        .ctx span { color: #6f685f; }
        textarea {
          width: 100%; margin-top: 8px; background: #1c1916; color: #ece7df;
          border: 1px solid #322d27; border-radius: 8px; padding: 12px;
          font-size: 15px; font-family: inherit; resize: vertical; box-sizing: border-box;
        }
        textarea:focus { outline: 2px solid #7a6f5f; border-color: transparent; }
        .drop {
          border: 1.5px dashed #3a342d; border-radius: 12px; padding: 32px;
          text-align: center; cursor: pointer; transition: border-color .15s, background .15s;
          background: #171410; display: flex; flex-direction: column; gap: 6px;
        }
        .drop:hover { border-color: #6b6053; background: #1b1712; }
        .dropMain { font-size: 17px; color: #ddd5c8; }
        .dropHint { font-size: 12.5px; color: #6f685f; }
        .working { color: #b5820b; margin-top: 24px; font-size: 15px; }
        .err {
          margin-top: 24px; color: #e08b84; background: #241614;
          padding: 12px 14px; border-radius: 8px; font-size: 14px; line-height: 1.5;
        }
        .brief { margin-top: 40px; }
        .brief h2 {
          font-family: Georgia, serif; font-size: 26px; font-weight: 500;
          line-height: 1.3; margin: 0 0 24px; letter-spacing: -0.01em;
        }
        .takeaways { list-style: none; counter-reset: t; padding: 0; margin: 0 0 32px; }
        .takeaways li {
          counter-increment: t; position: relative; padding: 0 0 20px 40px;
          margin-bottom: 20px; border-bottom: 1px solid #241f1a;
        }
        .takeaways li:last-child { border-bottom: none; }
        .takeaways li::before {
          content: counter(t); position: absolute; left: 0; top: -2px;
          font-family: Georgia, serif; font-size: 22px; color: #7a6f5f;
        }
        .point { display: block; font-size: 16.5px; font-weight: 600; margin-bottom: 5px; color: #f2ede4; }
        .evidence { display: block; font-size: 14.5px; color: #9c948a; line-height: 1.55; }
        .action {
          background: #1a1613; border: 1px solid #322d27; border-radius: 12px; padding: 22px 24px;
        }
        .actionHead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .action h3 { margin: 0; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #8f867b; }
        .conf {
          font-size: 12px; border: 1px solid; border-radius: 999px; padding: 3px 10px;
          text-transform: capitalize;
        }
        .rec { font-size: 17px; line-height: 1.5; margin: 0 0 10px; color: #f2ede4; }
        .why { font-size: 14.5px; line-height: 1.6; color: #9c948a; margin: 0; }
      `}</style>
    </main>
  );
}
