import puppeteer from 'puppeteer-core';
import type { ThumbnailCopy } from './thumbnail.ai.js';

/**
 * Render cover copy to a 1280×720 PNG with headless Chrome. Uses `puppeteer-core` driving
 * the SYSTEM Chrome that's already installed for LiveKit Egress (no Chromium download) —
 * override the path with CHROME_PATH. Runs only in the worker process (Chrome is heavy).
 */

const CHROME_PATH =
  process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';

const WIDTH = 1280;
const HEIGHT = 720;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Branded HTML template — dark canvas, accent glow, big headline, kicker, emoji badge. */
function templateHtml(copy: ThumbnailCopy & { topic?: string }): string {
  const accent = copy.accent;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    font-family: 'Liberation Sans', 'Noto Sans', Arial, sans-serif;
    background:
      radial-gradient(1100px 700px at 82% -12%, ${accent}55 0%, transparent 60%),
      radial-gradient(900px 600px at -8% 118%, ${accent}33 0%, transparent 55%),
      linear-gradient(135deg, #0b1020 0%, #131a2e 55%, #0b1020 100%);
    color: #f8fafc;
    position: relative;
  }
  .frame { position: absolute; inset: 0; padding: 84px 96px; display: flex; flex-direction: column; justify-content: center; }
  .accent-bar { width: 96px; height: 10px; border-radius: 999px; background: ${accent}; box-shadow: 0 0 32px ${accent}aa; margin-bottom: 34px; }
  .topic {
    display: inline-block; align-self: flex-start; font-size: 26px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: ${accent};
    background: ${accent}1f; border: 1px solid ${accent}55; padding: 10px 20px; border-radius: 999px; margin-bottom: 30px;
  }
  .headline { font-size: 112px; font-weight: 900; line-height: 1.02; letter-spacing: -2px; max-width: 980px; text-shadow: 0 4px 40px rgba(0,0,0,.45); }
  .kicker { margin-top: 30px; font-size: 40px; font-weight: 500; color: #cbd5e1; max-width: 900px; }
  .emoji { position: absolute; top: 72px; right: 96px; font-size: 120px; line-height: 1; filter: drop-shadow(0 8px 24px rgba(0,0,0,.4)); }
  .brand { position: absolute; bottom: 60px; left: 96px; font-size: 30px; font-weight: 800; letter-spacing: 1px; color: #e2e8f0; opacity: .92; }
  .brand span { color: ${accent}; }
  </style></head><body>
    <div class="emoji">${esc(copy.emoji)}</div>
    <div class="frame">
      <div class="topic">${esc(copy.topic ?? '')}</div>
      <div class="accent-bar"></div>
      <div class="headline">${esc(copy.headline)}</div>
      <div class="kicker">${esc(copy.kicker)}</div>
    </div>
    <div class="brand">Mentra<span>.</span> Live</div>
  </body></html>`;
}

/**
 * Launch Chrome, render the template, and return the PNG bytes. The browser is always
 * closed (even on error) so a failed render never leaks a Chrome process.
 */
export async function renderThumbnailPng(copy: ThumbnailCopy & { topic?: string }): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(templateHtml(copy), { waitUntil: 'load' });
    // JPEG (not PNG): the template is a solid photo-like cover, so lossy q82 is visually
    // identical but ~5-10× smaller — cards load far faster off the (CDN-less) r2.dev domain.
    const bytes = await page.screenshot({
      type: 'jpeg',
      quality: 82,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}
