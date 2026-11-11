#!/usr/bin/env node
/* Makes the app's icons (from assets/img/icon.svg) and its install screenshots (the manifest's
   "screenshots": wide 1280×720 and narrow 412×915), with Chrome or Edge in headless mode driven
   over the DevTools protocol. Needs Node 22+ (its built-in WebSocket) and the internet (the
   screenshots search Open Library and show its covers).
     node tools/shoot.js            icons and screenshots
     node tools/shoot.js icons      icons only
     node tools/shoot.js screens    screenshots only
   Set CHROME=/path/to/chrome if it is not found. */
'use strict';
var fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), cp = require('child_process');
var root = path.join(__dirname, '..');
var what = process.argv[2] || 'all';

function findChrome() {
	var c = [process.env.CHROME,
		'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
	for (var i = 0; i < c.length; i++) if (c[i] && fs.existsSync(c[i])) return c[i];
	throw new Error('Chrome not found; set CHROME=…');
}

/* a small static server for the app's folder */
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serve() {
	return new Promise(function (ok) {
		var s = http.createServer(function (req, res) {
			var p = decodeURIComponent(req.url.split('?')[0]);
			if (p.endsWith('/')) p += 'index.html';
			var f = path.join(root, p);
			if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
			/* no service worker in the screenshots */
			if (p === '/sw.js') { res.writeHead(404); return res.end(); }
			res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
			fs.createReadStream(f).pipe(res);
		});
		s.listen(0, '127.0.0.1', function () { ok(s); });
	});
}

/* Chrome and one page over the DevTools protocol */
function launch() {
	var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-shoot-'));
	var proc = cp.spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
	return new Promise(function (ok, no) {
		var buf = '';
		proc.stderr.on('data', function (d) {
			buf += d;
			var m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
			if (m) { proc.stderr.removeAllListeners('data'); ok({ proc: proc, ws: m[1], dir: dir }); }
		});
		proc.on('exit', function () { no(new Error('Chrome exited: ' + buf)); });
	});
}
function connect(url) {
	return new Promise(function (ok) {
		var ws = new WebSocket(url), id = 0, waiting = {}, listeners = [];
		ws.onmessage = function (e) {
			var m = JSON.parse(e.data);
			if (m.id && waiting[m.id]) { var w = waiting[m.id]; delete waiting[m.id]; m.error ? w[1](new Error(JSON.stringify(m.error))) : w[0](m.result); }
			else listeners.forEach(function (l) { l(m); });
		};
		ws.onopen = function () {
			ok({
				send: function (method, params, sessionId) {
					return new Promise(function (a, b) { var i = ++id; waiting[i] = [a, b]; ws.send(JSON.stringify({ id: i, method: method, params: params || {}, sessionId: sessionId })); });
				},
				on: function (l) { listeners.push(l); },
				close: function () { ws.close(); }
			});
		};
	});
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function page(cdp) {
	var t = await cdp.send('Target.createTarget', { url: 'about:blank' });
	var s = (await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
	var P = function (m, p) { return cdp.send(m, p, s); };
	await P('Page.enable'); await P('Runtime.enable');
	return {
		P: P,
		size: function (w, h, mobile) { return P('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); },
		go: async function (url) { await P('Page.navigate', { url: url }); await sleep(600); await this.idle(); },
		js: async function (expr) { var r = await P('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.value; },
		/* until the page's images (and the search) have come in */
		idle: async function (max) {
			var end = Date.now() + (max || 15000);
			while (Date.now() < end) {
				var ready = await this.js('document.readyState==="complete" && !document.querySelector(".is-skel") && [].every.call(document.images,function(i){return i.complete})');
				if (ready) break;
				await sleep(250);
			}
			await sleep(500);
		},
		shot: async function (file, type, clip) {
			var r = await P('Page.captureScreenshot', Object.assign({ format: type || 'jpeg', quality: type === 'png' ? undefined : 82, captureBeyondViewport: false }, clip ? { clip: clip } : {}));
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
			console.log('  ' + path.relative(root, file));
		},
		mouse: function (type, x, y) { return P('Input.dispatchMouseEvent', { type: type, x: x, y: y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }); }
	};
}

async function icons(pg, base) {
	console.log('icons');
	var svg = fs.readFileSync(path.join(root, 'assets/img/icon.svg'), 'utf8');
	/* "any": the rounded icon on transparent; "maskable" and Apple's: square, full-bleed (the art already sits inside the
	   maskable safe circle, 40% of the size from the centre) — the platform rounds them itself */
	var src = function (square) { return 'data:image/svg+xml;base64,' + Buffer.from(square ? svg.replace('rx="112"', 'rx="0"') : svg).toString('base64'); };
	var jobs = [['icon-192.png', 192, 'any'], ['icon-512.png', 512, 'any'], ['maskable-192.png', 192, 'mask'], ['maskable-512.png', 512, 'mask'], ['apple-touch-icon.png', 180, 'apple'], ['favicon-32.png', 32, 'any'], ['favicon-48.png', 48, 'any']];
	for (var i = 0; i < jobs.length; i++) {
		var j = jobs[i], n = j[1], data = src(j[2] !== 'any');
		var scale = 1, bg = 'transparent';
		await pg.size(n, n);
		await pg.P('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
		await pg.P('Page.navigate', { url: 'about:blank' }); await sleep(150);
		await pg.js('document.documentElement.innerHTML=' + JSON.stringify('<body style="margin:0;width:' + n + 'px;height:' + n + 'px;display:grid;place-items:center;background:' + bg + '"><img src="' + data + '" style="width:' + Math.round(n * scale) + 'px;height:' + Math.round(n * scale) + 'px"></body>') + ';new Promise(function(r){var i=document.images[0];i.complete?r():i.onload=r})');
		await sleep(150);
		await pg.shot(path.join(root, 'assets/img/icons', j[0]), 'png', { x: 0, y: 0, width: n, height: n, scale: 1 });
	}
	await pg.P('Emulation.clearDeviceMetricsOverride');
}

async function screens(pg, base) {
	console.log('screenshots');
	var out = function (f) { return path.join(root, 'assets/img/screens', f); };
	var q = encodeURIComponent('نجيب محفوظ');
	/* the app in Arabic, dark */
	await pg.P('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

	/* wide */
	await pg.size(1280, 720);
	await pg.go(base + '?demo=1&q=' + q + '#search');
	await pg.js('scrollTo(0, 250)'); await pg.idle();
	await pg.shot(out('wide-search.jpg'));
	/* mid-drag: press on the second cover, move it over the fair list */
	var r = await pg.js('(function(){var c=document.querySelectorAll(".bk-card .cover")[1].getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]})()');
	await pg.mouse('mouseMoved', r[0], r[1]);
	await pg.mouse('mousePressed', r[0], r[1]);
	for (var i = 1; i <= 6; i++) await pg.mouse('mouseMoved', r[0] + i * 4, r[1] + i * 4);
	await sleep(900);
	var z = await pg.js('(function(){var c=document.querySelector(".ls-panel .ls-zone[data-list=fair]").getBoundingClientRect();return [c.left+c.width*0.28,c.top+c.height*0.62]})()');
	for (i = 1; i <= 10; i++) await pg.mouse('mouseMoved', r[0] + (z[0] - r[0]) * i / 10, r[1] + (z[1] - r[1]) * i / 10);
	await sleep(600);
	await pg.shot(out('wide-drag.jpg'));
	await pg.js('dispatchEvent(new Event("pointercancel"))');
	await pg.mouse('mouseReleased', 5, 5);
	await pg.go(base + '?demo=1#plan');
	await pg.shot(out('wide-plan.jpg'));

	/* narrow (a phone) */
	await pg.size(412, 915, true);
	await pg.go(base + '?demo=1&q=' + q + '#search');
	await pg.js('scrollTo(0, 250)'); await pg.idle();
	await pg.shot(out('narrow-search.jpg'));
	await pg.go(base + '?demo=1#lists');
	await pg.shot(out('narrow-lists.jpg'));
	await pg.go(base + '?demo=1#plan');
	await pg.shot(out('narrow-plan.jpg'));
	await pg.js('Book.open("ol:OL1599742W",{focus:"place"})'); await pg.idle();
	await pg.shot(out('narrow-book.jpg'));
}

(async function () {
	var server = await serve(), base = 'http://127.0.0.1:' + server.address().port + '/index.html';
	var chrome = await launch(), cdp = await connect(chrome.ws);
	try {
		var pg = await page(cdp);
		if (what === 'all' || what === 'icons') await icons(pg, base);
		if (what === 'all' || what === 'screens') await screens(pg, base);
	} finally {
		cdp.close(); chrome.proc.kill(); server.close();
		setTimeout(function () { try { fs.rmSync(chrome.dir, { recursive: true, force: true }); } catch (e) {} }, 800);
	}
})().catch(function (e) { console.error(e); process.exit(1); });
