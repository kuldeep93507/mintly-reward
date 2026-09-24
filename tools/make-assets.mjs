// Renders the app icon, adaptive icon layers, splash screens and Play Store
// graphics from SVG using headless Chromium.
//
//   node tools/make-assets.mjs
//
// Needs `playwright-core` (or `playwright`) resolvable and a Chromium binary
// (CHROMIUM_PATH, or the Playwright browser cache).

import { mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright-core'); } catch { pw = require('playwright'); }

const RES = join(root, 'app/android/app/src/main/res');
const STORE = join(root, 'docs/store');
const BG = '#1a1446';

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of existsSync(base) ? readdirSync(base) : []) {
    const p = join(base, d, 'chrome-linux', 'chrome');
    if (d.startsWith('chromium-') && existsSync(p)) return p;
  }
  return undefined;
}

const fontCss = (() => {
  const f = join(root, 'node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2');
  if (!existsSync(f)) return '';
  const b64 = readFileSync(f).toString('base64');
  return `@font-face{font-family:'Baloo 2';font-weight:800;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
})();

/** The logo motif: four coloured yards around a white die. Drawn in a 1024 box. */
function motif() {
  const tile = (x, y, fill, spot) => `
    <rect x="${x}" y="${y}" width="250" height="250" rx="44" fill="${fill}"/>
    <rect x="${x}" y="${y}" width="250" height="250" rx="44" fill="url(#gloss)"/>
    <circle cx="${x + spot[0]}" cy="${y + spot[1]}" r="46" fill="#ffffff" opacity="0.92"/>`;
  return `
  <defs>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="die" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e4e2f2"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0b0827" flood-opacity="0.55"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    ${tile(248, 248, '#E53935', [80, 80])}
    ${tile(526, 248, '#2E9E48', [170, 80])}
    ${tile(526, 526, '#F9C21A', [170, 170])}
    ${tile(248, 526, '#1E7FE0', [80, 170])}
  </g>
  <g transform="rotate(-14 512 512)" filter="url(#shadow)">
    <rect x="372" y="372" width="280" height="280" rx="64" fill="url(#die)" stroke="#1a1446" stroke-width="14"/>
    ${[[442, 442], [442, 512], [442, 582], [582, 442], [582, 512], [582, 582]]
      .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="27" fill="#1a1446"/>`).join('')}
  </g>`;
}

const backdrop = (w, h) => `
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#3d2fa8"/>
      <stop offset="1" stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>`;

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Full legacy icon: backdrop + motif scaled to fill the square.
const legacyIcon = (round) => svg(1024, 1024, `
  <clipPath id="clip">${round ? '<circle cx="512" cy="512" r="512"/>' : '<rect width="1024" height="1024" rx="200"/>'}</clipPath>
  <g clip-path="url(#clip)">${backdrop(1024, 1024)}
    <g transform="translate(512 512) scale(1.32) translate(-512 -512)">${motif()}</g>
  </g>`);

// Adaptive foreground: motif inside the 66/108 safe zone, transparent elsewhere.
const adaptiveForeground = () => svg(1024, 1024, `<g transform="translate(512 512) scale(1.0) translate(-512 -512)">${motif()}</g>`);

const playIcon = () => svg(1024, 1024, `${backdrop(1024, 1024)}<g transform="translate(512 512) scale(1.32) translate(-512 -512)">${motif()}</g>`);

const title = (x, y, size, anchor = 'middle') => `
  <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="${size}"
    fill="#FFD54A" stroke="#0b0827" stroke-width="${size * 0.08}" paint-order="stroke" letter-spacing="2">Ludo Mintly</text>`;

const splash = (w, h) => {
  const s = Math.min(w, h) * 0.5 / 560;
  const cy = h / 2 - Math.min(w, h) * 0.08;
  return svg(w, h, `${backdrop(w, h)}
    <g transform="translate(${w / 2} ${cy}) scale(${s}) translate(-512 -512)">${motif()}</g>
    ${title(w / 2, cy + 560 * s * 0.5 + Math.min(w, h) * 0.13, Math.min(w, h) * 0.1)}`);
};

const featureGraphic = () => svg(1024, 500, `${backdrop(1024, 500)}
  <g transform="translate(235 250) scale(0.58) translate(-512 -512)">${motif()}</g>
  ${title(430, 262, 90, 'start')}
  <text x="434" y="322" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="31" fill="#ffffff">Play online with friends &amp; family</text>`);

async function main() {
  const browser = await pw.chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage();
  async function render(svgText, w, h, out, transparent = false) {
    mkdirSync(dirname(out), { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    const sized = svgText.replace(/^<svg([^>]*) width="\d+(\.\d+)?" height="\d+(\.\d+)?"/, `<svg$1 width="${w}" height="${h}"`);
    await page.setContent(`<!doctype html><html><head><style>${fontCss}html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${sized}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
    console.log('wrote', out.replace(root + '/', ''), `${w}x${h}`);
  }

  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(densities)) {
    await render(legacyIcon(false), 48 * k, 48 * k, join(RES, `mipmap-${d}/ic_launcher.png`), true);
    await render(legacyIcon(true), 48 * k, 48 * k, join(RES, `mipmap-${d}/ic_launcher_round.png`), true);
    await render(adaptiveForeground(), 108 * k, 108 * k, join(RES, `mipmap-${d}/ic_launcher_foreground.png`), true);
  }
  const splashes = {
    'drawable/splash.png': [480, 320],
    'drawable-land-mdpi/splash.png': [480, 320], 'drawable-land-hdpi/splash.png': [800, 480],
    'drawable-land-xhdpi/splash.png': [1280, 720], 'drawable-land-xxhdpi/splash.png': [1600, 960],
    'drawable-land-xxxhdpi/splash.png': [1920, 1280],
    'drawable-port-mdpi/splash.png': [320, 480], 'drawable-port-hdpi/splash.png': [480, 800],
    'drawable-port-xhdpi/splash.png': [720, 1280], 'drawable-port-xxhdpi/splash.png': [960, 1600],
    'drawable-port-xxxhdpi/splash.png': [1280, 1920],
  };
  for (const [p, [w, h]] of Object.entries(splashes)) await render(splash(w, h), w, h, join(RES, p));

  await render(playIcon(), 512, 512, join(STORE, 'icon-512.png'));
  await render(featureGraphic(), 1024, 500, join(STORE, 'feature-graphic-1024x500.png'));
  await render(legacyIcon(false), 192, 192, join(root, 'app/public/icon-192.png'), true);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
