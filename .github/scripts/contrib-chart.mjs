// Draws a cyan area chart of weekly contributions and writes dist/contrib-chart.svg
// Runs in GitHub Actions with GH_TOKEN = {{ secrets.GITHUB_TOKEN }}

const LOGIN = "avni-karutoki";
const W = 720;
const H = 200;
const PAD = { l: 10, r: 14, t: 16, b: 26 };
const CYAN = "#00BFFF";

async function fetchWeeks() {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { contributionCount date } }
          }
        }
      }
    }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data.user.contributionsCollection.contributionCalendar;
}

function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

async function main() {
  const cal = await fetchWeeks();
  const totals = cal.weeks.map((w) =>
    w.contributionDays.reduce((s, d) => s + d.contributionCount, 0)
  );
  const max = Math.max(1, ...totals);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const pts = totals.map((v, i) => [
    PAD.l + (totals.length === 1 ? iw / 2 : (i / (totals.length - 1)) * iw),
    PAD.t + ih - (v / max) * ih,
  ]);
  const line = smoothPath(pts);
  const base = H - PAD.b;
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)},${base} L ${pts[0][0].toFixed(1)},${base} Z`;
  const last = pts[pts.length - 1];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly contributions area chart">` +
    `<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${CYAN}" stop-opacity="0.45"/>` +
    `<stop offset="100%" stop-color="${CYAN}" stop-opacity="0.02"/>` +
    `</linearGradient></defs>` +
    `<text x="${PAD.l}" y="12" font-family="monospace" font-size="11" fill="${CYAN}" opacity="0.85">${cal.totalContributions} contributions in the last year</text>` +
    `<path d="${area}" fill="url(#fill)"/>` +
    `<path d="${line}" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<line x1="${PAD.l}" y1="${base}" x2="${W - PAD.r}" y2="${base}" stroke="${CYAN}" stroke-opacity="0.25"/>` +
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${CYAN}"/>` +
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="7.5" fill="none" stroke="${CYAN}" stroke-opacity="0.4"/>` +
    `</svg>`;

  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("dist", { recursive: true });
  await writeFile("dist/contrib-chart.svg", svg);
  console.log(`Wrote chart: ${totals.length} weeks, ${cal.totalContributions} total contributions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
