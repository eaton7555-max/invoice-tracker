// Landscape Jobs service worker.
// Pages (index.html) are network-first so every update reaches installed phones
// the next time they open with internet; the cached copy is only used offline.
const CACHE = "landscape-jobs-v3";
const ASSETS = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req, url) {
  return req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch the Google Sheet sync.
  if (url.hostname === "script.google.com" || url.hostname.endsWith(".googleusercontent.com")) return;

  if (isPage(req, url)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => { c.put("./index.html", copy.clone()); c.put("./", copy); });
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Other files (manifest, PDF library): network first, cached copy when offline.
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
