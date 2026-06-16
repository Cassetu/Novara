const CACHE = "novara-v1";

const STATIC = [
    "/",
    "/index.html",
    "/style.css",
    "/css/course.css",
    "/css/landing.css",
    "/css/godot.css",
    "/css/themes.css",
    "/app.js",
    "/firebase-config.js",
    "/js/course.js",
    "/js/utils/parse.js",
    "/js/utils/sound.js",
    "/js/utils/lineNumbers.js",
    "/js/renderers/document.js",
    "/js/renderers/question.js",
    "/js/renderers/challenge.js",
    "/js/renderers/codeFix.js",
    "/js/renderers/fillBlank.js",
    "/js/renderers/spotBug.js",
    "/js/renderers/project.js",
    "/js/renderers/godotScene.js",
    "/data/catalog.json",
    "/js/renderers/cookingSim.js",
    "/js/sims/heatControl.js"
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