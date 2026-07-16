import { describe, expect, it } from 'vitest';
import type { LiveSessionView } from '@mentra/shared';
import { renderWatchOg, renderWatchUnavailable } from '../og.js';

const ORIGIN = 'https://app.mentradev.sbs';

const view = (over: Partial<LiveSessionView> = {}): LiveSessionView =>
  ({
    id: 'ckv1sess42',
    mentorId: 'm1',
    mentorName: 'Priya Sharma',
    mentorAvatarUrl: null,
    title: 'React state & hooks',
    topic: 'Deep dive into useState',
    status: 'ended',
    scheduledFor: null,
    startedAt: null,
    endedAt: null,
    currentViewers: 0,
    peakViewers: 0,
    chatCount: 0,
    isOwner: false,
    recordingStatus: 'ready',
    recordingUrl: 'https://cdn.example.com/rec/ckv1sess42/hls/master.m3u8',
    thumbnailUrl: 'https://cdn.example.com/thumbnails/ckv1sess42/ai.jpg',
    visible: true,
    isPublic: true,
    durationSeconds: 600,
    source: 'live',
    likeCount: 0,
    likedByViewer: false,
    createdAt: new Date().toISOString(),
    ...over,
  }) as LiveSessionView;

/** Pull a meta tag's content by property/name. */
const meta = (html: string, prop: string): string | undefined =>
  html.match(new RegExp(`${prop}" content="([^"]*)"`))?.[1];

describe('renderWatchOg', () => {
  it('carries the session title, topic, mentor, and thumbnail', () => {
    const html = renderWatchOg(view(), ORIGIN);
    expect(meta(html, 'og:title')).toBe('React state &amp; hooks · Mentra');
    expect(meta(html, 'og:description')).toBe('Deep dive into useState · with Priya Sharma');
    expect(meta(html, 'og:image')).toBe('https://cdn.example.com/thumbnails/ckv1sess42/ai.jpg');
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/watch/ckv1sess42`);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  // title/topic are mentor-authored free text rendered into content="…" attributes.
  it('escapes markup and quotes so a title cannot break out of the attribute', () => {
    const html = renderWatchOg(
      view({ title: 'Bad" onload="alert(1)', topic: '<script>alert(document.cookie)</script>' }),
      ORIGIN,
    );
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/content="[^"]*"\s+on\w+=/);
    expect(meta(html, 'og:title')).toBe('Bad&quot; onload=&quot;alert(1) · Mentra');
  });

  it('falls back to the HLS frame-grab when there is no thumbnail', () => {
    const html = renderWatchOg(view({ thumbnailUrl: null }), ORIGIN);
    expect(meta(html, 'og:image')).toBe('https://cdn.example.com/rec/ckv1sess42/thumb.jpg');
  });

  // A blind .replace() that misses would leave an .m3u8 as og:image and the preview
  // would render with no image at all.
  it('never emits a non-image recording URL as og:image', () => {
    const html = renderWatchOg(view({ thumbnailUrl: null, recordingUrl: 'https://cdn.example.com/raw.mp4' }), ORIGIN);
    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/og-image.png`);
  });

  it('does not double up the slash when the origin has a trailing one', () => {
    expect(meta(renderWatchOg(view(), 'https://app.mentradev.sbs/'), 'og:url')).toBe(`${ORIGIN}/watch/ckv1sess42`);
  });

  // A crawler that followed a refresh would bounce to /watch/:id, be rewritten back
  // here by nginx, and loop.
  it('contains no meta refresh back to the watch page', () => {
    expect(renderWatchOg(view(), ORIGIN)).not.toMatch(/http-equiv="refresh"/i);
  });
});

describe('renderWatchUnavailable', () => {
  it('renders a neutral card with no session data', () => {
    const html = renderWatchUnavailable(ORIGIN);
    expect(meta(html, 'og:title')).toBe('Video not available · Mentra');
    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/og-image.png`);
  });
});
