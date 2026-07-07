/*
 * Minimal service worker — its job is (a) to make the app installable on Android/Chrome
 * (a SW with a fetch handler is required for the install prompt) and (b) light offline
 * resilience. It deliberately NEVER caches API/auth traffic, and uses network-first for
 * navigations so a fresh deploy always loads.
 */
const VERSION = 'v1';
const CACHE = `mentra-${VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/brand/mentra-app-192.png',
  '/brand/mentra-app-512.png',
  '/brand/mentra-apple-touch-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (CDN, fonts, api) pass through
  if (url.pathname.startsWith('/api/')) return; // never cache API / auth

  // Navigations: network-first so new builds load; fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }

  // Static assets (hashed JS/CSS, images, fonts): serve from cache, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
