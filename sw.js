self.addEventListener('install', e => {
    e.waitUntil(
        caches.open('school-v1').then(cache => cache.addAll([
            '/',
            'index.html',
            'style.css',
            'core.js',
            'config.js',
            'logo-transparent.png'
        ]))
    );
});
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});