const CACHE = "novara-v2";

const STATIC = [
    "/",
    "/index.html",
    "/css/style.css",
    "/css/about.css",
    "/css/privacy.css",
    "/css/landing.css",
    "/js/app.js",
    "/js/firebase-config.js",
    "/js/course.js",
    "/js/utils/parse.js",
    "/js/utils/sound.js",
    "/js/utils/lineNumbers.js",
    "/js/renderers/project.js",
    "/data/catalog.json",
];

const SKIP_CACHE = [
    "firebaseapp.com",
    "googleapis.com",
    "gstatic.com",
    "firestore.googleapis.com"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
    const url = e.request.url;

    if (SKIP_CACHE.some(s => url.includes(s))) return;

    if (url.includes("/data/") && url.endsWith(".json")) {
        e.respondWith(
            caches.open(CACHE).then(async cache => {
                const cached = await cache.match(e.request);
                if (cached) return cached;
                const fresh = await fetch(e.request);
                cache.put(e.request, fresh.clone());
                return fresh;
            })
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});

self.addEventListener("message", e => {
    if (e.data?.type === "CACHE_COURSE") {
        const url = e.data.url;
        caches.open(CACHE).then(cache => {
            fetch(url).then(res => cache.put(url, res));
        });
    }
});