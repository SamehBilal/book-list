/* Your Goodreads shelves, brought in: Goodreads has no open API any more, but it still exports your
   library as a CSV file (My Books → Import and export → Export library). Choose that file under
   the lists, pick the shelves (Want to Read by default) and the list they go to; each book comes with
   its title, authors, publisher, year, pages, ISBN and private notes, and its Goodreads page.
   Covers are looked up by ISBN on Open Library; a book without one gets the drawn cover. */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc, tt = App.tt;

	/* a CSV file → rows of {column: value} (quotes, commas and line breaks inside quotes) */
	function parse(text) {
		text = text.replace(/^﻿/, '');
		var rows = [], row = [], cell = '', q = false;
		for (var i = 0; i < text.length; i++) {
			var c = text[i];
			if (q) {
				if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
				else cell += c;
			} else if (c === '"') q = true;
			else if (c === ',') { row.push(cell); cell = ''; }
			else if (c === '\n' || c === '\r') {
				if (c === '\r' && text[i + 1] === '\n') i++;
				row.push(cell); cell = ''; rows.push(row); row = [];
			} else cell += c;
		}
		if (cell || row.length) { row.push(cell); rows.push(row); }
		var head = (rows.shift() || []).map(function (h) { return h.trim(); });
		return rows.filter(function (r) { return r.length > 1; }).map(function (r) {
			var o = {}; head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); }); return o;
		});
	}

	/* Goodreads writes ISBNs as ="9789770926990" */
	function isbn(v) { return String(v || '').replace(/[^\dXx]/g, ''); }
	var SHELF = {
		'to-read': { ar: 'أريد قراءته', en: 'Want to Read' },
		'currently-reading': { ar: 'أقرؤه الآن', en: 'Currently Reading' },
		'read': { ar: 'قرأته', en: 'Read' }
	};
	function shelvesOf(r) {
		var s = [r['Exclusive Shelf']].concat((r['Bookshelves'] || '').split(',')).map(function (x) { return x.trim(); }).filter(Boolean);
		return s.filter(function (x, i) { return s.indexOf(x) === i; });
	}

	function toBook(r) {
		var title = (r['Title'] || '').replace(/\s*\(([^()]*#\s*[\d.]+)\)\s*$/, '');
		var series = /\(([^()]*#\s*[\d.]+)\)\s*$/.exec(r['Title'] || '');
		var i13 = isbn(r['ISBN13']), i10 = isbn(r['ISBN']), code = i13 || i10;
		var authors = [r['Author']].concat((r['Additional Authors'] || '').split(',')).map(function (a) { return a.trim(); }).filter(Boolean).slice(0, 3);
		var notes = [r['Private Notes'], series ? series[1] : ''].filter(Boolean).join(' · ');
		return {
			id: 'gr:' + r['Book Id'], grId: r['Book Id'], src: ['gr'],
			title: title, authors: authors,
			cover: code ? 'https://covers.openlibrary.org/b/isbn/' + code + '-M.jpg?default=false' : '',
			publisher: r['Publisher'] || '', year: r['Year Published'] || r['Original Publication Year'] || '',
			lang: /[؀-ۿ]/.test(title) ? 'ara' : '', isbn: code, pages: r['Number of Pages'] || '',
			notes: notes, place: {}, added: r['Date Added'] ? new Date(r['Date Added'].replace(/\//g, '-')).toISOString() : new Date().toISOString()
		};
	}

	/* is it in the lists already (by its Goodreads id, or its ISBN)? */
	function known(b) {
		if (App.find(b.id)) return true;
		if (!b.isbn) return false;
		return App.ORDER.some(function (k) { return App.state().lists[k].some(function (x) { return x.isbn && x.isbn === b.isbn; }); });
	}

	var box = null;
	function choose(rows) {
		var counts = {}, order = [];
		rows.forEach(function (r) { shelvesOf(r).forEach(function (s) { if (!counts[s]) { counts[s] = 0; order.push(s); } counts[s]++; }); });
		order.sort(function (a, b) { return (b === 'to-read') - (a === 'to-read') || (a === 'read') - (b === 'read') || counts[b] - counts[a]; });
		var picked = counts['to-read'] ? ['to-read'] : order.filter(function (s) { return s !== 'read'; }).slice(0, 1);
		if (box) box.remove();
		box = document.createElement('div');
		box.className = 'bk-dialog';
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-modal', 'true');
		box.setAttribute('aria-label', L('استيراد من Goodreads', 'Import from Goodreads'));
		box.innerHTML = '<form class="bk-dialog-card gr-card">' +
			'<header class="bd-head gr-head"><div class="bd-main"><p class="eyebrow">Goodreads</p><h2>' + L('استيراد رفوفك', 'Import your shelves') + '</h2>' +
				'<p class="muted">' + L('في الملف ' + App.books(rows.length) + '. اختر الرفوف والقائمة التي تذهب إليها؛ ما في قوائمك بالفعل لا يتكرر.', rows.length + ' books in the file. Choose the shelves and the list they go to; what is already in your lists is skipped.') + '</p></div>' +
				'<button type="button" class="bd-x" data-cancel aria-label="' + esc(L('إغلاق', 'Close')) + '">×</button></header>' +
			'<fieldset class="bd-sec"><legend>' + L('الرفوف', 'Shelves') + '</legend><div class="gr-shelves">' + order.map(function (s) {
				return '<label class="gr-shelf"><input type="checkbox" name="shelf" value="' + esc(s) + '"' + (picked.indexOf(s) >= 0 ? ' checked' : '') + '><span>' + esc(SHELF[s] ? tt(SHELF[s]) : s) + ' <b>' + App.num(counts[s]) + '</b></span></label>';
			}).join('') + '</div></fieldset>' +
			'<fieldset class="bd-sec"><legend>' + L('إلى القائمة', 'Into the list') + '</legend><div class="seg seg-lists">' + App.ORDER.map(function (k) {
				return '<label><input type="radio" name="list" value="' + k + '"' + (k === 'maybe' ? ' checked' : '') + '><span>' + App.icon(k) + esc(tt(App.LISTS[k])) + '</span></label>';
			}).join('') + '</div></fieldset>' +
			'<footer class="bd-act"><button type="submit" class="btn btn-primary" data-go></button>' +
				'<button type="button" class="btn btn-ghost" data-cancel>' + L('إلغاء', 'Cancel') + '</button></footer></form>';
		document.body.appendChild(box);
		document.documentElement.classList.add('bd-open');
		var form = box.querySelector('form');
		var books = function () {
			var on = [].map.call(form.querySelectorAll('[name="shelf"]:checked'), function (i) { return i.value; });
			return rows.filter(function (r) { return shelvesOf(r).some(function (s) { return on.indexOf(s) >= 0; }); }).map(toBook);
		};
		var sync = function () {
			var all = books(), fresh = all.filter(function (b) { return !known(b); });
			var go = form.querySelector('[data-go]');
			go.disabled = !fresh.length;
			go.textContent = fresh.length ? L('استورد ' + App.books(fresh.length), 'Import ' + App.books(fresh.length)) : L('لا جديد لاستيراده', 'Nothing new to import');
			go.title = all.length > fresh.length ? L(App.books(all.length - fresh.length) + ' في قوائمك بالفعل', App.books(all.length - fresh.length) + ' already in your lists') : '';
		};
		var close = function () { box.remove(); box = null; document.documentElement.classList.remove('bd-open'); };
		form.addEventListener('change', sync);
		form.addEventListener('submit', function (ev) {
			ev.preventDefault();
			var list = form.list.value;
			var fresh = books().filter(function (b) { return !known(b); });
			/* the newest added on Goodreads at the top */
			fresh.sort(function (a, b) { return (b.added || '').localeCompare(a.added || ''); });
			var l = App.state().lists[list];
			fresh.forEach(function (b) {
				if (App.LISTS[list].where) b.place.where = App.LISTS[list].where;
				if (list === 'bought') b.boughtAt = new Date().toISOString();
				l.push(b);
			});
			App.save();
			close();
			App.say(L('استُورد ' + App.books(fresh.length) + ' من Goodreads إلى «', 'Imported ' + App.books(fresh.length) + ' from Goodreads into “') + tt(App.LISTS[list]) + L('».', '”.'));
		});
		box.addEventListener('click', function (ev) { if (ev.target === box || ev.target.closest('[data-cancel]')) close(); });
		box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } });
		sync();
		setTimeout(function () { var f = form.querySelector('input'); if (f) f.focus(); }, 40);
	}

	function importFile(file) {
		var reader = new FileReader();
		reader.onload = function () {
			var rows = [];
			try { rows = parse(String(reader.result)); } catch (e) {}
			if (!rows.length || !('Book Id' in rows[0]) || !('Title' in rows[0])) {
				App.say(L('هذا الملف ليس تصديرًا من Goodreads. صدّره من My Books ← Import and export ← Export library.', 'That isn’t a Goodreads export. Get one from My Books → Import and export → Export library.'), 'error');
				return;
			}
			choose(rows);
		};
		reader.readAsText(file);
	}

	window.Goodreads = { importFile: importFile, parse: parse };
})();
