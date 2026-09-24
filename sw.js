/* Service Worker: speichert die App-Dateien, damit sie im Laden auch ohne Netz startet.
   Bei jeder Änderung an den App-Dateien VERSION hochzählen, sonst sieht das Handy die alte Fassung. */
const VERSION = 'menuplan-v1.3.1';
const FILES = [
  './', './index.html', './styles.css', './data.js', './logic.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Zuerst Netz (damit Updates ankommen), ohne Netz aus dem Speicher
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      const copy = res.clone();
      caches.open(VERSION).then(function (c) { return c.put(e.request, copy); }).catch(function () { /* nicht speicherbar */ });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
