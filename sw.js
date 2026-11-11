/* Service worker: the app works offline and installs.
   - The page: network first (3 s), then the saved copy, then offline.html.
   - Code, styles, fonts, icons: from the cache at once, refreshed in the background.
   - Covers (Open Library, Google Books, Internet Archive, Wikimedia): from the cache once seen, so the lists show them offline.
   - Searches go to the network only (they need it; the page says so).
   VERSION and PRECACHE are rewritten by tools/build-sw.js — run it after changing files. */
'use strict';

var VERSION = 'bl-0f7420b021';
var PRECACHE = [
	'./',
	'index.html',
	'manifest.webmanifest',
	'offline.html',
	'assets/css/app.css',
	'assets/css/fonts.css',
	'assets/css/lists.css',
	'assets/css/notify.css',
	'assets/fonts/CormorantGaramond-latin-3.woff2',
	'assets/fonts/CormorantGaramond-latin-ext-2.woff2',
	'assets/fonts/NotoNaskhArabic-arabic-7.woff2',
	'assets/fonts/NotoNaskhArabic-latin-9.woff2',
	'assets/fonts/NotoNaskhArabic-latin-ext-8.woff2',
	'assets/fonts/ReemKufi-arabic-10.woff2',
	'assets/fonts/ReemKufi-latin-12.woff2',
	'assets/fonts/ReemKufi-latin-ext-11.woff2',
	'assets/img/icon.svg',
	'assets/img/icons/apple-touch-icon.png',
	'assets/img/icons/favicon-32.png',
	'assets/img/icons/favicon-48.png',
	'assets/img/icons/icon-192.png',
	'assets/img/icons/icon-512.png',
	'assets/img/icons/maskable-192.png',
	'assets/img/icons/maskable-512.png',
	'assets/js/book.js',
	'assets/js/core.js',
	'assets/js/goodreads.js',
	'assets/js/lists.js',
	'assets/js/main.js',
	'assets/js/notify.js',
	'assets/js/plan.js',
	'assets/js/pwa.js',
	'assets/js/search.js'
];
var SHELL = VERSION + '-shell', COVERS = 'bl-covers';

self.addEventListener('install', function (ev) {
	ev.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(PRECACHE); }));
});
self.addEventListener('activate', function (ev) {
	ev.waitUntil(caches.keys().then(function (keys) {
		return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== COVERS; }).map(function (k) { return caches.delete(k); }));
	}).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (ev) { if (ev.data === 'skipWaiting') self.skipWaiting(); });

function timeout(ms, p) { return new Promise(function (ok, no) { var t = setTimeout(no, ms); p.then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); no(e); }); }); }

self.addEventListener('fetch', function (ev) {
	var req = ev.request, url = new URL(req.url);
	if (req.method !== 'GET') return;

	/* covers: cache first, kept (at most 600) */
	if (/^(covers\.openlibrary\.org|books\.google\.[a-z.]+|books\.googleusercontent\.com|upload\.wikimedia\.org|commons\.wikimedia\.org)$/.test(url.hostname) || (url.hostname === 'archive.org' && url.pathname.indexOf('/services/img/') === 0) || /^ia\d+\.us\.archive\.org$/.test(url.hostname)) {
		ev.respondWith(caches.open(COVERS).then(function (c) {
			return c.match(req).then(function (hit) {
				if (hit) return hit;
				return fetch(req).then(function (res) {
					if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(c, 600); }
					return res;
				});
			});
		}));
		return;
	}
	if (url.origin !== location.origin) return;

	/* the page: network first */
	if (req.mode === 'navigate') {
		ev.respondWith(timeout(3000, fetch(req)).then(function (res) {
			var copy = res.clone();
			caches.open(SHELL).then(function (c) { c.put('index.html', copy); });
			return res;
		}).catch(function () {
			return caches.match('index.html').then(function (hit) { return hit || caches.match('offline.html'); });
		}));
		return;
	}

	/* the rest of the app: cache, refreshed behind */
	ev.respondWith(caches.open(SHELL).then(function (c) {
		return c.match(req, { ignoreSearch: true }).then(function (hit) {
			var net = fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
			return hit || net;
		});
	}));
});

function trim(c, max) {
	c.keys().then(function (keys) { if (keys.length > max) Promise.all(keys.slice(0, keys.length - max).map(function (k) { return c.delete(k); })); });
}
