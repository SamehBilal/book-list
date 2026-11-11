/* The app: registers sw.js, adds an install button to the header (or the steps on iPhone / iPad),
   says when a new version is ready and when the connection drops or comes back.
   After the Ahmed Khaled Tawfik site's pwa.js. */
(function () {
	'use strict';
	var App = window.App, L = App.L;
	var Notify = window.Notify || function () { return { dismiss: function () {}, el: document.createElement('div') }; };
	var html = document.documentElement;
	var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	var deferred = null;
	if (standalone) html.classList.add('is-app');

	/* the browser bar follows the theme */
	function syncThemeColor() {
		var m = document.querySelector('meta[name="theme-color"]');
		if (m) m.setAttribute('content', html.getAttribute('data-theme') === 'light' ? '#f4f1ea' : '#0f1724');
	}
	new MutationObserver(syncThemeColor).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
	syncThemeColor();

	/* ---------- install ---------- */
	var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>';
	function canOffer() { return !standalone && (deferred || ios); }
	function placeButton() {
		var tools = document.querySelector('.site-header .tools');
		if (!tools) return;
		var b = tools.querySelector('.install-app');
		if (!canOffer()) { if (b) b.remove(); return; }
		if (!b) {
			b = document.createElement('button');
			b.type = 'button';
			b.className = 'icon-btn install-app';
			b.innerHTML = ICON;
			b.addEventListener('click', install);
			tools.insertBefore(b, tools.firstChild);
		}
		b.setAttribute('aria-label', L('ثبّت التطبيق', 'Install the app'));
		b.title = L('ثبّت التطبيق', 'Install the app');
	}
	function install() {
		if (deferred) {
			deferred.prompt();
			deferred.userChoice.then(function () { deferred = null; placeButton(); });
			return;
		}
		if (ios) Notify(L('في سفاري: اضغط زر المشاركة <b>⎋</b> ثم «إضافة إلى الشاشة الرئيسية».', 'In Safari, tap Share <b>⎋</b>, then “Add to Home Screen”.'), { title: L('ثبّت قائمة الكتب', 'Install Book List'), html: true, ttl: 9000 });
	}
	window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); deferred = ev; placeButton(); });
	window.addEventListener('appinstalled', function () {
		deferred = null; placeButton();
		Notify(L('صارت قائمة الكتب على شاشتك الرئيسية، وتعمل دون إنترنت.', 'Book List is on your home screen now, and works offline.'), { type: 'success' });
	});
	document.addEventListener('bl-lang', placeButton);
	placeButton();

	/* ---------- connection ---------- */
	window.addEventListener('offline', function () {
		Notify(L('انقطع الاتصال. قوائمك وجولتك في المعرض تعمل دونه؛ البحث يحتاجه.', 'You’re offline. Your lists and fair route still work; search needs the internet.'), { type: 'warning', ttl: 6000 });
	});
	window.addEventListener('online', function () { Notify(L('عاد الاتصال.', 'Back online.'), { type: 'success', ttl: 2500 }); });

	/* ---------- service worker and updates ---------- */
	if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
	/* on this computer (node tools/serve.js) no offline copy, so each change shows at once — unless ?sw=1 */
	if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search)) {
		navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
		return;
	}
	var reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloading) location.reload(); });
	function offerUpdate(worker) {
		var n = Notify(L('نسخة أحدث من التطبيق جاهزة. <span class="ns-actions"><button type="button" class="ns-action">حدّث الآن</button></span>', 'A newer version of the app is ready. <span class="ns-actions"><button type="button" class="ns-action">Update now</button></span>'), { title: L('تحديث', 'Update'), html: true, ttl: 0 });
		var btn = n.el.querySelector('.ns-action');
		if (btn) btn.addEventListener('click', function () { reloading = true; worker.postMessage('skipWaiting'); n.dismiss(); });
	}
	window.addEventListener('load', function () {
		navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
			if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
			reg.addEventListener('updatefound', function () {
				var w = reg.installing;
				if (!w) return;
				w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); });
			});
			document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
		}).catch(function () {});
	});
})();
