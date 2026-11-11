#!/usr/bin/env node
/* Rewrites sw.js's PRECACHE (the app's files) and VERSION (a hash of them), so an installed app
   picks up the change and offers to update. Run after changing any file:  node tools/build-sw.js */
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var root = path.join(__dirname, '..');

function walk(dir) {
	return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(function (d) {
		var p = dir + '/' + d.name;
		return d.isDirectory() ? walk(p) : [p];
	});
}
var files = ['index.html', 'offline.html', 'manifest.webmanifest']
	.concat(walk('assets/css'), walk('assets/js'), walk('assets/fonts'), walk('assets/img/icons'), ['assets/img/icon.svg'])
	.filter(function (f) { return !/\.(map|md)$/.test(f); })
	.sort(function (a, b) { return a.indexOf('/') - b.indexOf('/') || a.localeCompare(b); });

var hash = crypto.createHash('sha1');
files.forEach(function (f) { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); });
var version = 'bl-' + hash.digest('hex').slice(0, 10);

var swPath = path.join(root, 'sw.js');
var sw = fs.readFileSync(swPath, 'utf8')
	.replace(/var VERSION = '[^']*';/, "var VERSION = '" + version + "';")
	.replace(/var PRECACHE = \[[\s\S]*?\];/, 'var PRECACHE = [\n\t\'./\',\n' + files.map(function (f) { return "\t'" + f + "'"; }).join(',\n') + '\n];');
fs.writeFileSync(swPath, sw);
console.log('sw.js: ' + version + ', ' + (files.length + 1) + ' files');
