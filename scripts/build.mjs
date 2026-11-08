// Builds the profile README and its animated SVG cards from live GitHub data.
// Run: GITHUB_TOKEN=... node scripts/build.mjs   (no dependencies; Node 20+)
import { mkdir, writeFile } from 'node:fs/promises';

const USER = 'SankeerthNara';
const SKIP_OWNERS = new Set([USER, 'ESW-M26']); // own repos and coursework aren't open-source contributions
const SKIP = new Set(['firstcontributions/first-contributions']);
const ROOT = new URL('../', import.meta.url);

// Palette: matches sankeerthnara.in (ink, cream, one yellow accent).
const INK = '#0e0e0e', CARD = '#161616', LINE = '#2a2a2a', CREAM = '#f3f1ec', MUTED = '#9a978f', ACC = '#f5b52e';
const FONT = "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

// Hand-written facts for projects the API can't describe (GraspBudget is private).
const FEATURED = [
  { slug: 'graspbudget', title: 'GraspBudget · Pluto', tag: 'research · sole author',
    lines: ['Measure the object, not the scene: grasp-accurate', 'distance on a phone SoC. 2.9 cm vs 6.9 cm for', 'Depth Anything 3 on 2,912 Objectron test videos.'],
    stack: 'PyTorch · C++ · Kotlin · Snapdragon NPU', url: 'https://www.sankeerthnara.in' },
  { slug: 'poshan', title: 'Poshan Lens', tag: 'Meta AI hackathon 2026',
    lines: ["A child's height from a 9-second phone video,", 'WHO z-scores and a screening result for', 'Anganwadi workers. No LiDAR or extra hardware.'],
    stack: 'Python · ARCore · Android', url: `https://github.com/${USER}/meta-hackathon-2026` },
  { slug: 'tabby', title: 'Tabby', tag: 'AI bill splitter · live',
    lines: ['Gemini reads the receipt; unit-tested TypeScript', 'does the money in integer cents. Itemised', 'PayPal invoices, webhooks and reminders.'],
    stack: 'Next.js · TypeScript · Gemini · PayPal', url: `https://github.com/${USER}/Tabby` },
  { slug: 'shuttle', title: 'Shuttle', tag: '500+ residents use it',
    lines: ['Court booking web app and Play Store app:', 'JWT roles, HMAC-verified Razorpay payments,', 'QR check-in that ended double bookings.'],
    stack: 'React · FastAPI · MongoDB · Capacitor', url: `https://github.com/${USER}/Shuttle` },
  { slug: 'cshell', title: 'C Shell + xv6 scheduler', tag: 'systems',
    lines: ['POSIX shell in C: automata lexer, pipes,', 'redirection, job control, signals, ptrace;', 'plus a scheduler extension for xv6-RISC-V.'],
    stack: 'C · POSIX · xv6', url: `https://github.com/${USER}/mini-project1` },
  { slug: 'codetrack', title: 'CodeTrack', tag: 'progress tracker · live',
    lines: ['LeetCode problems, GitHub contributions and', 'Codeforces rating in one dashboard, with', 'charts, contests and a sync timeline.'],
    stack: 'Next.js · TypeScript · Tailwind', url: `https://github.com/${USER}/codetrack` },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// "Fix thing , Closes #12" / "feat: x (closes #83)" / "y (#95)" -> "Fix thing" / "feat: x" / "y"
const cleanTitle = (t) => t.replace(/[\s,(]*closes\s*#\d+\s*\)?\s*$/i, '').replace(/\s*\(#\d+\)\s*$/, '').trim();
const md = (s) => String(s).replace(/([\\`*_[\]<>|])/g, '\\$1');
console.assert(esc('<a & "b">') === '&lt;a &amp; &quot;b&quot;&gt;', 'esc');
console.assert(cleanTitle('feat: x (closes #83)') === 'feat: x', 'cleanTitle closes');
console.assert(cleanTitle('Show selector (#1234)') === 'Show selector', 'cleanTitle ref');
console.assert(md('use `@Copyable`') === 'use \\`@Copyable\\`', 'md');

const headers = {
  Accept: 'application/vnd.github+json', 'User-Agent': `${USER}-profile`,
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};
const gh = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
};

async function loadData() {
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const q = encodeURIComponent(`is:pr is:merged author:${USER}`);
    const res = await gh(`/search/issues?q=${q}&per_page=100&page=${page}`);
    items.push(...res.items);
    if (items.length >= res.total_count || !res.items.length) break;
  }
  const byRepo = new Map();
  for (const it of items) {
    const full = it.repository_url.split('/repos/')[1];
    if (SKIP_OWNERS.has(full.split('/')[0]) || SKIP.has(full)) continue;
    if (!byRepo.has(full)) byRepo.set(full, []);
    byRepo.get(full).push({ number: it.number, title: cleanTitle(it.title), url: it.html_url,
      merged: (it.pull_request?.merged_at ?? it.closed_at).slice(0, 10) });
  }
  const repos = [];
  for (const [full, prs] of byRepo) {
    const r = await gh(`/repos/${full}`);
    repos.push({ full, owner: r.owner.login, name: r.name, url: r.html_url, stars: r.stargazers_count,
      language: r.language, description: r.description, prs: prs.sort((a, b) => b.merged.localeCompare(a.merged)) });
  }
  repos.sort((a, b) => b.prs.length - a.prs.length || b.stars - a.stars);
  return { repos };
}

// ---------- SVG helpers ----------
const svg = (w, h, body, extraCss = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<style>
text{font-family:${FONT}}
.rise{opacity:0;animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;opacity:1!important;transform:none!important}}
${extraCss}
</style>
${body}
</svg>
`;
const frame = (w, h) => `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18" fill="${INK}" stroke="${LINE}"/>`;

function headerSvg() {
  const W = 880, H = 210;
  const roles = ['on-device computer vision', 'open source · microsoft · mozilla · google', 'backend and full-stack systems', 'research: measure the object, not the scene'];
  const n = roles.length, cycle = n * 3.2;
  const roleCss = roles.map((_, i) => `.r${i}{animation:role ${cycle}s ${i * 3.2}s infinite;opacity:0}`).join('\n');
  const pct = (t) => ((t / cycle) * 100).toFixed(2);
  return svg(W, H, `${frame(W, H)}
<g transform="translate(44 0)">
  <text x="0" y="62" fill="${MUTED}" font-size="15" class="rise" style="animation-delay:.1s">hi, i'm</text>
  <text x="0" y="118" fill="${CREAM}" font-size="54" font-weight="800" letter-spacing="-1.5" class="rise" style="animation-delay:.25s">sankeerth nara</text>
  <rect x="0" y="134" height="4" rx="2" fill="${ACC}" class="bar"/>
  <g font-size="19" fill="${CREAM}">
    ${roles.map((r, i) => `<text x="0" y="172" class="r${i}">${esc(r)}<tspan fill="${ACC}" class="caret">▍</tspan></text>`).join('\n    ')}
  </g>
</g>
<g transform="translate(${W - 190} 44)"><g class="rise" style="animation-delay:.6s">
  <text x="0" y="0" fill="${MUTED}" font-size="13">cse @ iiit hyderabad</text>
  <text x="0" y="22" fill="${MUTED}" font-size="13">hyderabad, india</text>
</g></g>
<g transform="translate(${W - 120} 120)">
  ${[0, 1, 2].map((i) => `<circle cx="${i * 26}" cy="20" r="7" fill="none" stroke="${i === 1 ? ACC : LINE}" stroke-width="2" class="orb" style="animation-delay:${i * .25}s"/>`).join('')}
</g>`, `.bar{width:0;animation:grow 1.1s .5s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes grow{to{width:220px}}
${roleCss}
@keyframes role{0%{opacity:0;transform:translateY(6px)}${pct(.4)}%{opacity:1;transform:none}${pct(2.8)}%{opacity:1}${pct(3.2)}%,100%{opacity:0}}
.caret{animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.orb{transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.35);opacity:1}}`);
}

function statsSvg({ repos }) {
  const W = 880, H = 300;
  const total = repos.reduce((n, r) => n + r.prs.length, 0);
  const stars = repos.reduce((n, r) => n + r.stars, 0);
  const kStars = stars >= 1000 ? `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k` : `${stars}`;
  const tiles = [[total, 'merged pull requests'], [repos.length, 'external repositories'], [kStars, 'combined stars of those repos']];
  const top = repos.slice(0, 6), max = Math.max(...top.map((r) => r.prs.length));
  const barW = 380;
  return svg(W, H, `${frame(W, H)}
<text x="44" y="52" fill="${MUTED}" font-size="14" class="rise">open source, by the numbers</text>
${tiles.map(([v, l], i) => `<g transform="translate(44 ${92 + i * 66})"><g class="rise" style="animation-delay:${.15 + i * .15}s">
  <text x="0" y="0" fill="${i === 0 ? ACC : CREAM}" font-size="40" font-weight="800" letter-spacing="-1">${esc(v)}</text>
  <text x="0" y="24" fill="${MUTED}" font-size="13">${esc(l)}</text></g></g>`).join('\n')}
<line x1="372" y1="40" x2="372" y2="${H - 40}" stroke="${LINE}"/>
<text x="404" y="52" fill="${MUTED}" font-size="14" class="rise">merged prs per repository</text>
${top.map((r, i) => {
    const w = Math.max(10, (r.prs.length / max) * barW), y = 80 + i * 34;
    return `<g transform="translate(404 ${y})">
  <text x="0" y="0" fill="${CREAM}" font-size="13" class="rise" style="animation-delay:${.2 + i * .1}s">${esc(r.full)}</text>
  <rect x="0" y="8" width="${barW}" height="8" rx="4" fill="${CARD}"/>
  <rect x="0" y="8" width="${w.toFixed(1)}" height="8" rx="4" fill="${i === 0 ? ACC : CREAM}" opacity="${i === 0 ? 1 : .85}" class="grow" style="animation-delay:${.35 + i * .1}s"/>
  <text x="${barW + 12}" y="17" fill="${MUTED}" font-size="12" class="rise" style="animation-delay:${.6 + i * .1}s">${r.prs.length}</text></g>`;
  }).join('\n')}`, `.grow{transform:scaleX(0);transform-origin:left;transform-box:fill-box;animation:gx .9s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes gx{to{transform:scaleX(1)}}`);
}

function activitySvg({ repos }) {
  const W = 880, H = 230;
  const months = new Map();
  for (const r of repos) for (const p of r.prs) months.set(p.merged.slice(0, 7), (months.get(p.merged.slice(0, 7)) ?? 0) + 1);
  const keys = [...months.keys()].sort();
  // fill gaps so the timeline is honest about quiet months
  const all = [];
  if (keys.length) {
    let [y, m] = keys[0].split('-').map(Number);
    const [ey, em] = keys.at(-1).split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) { all.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  }
  const max = Math.max(1, ...months.values()), plotH = 110, left = 44, right = W - 44;
  const step = (right - left) / Math.max(1, all.length), bw = Math.min(46, step * .6);
  const name = (k) => new Date(`${k}-01T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  return svg(W, H, `${frame(W, H)}
<text x="44" y="46" fill="${MUTED}" font-size="14" class="rise">merged prs per month</text>
<line x1="${left}" y1="${60 + plotH}" x2="${right}" y2="${60 + plotH}" stroke="${LINE}"/>
${all.map((k, i) => {
    const v = months.get(k) ?? 0, h = v ? Math.max(4, (v / max) * plotH) : 2, x = left + i * step + (step - bw) / 2;
    const peak = v === max;
    return `<g><rect x="${x.toFixed(1)}" y="${(60 + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${peak ? ACC : CREAM}" opacity="${v ? (peak ? 1 : .8) : .25}" class="up" style="animation-delay:${.2 + i * .08}s"/>
  ${v ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(52 + plotH - h).toFixed(1)}" fill="${peak ? ACC : MUTED}" font-size="12" text-anchor="middle" class="rise" style="animation-delay:${.6 + i * .08}s">${v}</text>` : ''}
  <text x="${(x + bw / 2).toFixed(1)}" y="${60 + plotH + 24}" fill="${MUTED}" font-size="12" text-anchor="middle">${name(k)}</text></g>`;
  }).join('\n')}`, `.up{transform:scaleY(0);transform-origin:bottom;transform-box:fill-box;animation:gy .8s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes gy{to{transform:scaleY(1)}}`);
}

function cardSvg(p, i) {
  const W = 430, H = 196;
  return svg(W, H, `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="${INK}" stroke="${LINE}"/>
<rect x="28" y="30" width="0" height="3" rx="1.5" fill="${ACC}" class="bar"/>
<text x="28" y="66" fill="${CREAM}" font-size="22" font-weight="800" letter-spacing="-.5" class="rise" style="animation-delay:.1s">${esc(p.title)}</text>
<text x="28" y="88" fill="${ACC}" font-size="12.5" class="rise" style="animation-delay:.2s">${esc(p.tag)}</text>
${p.lines.map((l, k) => `<text x="28" y="${118 + k * 19}" fill="${MUTED}" font-size="13.5" class="rise" style="animation-delay:${.3 + k * .08}s">${esc(l)}</text>`).join('\n')}
<text x="28" y="${H - 18}" fill="${CREAM}" font-size="12" opacity=".7" class="rise" style="animation-delay:.6s">${esc(p.stack)}</text>
<g transform="translate(${W - 44} 40)" class="arrow"><circle r="14" fill="none" stroke="${LINE}"/><path d="M-4 4 L4 -4 M-3 -4 H4 V3" stroke="${CREAM}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`,
  `.bar{animation:grow .9s ${.1 + i * .05}s cubic-bezier(.2,.7,.2,1) forwards}@keyframes grow{to{width:48px}}
.arrow{animation:nudge 2.8s ${i * .3}s ease-in-out infinite}@keyframes nudge{0%,100%{transform:translate(${W - 44}px,40px)}50%{transform:translate(${W - 41}px,37px)}}`);
}

// ---------- README ----------
function readme({ repos }) {
  const total = repos.reduce((n, r) => n + r.prs.length, 0);
  const updated = new Date().toISOString().slice(0, 10);
  const cards = FEATURED.map((p) => `<a href="${p.url}"><img src="assets/card-${p.slug}.svg" width="49%" alt="${esc(p.title)}: ${esc(p.lines.join(' '))}"/></a>`);
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(`<p>\n  ${cards[i]}\n  ${cards[i + 1] ?? ''}\n</p>`);
  const orgs = [...repos].sort((a, b) => b.stars - a.stars).map((r, i) => {
    const head = `<b>${esc(r.full)}</b> · ${r.prs.length} merged${r.stars ? ` · ★ ${r.stars.toLocaleString('en')}` : ''}${r.language ? ` · ${esc(r.language)}` : ''}`;
    const list = r.prs.map((p) => `- [#${p.number}](${p.url}) ${md(p.title)} <sub>${p.merged}</sub>`).join('\n');
    return `<details${i < 3 ? ' open' : ''}>\n<summary>${head}</summary>\n\n${r.description ? `> ${md(r.description)}\n\n` : ''}${list}\n\n</details>`;
  });
  return `<!-- Generated by scripts/build.mjs. Edit that file, not this one. -->
<p align="center">
  <a href="https://www.sankeerthnara.in"><img src="assets/header.svg" width="100%" alt="Sankeerth Nara: on-device computer vision, open source, backend and full-stack"/></a>
</p>

<p align="center">
  <a href="https://www.sankeerthnara.in"><b>portfolio</b></a> ·
  <a href="https://www.linkedin.com/in/sankeerth-nara-412ab3373/"><b>linkedin</b></a> ·
  <a href="mailto:sankeerthnara@gmail.com"><b>email</b></a> ·
  <a href="https://github.com/search?q=is%3Apr+is%3Amerged+author%3A${USER}&type=pullrequests"><b>all merged prs</b></a>
</p>

Second-year CSE student at **IIIT Hyderabad**. I work on **on-device computer vision** (metric distance for robot grasping on a Snapdragon NPU) and contribute to open source, with **${total} merged pull requests in ${repos.length} external repositories**, including Microsoft, Mozilla and Google.

## Selected work

${rows.join('\n')}

## Open source

<p align="center"><img src="assets/stats.svg" width="100%" alt="${total} merged pull requests across ${repos.length} external repositories"/></p>
<p align="center"><img src="assets/activity.svg" width="100%" alt="Merged pull requests per month"/></p>

Click a repository to see every merged pull request.

${orgs.join('\n\n')}

## Toolkit

\`Python\` \`C\` \`C++\` \`TypeScript\` \`Kotlin\` \`PyTorch\` \`OpenCV\` \`YOLO / SAM\` \`Qualcomm QNN\` \`FastAPI\` \`Next.js\` \`React\` \`MongoDB\` \`PostgreSQL\` \`Linux\` \`GitHub Actions\`

<sub>Refreshed daily by a GitHub Action · last update ${updated}</sub>
`;
}

const { repos } = await loadData();
if (!repos.length) throw new Error('no merged PRs found; refusing to overwrite the README');
await mkdir(new URL('assets/', ROOT), { recursive: true });
const out = (name, s) => writeFile(new URL(name, ROOT), s);
await out('assets/header.svg', headerSvg());
await out('assets/stats.svg', statsSvg({ repos }));
await out('assets/activity.svg', activitySvg({ repos }));
await Promise.all(FEATURED.map((p, i) => out(`assets/card-${p.slug}.svg`, cardSvg(p, i))));
await out('README.md', readme({ repos }));
console.log(`built: ${repos.reduce((n, r) => n + r.prs.length, 0)} PRs in ${repos.length} repos`);
