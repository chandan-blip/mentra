/**
 * Server-rendered Open Graph shell for the shareable /watch/:id page.
 *
 * Social crawlers (WhatsApp, Facebook, Telegram, LinkedIn, Slack, X) never execute the
 * SPA's JavaScript, so they only ever see the static tags baked into apps/web/index.html
 * — which is why every shared session unfurls as the same generic Mentra card. nginx
 * routes only those crawlers here (see nginx/mentra.vps.conf) so a shared link carries
 * the session's real title, topic, and thumbnail. Humans always get the SPA and never
 * see this page.
 *
 * These functions take the web origin rather than importing `env` on purpose: env.ts
 * process.exit(1)s on a missing var, which would make this module untestable.
 */
import type { LiveSessionView } from '@mentra/shared';

/**
 * Escape for an HTML attribute value. `title` and `topic` are mentor-authored free
 * text, so an unescaped `"` would close content="…" and let arbitrary markup into the
 * document. Ampersand must be replaced first or it would double-escape the others.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapse whitespace and clamp; unfurl cards truncate well before these limits. */
function clamp(value: string, max: number): string {
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

const HLS_MASTER = /\/hls\/master\.m3u8$/;

/**
 * Mirrors posterOf() in apps/web/src/modules/public/PublicWatch.tsx so the unfurl shows
 * the same image as the page itself. It differs in one way: the frame-grab is only
 * derived when the URL really is an HLS master. A blind .replace() that misses would
 * leave an .m3u8 as og:image, and the preview would silently render with no image.
 */
function posterOf(v: LiveSessionView, origin: string): string {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  if (v.recordingUrl && HLS_MASTER.test(v.recordingUrl)) {
    return v.recordingUrl.replace(HLS_MASTER, '/thumb.jpg');
  }
  return `${origin}/og-image.png`;
}

function shell(parts: { title: string; description: string; url: string; image: string; type: string }): string {
  const { title, description, url, image, type } = parts;
  // Deliberately no <meta http-equiv="refresh">: a crawler that follows it would land
  // back on /watch/:id, get rewritten here again, and loop. The <a> covers the rare
  // human who opens this endpoint directly.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />

    <meta property="og:type" content="${esc(type)}" />
    <meta property="og:site_name" content="Mentra" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:alt" content="${esc(title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
  </head>
  <body>
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <p><a href="${esc(url)}">Watch on Mentra</a></p>
  </body>
</html>
`;
}

/** OG shell for a public, ready recording. */
export function renderWatchOg(v: LiveSessionView, webOrigin: string): string {
  const origin = webOrigin.replace(/\/+$/, '');
  const title = clamp(v.title || 'Live session', 90);
  const topic = clamp(v.topic || '', 150);
  const mentor = v.mentorName ? `with ${v.mentorName}` : '';
  const description = [topic, mentor].filter(Boolean).join(' · ') || 'A live session on Mentra.';

  return shell({
    title: `${title} · Mentra`,
    description,
    url: `${origin}/watch/${encodeURIComponent(v.id)}`,
    image: posterOf(v, origin),
    type: 'video.other',
  });
}

/**
 * Served with a 404 when the video is private, hidden, or still transcoding — the same
 * gate the page itself applies. Crawlers ignore non-200s, so the link stays bare rather
 * than unfurling a card that promises something the recipient cannot open.
 */
export function renderWatchUnavailable(webOrigin: string): string {
  const origin = webOrigin.replace(/\/+$/, '');
  return shell({
    title: 'Video not available · Mentra',
    description: 'This video is private or is not ready yet.',
    url: `${origin}/`,
    image: `${origin}/og-image.png`,
    type: 'website',
  });
}
