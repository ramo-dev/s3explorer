// App-shell service worker.
//
// Served verbatim from public/, so it is neither bundled nor hashed. That is
// deliberate: a service worker is re-fetched by path to decide whether it has
// changed, so a content-hashed URL would install a second worker on every
// deploy and strand the first one's cache. It also means the caching rules
// below cannot know the hashed asset names at build time, so assets are cached
// as they are fetched rather than precached from a build manifest.
//
// The one rule that matters: /api is never touched. Object names, bucket
// listings and previews are per-session and per-user. Caching them would show
// one person's buckets to the next person who logs in on a shared device, and
// would serve a stale listing to the person who is already signed in -- a
// delete would appear to un-delete itself. Everything else is same-origin,
// public, content-addressed static output.

const SHELL_CACHE = 's3e-shell-v1';
const ASSET_CACHE = 's3e-assets-v1';
const CACHES = [SHELL_CACHE, ASSET_CACHE];

// index.html is the only unhashed file the app cannot boot without.
const PRECACHE = ['/index.html'];

// Asset filenames are content-hashed, so a hit is by definition the right bytes
// and can never go stale. Trimming oldest-first is enough to stop the previous
// deploy's hashes accumulating without bound.
const MAX_ASSET_ENTRIES = 80;

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, not addAll: one 404 during a deploy would otherwise
      // reject the whole install and leave the worker permanently stuck.
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      // Safe without a reload prompt. Nothing version-locked is precached, and
      // navigations are network-first, so the worst case is a mix of old and
      // new assets for the page already in memory -- never a stale one.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => !CACHES.includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // A 206 cannot be replayed from cache, and a Range request means the browser
  // is seeking media rather than loading the shell.
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * Network-first, falling back to the cached shell.
 *
 * Network-first rather than cache-first because index.html is unhashed: serve
 * it from cache and a deploy is invisible until the cache is evicted by hand.
 * The fallback is what makes the installed app open with no connection.
 */
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put('/index.html', response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match('/index.html')) || (await caches.match('/index.html'));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached;

  const response = await network;
  // Offline and uncached: a 503 lets the page render its own error state
  // instead of the browser's "cannot reach this site" body.
  return response || new Response('', { status: 503, statusText: 'Offline' });
}

/** Drop the oldest entries once the asset cache is over budget. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSET_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ASSET_ENTRIES).map(key => cache.delete(key)));
}
