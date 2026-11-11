#!/usr/bin/env node
/* A small static server for trying the app locally (a service worker needs http, not file:):
     node tools/serve.js [port]      → http://localhost:8080 */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..'), port = +process.argv[2] || 8080;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
http.createServer(function (req, res) {
	var p = decodeURIComponent(req.url.split('?')[0]);
	if (p.endsWith('/')) p += 'index.html';
	var f = path.join(root, p);
	if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
	res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
	fs.createReadStream(f).pipe(res);
}).listen(port, function () { console.log('http://localhost:' + port); });
