/* Search: Open Library's search API, by title, by author or both (an ISBN goes straight to it).
   Each result is a cover you can drag to a list (lists.js), or click to see its details (book.js).
   Search.editions(workKey) lists a work's editions for the details dialog. */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc;
	var API = 'https://openlibrary.org';
	var FIELDS = 'key,title,subtitle,author_name,first_publish_year,cover_i,publisher,language,isbn,edition_count,number_of_pages_median';
	var PER = 24;

	var form, input, results, status, moreBtn, hintEmpty;
	var last = null, page = 1, found = [], ctrl = null;
	var byKey = {};

	/* an Open Library doc → a book record (the shape the lists keep) */
	function fromDoc(d) {
		var isbn = (d.isbn || []).filter(function (x) { return x.length === 13; })[0] || (d.isbn || [])[0] || '';
		return {
			id: d.key ? 'ol:' + d.key.replace('/works/', '') : 'isbn:' + isbn,
			title: d.title + (d.subtitle && d.title.length < 40 ? ': ' + d.subtitle : ''),
			authors: (d.author_name || []).slice(0, 3),
			coverId: d.cover_i || null,
			work: d.key || '',
			year: d.first_publish_year ? String(d.first_publish_year) : '',
			firstYear: d.first_publish_year || null,
			publisher: '',
			publishers: (d.publisher || []).slice(0, 8),
			langs: (d.language || []).slice(0, 6),
			lang: (d.language || []).length === 1 ? d.language[0] : '',
			isbn: isbn,
			pages: d.number_of_pages_median || '',
			editions: d.edition_count || 0,
			place: {}
		};
	}

	function query(q, by, lang) {
		var p = new URLSearchParams();
		var digits = q.replace(/[-\s]/g, '');
		if (/^(97[89])?\d{9}[\dXx]$/.test(digits)) p.set('isbn', digits);
		else if (by === 'title') p.set('title', q);
		else if (by === 'author') p.set('author', q);
		else p.set('q', q);
		if (lang) p.set('language', lang);
		p.set('fields', FIELDS);
		p.set('limit', PER);
		p.set('page', page);
		return API + '/search.json?' + p.toString();
	}

	function run(more) {
		var q = input.value.trim();
		if (!q) { input.focus(); return; }
		var by = form.querySelector('[name="by"]:checked').value, lang = form.lang.value;
		if (!more) { page = 1; found = []; results.innerHTML = skeleton(); }
		else page++;
		last = { q: q, by: by, lang: lang };
		try { sessionStorage.setItem('bl-last', JSON.stringify(last)); } catch (e) {}
		hintEmpty.hidden = true;
		moreBtn.hidden = true;
		status.textContent = L('جارٍ البحث…', 'Searching…');
		if (ctrl) ctrl.abort();
		ctrl = 'AbortController' in window ? new AbortController() : null;
		fetch(query(q, by, lang), ctrl ? { signal: ctrl.signal } : {})
			.then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
			.then(function (j) {
				var docs = (j.docs || []).map(fromDoc);
				docs.forEach(function (b) { byKey[b.id] = b; });
				found = found.concat(docs);
				var n = j.numFound || j.num_found || 0;
				status.textContent = found.length
					? L('وُجد ' + App.num(n, true) + ' كتابًا. اسحب الغلاف إلى قائمة، أو اضغط عليه لتفاصيله.', n.toLocaleString('en') + ' books found. Drag a cover to a list, or tap it for its details.')
					: L('لم يُعثر على شيء. جرّب كلمات أقل، أو الاسم بالإنجليزية، أو أضف الكتاب يدويًا.', 'Nothing found. Try fewer words, the English name, or add the book by hand.');
				render();
				moreBtn.hidden = found.length >= n || !docs.length;
			})
			.catch(function (e) {
				if (e && e.name === 'AbortError') return;
				if (!more) results.innerHTML = '';
				status.textContent = navigator.onLine === false
					? L('لا اتصال بالإنترنت؛ البحث يحتاجه. قوائمك تعمل دونه.', 'You’re offline; search needs the internet. Your lists work without it.')
					: L('تعذّر الوصول إلى Open Library. حاول بعد قليل.', 'Could not reach Open Library. Try again in a moment.');
			});
	}

	function skeleton() { var s = ''; for (var i = 0; i < 12; i++) s += '<div class="bk-card is-skel"><span class="cover"></span><span class="bk-t"><i></i><i></i></span></div>'; return s; }

	function cardHtml(b) {
		var at = App.find(b.id);
		return '<article class="bk-card" data-book="' + esc(b.id) + '" tabindex="0" aria-label="' + esc(b.title + (b.authors[0] ? ' — ' + b.authors[0] : '')) + '">' +
			App.coverHtml(b, 'M') +
			(at ? '<span class="bk-in" title="' + esc(App.tt(App.LISTS[at.list])) + '">' + App.icon(at.list) + '</span>' : '') +
			'<span class="bk-t"><b>' + esc(b.title) + '</b>' +
				'<small>' + esc(b.authors.join(L('، ', ', ')) || L('مؤلف غير معروف', 'Unknown author')) + '</small>' +
				'<small class="bk-meta">' + [b.firstYear ? App.num(b.firstYear) : '', b.editions > 1 ? App.num(b.editions) + L(' طبعة', ' editions') : ''].filter(Boolean).join(' · ') + '</small></span>' +
			'<span class="bk-add" role="group" aria-label="' + esc(L('أضف إلى', 'Add to')) + '">' + App.ORDER.map(function (k) {
				return '<button type="button" data-add="' + k + '" title="' + esc(App.tt(App.LISTS[k])) + '" aria-label="' + esc(L('أضف إلى ', 'Add to ') + App.tt(App.LISTS[k])) + '"' + (at && at.list === k ? ' aria-pressed="true"' : '') + '>' + App.icon(k) + '</button>';
			}).join('') + '</span>' +
		'</article>';
	}
	function render() { results.innerHTML = found.map(cardHtml).join(''); }

	/* a book from the results (or the lists) by its id */
	function get(id) { var at = App.find(id); return at ? at.book : byKey[id] || null; }

	/* ---------- a work's editions ---------- */
	var edCache = {};
	function editions(work) {
		if (!work) return Promise.resolve([]);
		if (edCache[work]) return Promise.resolve(edCache[work]);
		return fetch(API + work + '/editions.json?limit=60').then(function (r) { return r.json(); }).then(function (j) {
			var list = (j.entries || []).map(function (e) {
				var y = /(\d{4})/.exec(e.publish_date || '');
				return {
					key: e.key,
					title: e.title + (e.subtitle ? ': ' + e.subtitle : ''),
					publisher: (e.publishers || [])[0] || '',
					year: y ? y[1] : '',
					edition: e.edition_name || '',
					format: e.physical_format || '',
					lang: ((e.languages || [])[0] || {}).key ? e.languages[0].key.replace('/languages/', '') : '',
					isbn: (e.isbn_13 || [])[0] || (e.isbn_10 || [])[0] || '',
					pages: e.number_of_pages || '',
					coverId: (e.covers || []).filter(function (c) { return c > 0; })[0] || null
				};
			});
			/* Arabic first, then the newest */
			list.sort(function (a, b) { return (b.lang === 'ara') - (a.lang === 'ara') || (+b.year || 0) - (+a.year || 0); });
			edCache[work] = list;
			return list;
		});
	}

	/* ---------- boot ---------- */
	function examples() {
		var ex = App.lang === 'en'
			? ['Naguib Mahfouz', 'The Prophet', 'Ahmed Khaled Towfik', 'Season of Migration to the North', 'Italo Calvino', 'Radwa Ashour']
			: ['نجيب محفوظ', 'أولاد حارتنا', 'Ahmed Khaled Towfik', 'جبران خليل جبران', 'Season of Migration to the North', 'رضوى عاشور'];
		document.getElementById('try').innerHTML = ex.map(function (x) { return '<button type="button" class="chip" data-try="' + esc(x) + '">' + esc(x) + '</button>'; }).join('');
	}

	function init() {
		form = document.querySelector('form.search');
		input = document.getElementById('q');
		results = document.getElementById('results');
		status = document.getElementById('status');
		moreBtn = document.getElementById('more');
		hintEmpty = document.getElementById('hint-empty');
		form.addEventListener('submit', function (ev) { ev.preventDefault(); input.blur(); run(false); });
		form.addEventListener('change', function (ev) { if (ev.target.name !== 'q' && input.value.trim()) run(false); });
		moreBtn.addEventListener('click', function () { run(true); });
		document.getElementById('try').addEventListener('click', function (ev) {
			var b = ev.target.closest('[data-try]'); if (!b) return;
			input.value = b.getAttribute('data-try'); run(false);
		});
		form.querySelector('[data-manual]').addEventListener('click', function () { window.Book.open(null, { list: 'fair', manual: true, title: input.value.trim() }); });

		results.addEventListener('click', function (ev) {
			var card = ev.target.closest('.bk-card[data-book]');
			if (!card || window.Lists.justDragged()) return;
			var b = get(card.getAttribute('data-book'));
			if (!b) return;
			var add = ev.target.closest('[data-add]');
			if (add) {
				var k = add.getAttribute('data-add'), at = App.find(b.id);
				if (at && at.list === k) { window.Book.open(b.id); return; }
				window.Lists.drop(k, b);
				return;
			}
			window.Book.open(at(b) ? b.id : null, at(b) ? null : { book: b });
		});
		results.addEventListener('keydown', function (ev) {
			if (ev.key !== 'Enter' || !ev.target.matches('.bk-card')) return;
			ev.preventDefault(); ev.target.click();
		});
		function at(b) { return App.find(b.id); }

		document.addEventListener('bl-change', function () { if (found.length) { var y = window.scrollY; render(); window.scrollTo(0, y); } });
		document.addEventListener('bl-lang', function () { examples(); if (found.length) render(); });
		examples();

		/* the last search comes back when the app is reopened in this tab */
		try {
			var s = JSON.parse(sessionStorage.getItem('bl-last') || 'null');
			if (s && s.q) { input.value = s.q; var r = form.querySelector('[name="by"][value="' + s.by + '"]'); if (r) r.checked = true; form.lang.value = s.lang || ''; run(false); }
		} catch (e) {}
	}

	window.Search = { init: init, get: get, editions: editions, fromDoc: fromDoc, run: function (q) { input.value = q; run(false); } };
})();
