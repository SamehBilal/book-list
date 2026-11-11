/* The app's core: language, numbers, the lists' state in this browser, and small helpers.
   Every other script reads window.App. */
(function () {
	'use strict';

	var html = document.documentElement;
	var KEY = 'bl-lists';
	var LRI = String.fromCharCode(0x2066), PDI = String.fromCharCode(0x2069);

	/* the four lists: where a book will be bought, or that it already is */
	var LISTS = {
		fair: { ar: 'من المعرض', en: 'At the fair', icon: 'M3 20V9l9-5 9 5v11M7 20v-6h4v6M15 12h2', where: 'fair' },
		store: { ar: 'من مكتبة', en: 'From a bookshop', icon: 'M4 9h16l-1-4H5zM5 9v11h14V9M9 20v-6h6v6', where: 'store' },
		maybe: { ar: 'ربما', en: 'Maybe', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
		bought: { ar: 'اشتريته', en: 'Bought', icon: 'M5 12.5l4.5 4.5L19 7.5' }
	};
	var ORDER = ['fair', 'store', 'maybe', 'bought'];
	var HALLS = ['1', '2', '3', '4', '5', '6'];
	var SECTIONS = ['A', 'B', 'C'];

	/* ---------- language ---------- */
	var App = {
		LISTS: LISTS, ORDER: ORDER, HALLS: HALLS, SECTIONS: SECTIONS,
		get lang() { return html.lang === 'en' ? 'en' : 'ar'; },
		L: function (ar, en) { return html.lang === 'en' ? en : ar; },
		tt: function (o) { return !o ? '' : typeof o === 'string' ? o : (html.lang === 'en' ? o.en || o.ar : o.ar || o.en) || ''; },
		num: function (n, group) { return html.lang === 'en' ? (group ? Number(n).toLocaleString('en') : String(n)) : Number(n).toLocaleString('ar-EG', { useGrouping: !!group }); },
		esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
		icon: function (k, cls) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '><path d="' + LISTS[k].icon + '"/></svg>'; },
		uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	};

	/* ---------- the books' languages (Open Library's three-letter codes) ---------- */
	App.LANGS = {
		ara: { ar: 'العربية', en: 'Arabic' }, eng: { ar: 'الإنجليزية', en: 'English' }, fre: { ar: 'الفرنسية', en: 'French' },
		ger: { ar: 'الألمانية', en: 'German' }, spa: { ar: 'الإسبانية', en: 'Spanish' }, ita: { ar: 'الإيطالية', en: 'Italian' },
		tur: { ar: 'التركية', en: 'Turkish' }, per: { ar: 'الفارسية', en: 'Persian' }, rus: { ar: 'الروسية', en: 'Russian' },
		jpn: { ar: 'اليابانية', en: 'Japanese' }, chi: { ar: 'الصينية', en: 'Chinese' }, por: { ar: 'البرتغالية', en: 'Portuguese' }
	};
	App.langName = function (code) { return code ? App.tt(App.LANGS[code]) || code.toUpperCase() : ''; };

	/* ---------- covers ---------- */
	App.cover = function (b, size) {
		if (!b) return '';
		if (b.coverId) return 'https://covers.openlibrary.org/b/id/' + b.coverId + '-' + (size || 'M') + '.jpg';
		return b.cover || '';
	};
	/* a book with no cover gets a drawn one: a colour from its title */
	App.hue = function (s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
	App.coverHtml = function (b, size, cls) {
		var src = App.cover(b, size);
		return '<span class="cover ' + (cls || '') + '" style="--h:' + App.hue(b.title) + '">' +
			'<span class="cover-t">' + App.esc(b.title) + (b.authors && b.authors.length ? '<small>' + App.esc(b.authors[0]) + '</small>' : '') + '</span>' +
			(src ? '<img src="' + App.esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()"' +
				/* Internet Archive answers an item with no picture with its own (square) logo: then the drawn cover stays */
				(/archive\.org/.test(src) ? ' onload="if(this.naturalWidth>=this.naturalHeight*.92)this.remove()"' : '') + '>' : '') + '</span>';
	};

	/* ---------- a book's place: «Hall 2 · B14», or the bookshop's name ---------- */
	App.placeText = function (p, short) {
		if (!p) return '';
		if (p.where === 'fair') {
			/* the stand's code kept left-to-right inside Arabic text (an isolate) */
			var code = p.sec || p.num ? LRI + (p.sec || '') + (p.num || '') + PDI : '';
			if (!p.hall && !code) return short ? '' : App.L('في المعرض — المكان لم يُحدد', 'At the fair — no stand yet');
			return [p.hall ? App.L('قاعة ', 'Hall ') + App.num(p.hall) : '', code].filter(Boolean).join(' · ') + (p.pub ? ' — ' + p.pub : '');
		}
		if (p.where === 'store') return p.store ? p.store : (short ? '' : App.L('مكتبة — لم تُحدد', 'A bookshop — not chosen'));
		return '';
	};
	/* «كتاب واحد، كتابان، ٣ كتب، ١١ كتابًا» — or «1 book, 2 books» */
	App.books = function (n) {
		if (html.lang === 'en') return n + (n === 1 ? ' book' : ' books');
		return n === 1 ? 'كتاب واحد' : n === 2 ? 'كتابان' : App.num(n) + (n % 100 >= 3 && n % 100 <= 10 ? ' كتب' : ' كتابًا');
	};
	App.money = function (v) {
		if (v === '' || v == null || isNaN(+v)) return '';
		return App.L(App.num(+v, true) + ' ج.م', 'EGP ' + App.num(+v, true));
	};

	/* ---------- the state ---------- */
	function blank() { var l = {}; ORDER.forEach(function (k) { l[k] = []; }); return { lists: l }; }
	function load() {
		var s = blank();
		try {
			var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
			if (raw && raw.lists) ORDER.forEach(function (k) { if (Array.isArray(raw.lists[k])) s.lists[k] = raw.lists[k].filter(function (b) { return b && b.id && b.title; }); });
		} catch (e) {}
		return s;
	}
	var state = load();
	/* ?demo=1 shows sample lists (for the app's screenshots); nothing of it is saved */
	App.demo = /[?&]demo=1/.test(location.search);
	App.state = function () { return state; };
	App.blank = blank;
	App.setState = function (s) { state = s; App.save(); };
	App.save = function () {
		if (!App.demo) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
		App.emit();
	};
	App.emit = function () { try { document.dispatchEvent(new CustomEvent('bl-change')); } catch (e) {} };
	App.total = function () { var n = 0; ORDER.forEach(function (k) { n += state.lists[k].length; }); return n; };

	/* which list a book is in (a book lives in one list at a time) */
	App.find = function (id) {
		for (var i = 0; i < ORDER.length; i++) {
			var l = state.lists[ORDER[i]];
			for (var j = 0; j < l.length; j++) if (l[j].id === id) return { list: ORDER[i], index: j, book: l[j] };
		}
		return null;
	};
	/* put a book in a list (at the top, or at index); from any other list it moves */
	App.put = function (list, book, index) {
		var at = App.find(book.id), was = at ? at.list : null;
		if (at) state.lists[at.list].splice(at.index, 1);
		book.place = book.place || {};
		/* the fair and bookshop lists say where it will be bought */
		if (LISTS[list].where && book.place.where !== LISTS[list].where) book.place.where = LISTS[list].where;
		if (list === 'bought' && !book.boughtAt) book.boughtAt = new Date().toISOString();
		if (list !== 'bought') delete book.boughtAt;
		if (!book.added) book.added = new Date().toISOString();
		var l = state.lists[list];
		index = index == null ? 0 : Math.max(0, Math.min(index, l.length));
		l.splice(index, 0, book);
		App.save();
		return was;
	};
	App.remove = function (id) {
		var at = App.find(id);
		if (!at) return null;
		state.lists[at.list].splice(at.index, 1);
		App.save();
		return at;
	};
	App.sum = function (list) {
		var s = 0, any = false;
		state.lists[list].forEach(function (b) { var p = parseFloat(b.price); if (!isNaN(p)) { s += p * (b.qty || 1); any = true; } });
		return any ? s : null;
	};

	App.say = function (msg, type) { if (window.Notify) window.Notify(msg, { type: type || 'success', title: App.L('قائمة الكتب', 'Book list') }); };

	window.App = App;
})();
