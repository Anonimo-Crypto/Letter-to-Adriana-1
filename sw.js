// Service worker liviano.
// - Shell (HTML/CSS/JS/iconos): precache + stale-while-revalidate.
// - Fotos de /carrusel/: cache primero (las descarga la pantalla inicial), sin volver a pedirlas.
// Sube la versión de CACHE para forzar la limpieza del shell.
const CACHE = 'carta-v11';
const MEDIA = 'carta-media';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'main.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/192.png',
  'icons/512.png',
  'carrusel/fotos.json',
];
const OPTS = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const media = /\/carrusel\//.test(url.pathname) && !/fotos\.json$/.test(url.pathname);

  e.respondWith((async () => {
    const hit = await caches.match(req, OPTS);
    if (hit && media) return hit;                       // fotos: siempre locales
    const cache = await caches.open(media ? MEDIA : CACHE);
    const net = fetch(req)
      .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => hit || caches.match('index.html'));
    return hit || net;
  })());
});
