/* Search, from several sources at once, because Arabic (and Egyptian) books are thin on any one of them:
   - Internet Archive: among its books, the Bibliotheca Alexandrina's catalogue records — Egyptian
     publishers, years, page counts — and many Arabic books with their covers;
   - Google Books: the widest for Arabic publishers; its free shared quota is often spent, so a free
     key of your own can be added (it stays in this browser);
   - Open Library: editions, ISBNs and covers, mostly for translated and older books;
   - Wikidata: the well-known novels and their authors, in Arabic and English.
   Each is asked by title, by author or both (an ISBN goes to the ones that know ISBNs), with the
   hamza and other spellings of Arabic tried together. The answers are merged — the same book from
   two sources becomes one, filling each other's gaps — and ranked with Arabic first for an Arabic query.
   Each result is a cover to drag to a list (lists.js) or tap for its details (book.js). */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc;
	var PER = 20;

	/* ---------- Arabic, for matching ---------- */
	var AR = /[؀-ۿ]/;
	function norm(s) {
		return String(s || '').toLowerCase()
			.replace(/[ً-ْٰـ]/g, '')          /* diacritics, tatweel */
			.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
			.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
	}
	/* the spellings to ask for: as typed, and without hamzas (catalogues often drop them) */
	function variants(q) {
		var plain = q.replace(/[أإآ]/g, 'ا').replace(/ى(?=\s|$)/g, 'ي');
		return plain !== q ? [q, plain] : [q];
	}
	function words(s) { return norm(s).split(' ').filter(function (w) { return w.length > 2; }); }
	function isbnOf(q) { var d = q.replace(/[-\s]/g, ''); return /^(97[89])?\d{9}[\dXx]$/.test(d) ? d : ''; }
	function year(s) { var m = /(\d{4})/.exec(s || ''); return m ? m[1] : ''; }
	var LANG2 = { ar: 'ara', en: 'eng', fr: 'fre', de: 'ger', es: 'spa', it: 'ita', tr: 'tur', fa: 'per', ru: 'rus', ja: 'jpn', zh: 'chi', pt: 'por' };
	function getJSON(url, signal) { return fetch(url, signal ? { signal: signal } : {}).then(function (r) { if (!r.ok) { var e = new Error(r.status); e.status = r.status; throw e; } return r.json(); }); }

	/* ---------- the sources ---------- */
	var SOURCES = {
		ia: {
			name: 'Internet Archive', short: 'Archive', weight: 1,
			search: function (q, by, lang, page, signal) {
				var isbn = isbnOf(q);
				var vs = variants(q).map(function (v) { return '(' + v.replace(/[()":\\]/g, ' ') + ')'; });
				var f = function (field) { return vs.map(function (v) { return field + ':' + v; }).join(' OR '); };
				var expr = isbn ? 'isbn:' + isbn : by === 'title' ? f('title') : by === 'author' ? f('creator') : f('title') + ' OR ' + f('creator');
				expr = '(' + expr + ') AND mediatype:texts' + (lang ? ' AND language:(' + ({ ara: 'Arabic OR ara', eng: 'English OR eng', fre: 'French OR fre' }[lang] || lang) + ')' : '');
				var p = new URLSearchParams({ q: expr, rows: PER, page: page, output: 'json' });
				['identifier', 'title', 'creator', 'publisher', 'date', 'language', 'isbn'].forEach(function (x) { p.append('fl[]', x); });
				return getJSON('https://archive.org/advancedsearch.php?' + p, signal).then(function (j) {
					var r = j.response || {};
					var books = (r.docs || []).map(fromIA).filter(Boolean);
					/* an upload with no author but the searched name at the end of its title: «مختارات قصصية د. أحمد خالد توفيق» */
					if (by !== 'title') books.forEach(function (b) {
						var n = norm(q), t = norm(b.title);
						if (b.authors.length || t.length <= n.length + 3 || t.slice(-n.length) !== n) return;
						var t2 = b.title.split(/\s+/).slice(0, -q.split(/\s+/).length).join(' ').replace(/[\s\-–—|:،,]+(د\.?)?$/, '').replace(/\s+د\.?$/, '').trim();
						if (norm(t2).length < 2) return;
						b.title = t2;
						b.authors = [q];
					});
					return { total: r.numFound || 0, books: books };
				});
			}
		},
		gb: {
			name: 'Google Books', short: 'Google', weight: 1.1,
			search: function (q, by, lang, page, signal) {
				var isbn = isbnOf(q);
				var p = new URLSearchParams({ q: isbn ? 'isbn:' + isbn : by === 'title' ? 'intitle:' + q : by === 'author' ? 'inauthor:' + q : q, maxResults: PER, startIndex: (page - 1) * PER, printType: 'books' });
				if (lang) p.set('langRestrict', { ara: 'ar', eng: 'en', fre: 'fr' }[lang] || '');
				var key = gbKey(); if (key) p.set('key', key);
				return getJSON('https://www.googleapis.com/books/v1/volumes?' + p, signal).then(function (j) {
					return { total: j.totalItems || 0, books: (j.items || []).map(fromGB) };
				});
			}
		},
		ol: {
			name: 'Open Library', short: 'OL', weight: 0.9,
			search: function (q, by, lang, page, signal) {
				var p = new URLSearchParams(), isbn = isbnOf(q);
				if (isbn) p.set('isbn', isbn);
				else if (by === 'title') p.set('title', q);
				else if (by === 'author') p.set('author', q);
				else p.set('q', q);
				if (lang) p.set('language', lang);
				p.set('fields', 'key,title,subtitle,author_name,first_publish_year,cover_i,publisher,language,isbn,edition_count,number_of_pages_median');
				p.set('limit', PER); p.set('page', page);
				return getJSON('https://openlibrary.org/search.json?' + p, signal).then(function (j) {
					return { total: j.numFound || j.num_found || 0, books: (j.docs || []).map(fromOL) };
				});
			}
		},
		wd: {
			name: 'Wikidata', short: 'Wikidata', weight: 0.8,
			search: function (q, by, lang, page, signal) { return wikidata(q, by, lang, page, signal); }
		}
	};
	var ORDER_SRC = ['ia', 'gb', 'ol', 'wd'];

	/* ---------- each source's record → a book (the shape the lists keep) ---------- */
	function fromOL(d) {
		var isbn = (d.isbn || []).filter(function (x) { return x.length === 13; })[0] || (d.isbn || [])[0] || '';
		return {
			id: 'ol:' + d.key.replace('/works/', ''), src: ['ol'],
			title: d.title + (d.subtitle && d.title.length < 40 ? ': ' + d.subtitle : ''),
			authors: (d.author_name || []).slice(0, 3),
			coverId: d.cover_i || null, work: d.key || '',
			year: d.first_publish_year ? String(d.first_publish_year) : '', firstYear: d.first_publish_year || null,
			publisher: '', publishers: (d.publisher || []).slice(0, 8),
			lang: (d.language || []).length === 1 ? d.language[0] : (d.language || []).indexOf('ara') >= 0 ? 'ara' : '',
			isbn: isbn, pages: d.number_of_pages_median || '', editions: d.edition_count || 0, place: {}
		};
	}
	function fromGB(v) {
		var i = v.volumeInfo || {}, ids = i.industryIdentifiers || [];
		var isbn = (ids.filter(function (x) { return x.type === 'ISBN_13'; })[0] || ids.filter(function (x) { return x.type === 'ISBN_10'; })[0] || {}).identifier || '';
		var img = (i.imageLinks || {}).thumbnail || (i.imageLinks || {}).smallThumbnail || '';
		return {
			id: 'gb:' + v.id, src: ['gb'],
			title: (i.title || '') + (i.subtitle && (i.title || '').length < 40 ? ': ' + i.subtitle : ''),
			authors: (i.authors || []).slice(0, 3),
			cover: img ? img.replace(/^http:/, 'https:').replace('&edge=curl', '') : '',
			link: i.infoLink || i.canonicalVolumeLink || '',
			year: year(i.publishedDate), firstYear: +year(i.publishedDate) || null,
			publisher: i.publisher || '', publishers: i.publisher ? [i.publisher] : [],
			lang: LANG2[i.language] || i.language || '', isbn: isbn, pages: i.pageCount || '', place: {}
		};
	}
	function one(x) { return Array.isArray(x) ? x[0] : x; }
	/* «توفيق، احمد خالد.» → «احمد خالد توفيق» */
	function person(s) {
		s = String(s || '').replace(/["“”]/g, '').replace(/[.،,\s]+$/, '').replace(/\s*\(?\d{4}\s*-\s*(\d{4})?\)?$/, '').trim();
		var m = /^([^،,]+)[،,]\s*(.+)$/.exec(s);
		return m ? (m[2] + ' ' + m[1]).replace(/\s+/g, ' ').trim() : s;
	}
	var GENRE = /\s+-\s+(قصص|قصة|رواية|روايه|مقالات|شعر|ديوان|مسرحية|سيرة|خواطر|نصوص|دراسة|دراسات|novel|stories|poems)\.?$/i;
	function fromIA(d) {
		var raw = one(d.title) || '';
		/* the Bibliotheca Alexandrina's records: «214738 - الان افهم - مقالات» */
		/* and its scans' names: «311470_تراب_الماس», «الشحاذ [01132] --- محفوظ، نجيب،», «…_السادات_01193_محفوظ،» */
		raw = raw.replace(/_/g, ' ').replace(/\s*-{2,}.*$/, '').replace(/\s*\[\d+\]\s*/g, ' ').replace(/\s\d{4,6}\s+[^\s]+[،,]\s*$/, '').replace(/^\d{4,}\s+/, '').replace(/\s+/g, ' ').replace(/^[\s\-–—|:.]+/, '');
		var title = raw.replace(/^\d{3,}\s*-\s*/, '').replace(GENRE, '').replace(/\s*[(\[]?\s*(pdf|نسخة|جودة|تحميل)[^)\]]*[)\]]?\s*$/i, '').trim();
		var creators = [].concat(d.creator || []).map(person).filter(Boolean);
		/* uploads often end the title with the author's name: «الطريف في طب الريف أحمد خالد توفيق» */
		creators.forEach(function (c) {
			var n = norm(c), t = norm(title);
			if (!n || t.length <= n.length + 3 || t.slice(-n.length) !== n) return;
			var t2 = title.split(/\s+/).slice(0, -c.split(/\s+/).length).join(' ').replace(/[\s\-–—|:،,]+(د\.?)?$/, '').trim();
			if (norm(t2).length >= 2) title = t2;
		});
		if (norm(title).length < 2) return null;
		var langs = [].concat(d.language || []).map(function (l) { return { arabic: 'ara', ara: 'ara', english: 'eng', eng: 'eng', french: 'fre', fre: 'fre' }[String(l).toLowerCase()] || ''; }).filter(Boolean);
		return {
			id: 'ia:' + d.identifier, src: ['ia'],
			title: title, authors: creators.slice(0, 3),
			cover: 'https://archive.org/services/img/' + encodeURIComponent(d.identifier),
			year: year(one(d.date)), firstYear: +year(one(d.date)) || null,
			publisher: /^(none|null|unknown|n\/a)$/i.test(one(d.publisher) || '') ? '' : String(one(d.publisher) || '').replace(/^\[|\]$/g, '').replace(/[.،,\s]+$/, ''),
			publishers: [].concat(d.publisher || []).filter(function (p) { return !/^(none|null|unknown)$/i.test(p); }),
			lang: langs[0] || (AR.test(title) ? 'ara' : ''), isbn: String(one(d.isbn) || '').replace(/[^\dXx]/g, ''), pages: '',
			bibalex: /^AAlexandrina-/.test(d.identifier), place: {}
		};
	}

	/* Wikidata: written works (by their labels), or the works of the writers a name finds */
	var WORK = 'haswbstatement:P31=Q7725634|P31=Q47461344|P31=Q571|P31=Q8261|P31=Q3331189|P31=Q49084|P31=Q5185279';
	var WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
	var WD_LANG = { Q13955: 'ara', Q1860: 'eng', Q150: 'fre', Q188: 'ger', Q1321: 'spa', Q652: 'ita', Q256: 'tur', Q9168: 'per', Q7737: 'rus' };
	function wdSearch(expr, limit, offset, signal) {
		return getJSON(WD + new URLSearchParams({ action: 'query', list: 'search', srsearch: expr, srlimit: limit, sroffset: offset || 0 }), signal)
			.then(function (j) { return { ids: (j.query.search || []).map(function (x) { return x.title; }), total: (j.query.searchinfo || {}).totalhits || 0 }; });
	}
	function wikidata(q, by, lang, page, signal) {
		if (isbnOf(q)) return Promise.resolve({ total: 0, books: [] });
		var off = (page - 1) * PER;
		var find = by === 'author'
			? wdSearch(q + ' haswbstatement:P31=Q5', 3, 0, signal).then(function (r) {
				if (!r.ids.length) return { ids: [], total: 0 };
				return wdSearch('haswbstatement:' + r.ids.map(function (id) { return 'P50=' + id; }).join('|'), PER, off, signal);
			})
			: wdSearch(q + ' ' + WORK, PER, off, signal);
		return find.then(function (r) {
			if (!r.ids.length) return { total: 0, books: [] };
			return getJSON(WD + new URLSearchParams({ action: 'wbgetentities', ids: r.ids.join('|'), props: 'labels|claims|sitelinks', languages: 'ar|en' }), signal).then(function (j) {
				var ents = r.ids.map(function (id) { return j.entities[id]; }).filter(Boolean);
				var refs = {};
				var claim = function (e, p) { return ((e.claims || {})[p] || []).map(function (c) { return c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value; }).filter(Boolean); };
				ents.forEach(function (e) { claim(e, 'P50').concat(claim(e, 'P123')).forEach(function (v) { refs[v.id] = 1; }); });
				var ids = Object.keys(refs).slice(0, 50);
				var names = ids.length ? getJSON(WD + new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'ar|en' }), signal).then(function (k) { return k.entities; }) : Promise.resolve({});
				return names.then(function (names) {
					var label = function (e) { var l = (e && e.labels) || {}; var ar = (l.ar || {}).value, en = (l.en || {}).value; return App.lang === 'en' ? en || ar : ar || en; };
					var books = ents.map(function (e) {
						var t = label(e);
						if (!t) return null;
						var date = (claim(e, 'P577')[0] || {}).time || '';
						var img = claim(e, 'P18')[0];
						var langQ = (claim(e, 'P407')[0] || {}).id;
						var sl = e.sitelinks || {};
						return {
							id: 'wd:' + e.id, src: ['wd'], title: t,
							authors: claim(e, 'P50').map(function (v) { return label(names[v.id]); }).filter(Boolean).slice(0, 3),
							alt: [((e.labels || {}).ar || {}).value, ((e.labels || {}).en || {}).value].filter(Boolean),
							cover: img ? 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(img) + '?width=320' : '',
							link: (sl.arwiki && 'https://ar.wikipedia.org/wiki/' + encodeURIComponent(sl.arwiki.title)) || 'https://www.wikidata.org/wiki/' + e.id,
							year: year(date), firstYear: +year(date) || null,
							publisher: claim(e, 'P123').map(function (v) { return label(names[v.id]); }).filter(Boolean)[0] || '',
							lang: WD_LANG[langQ] || '', isbn: (claim(e, 'P212')[0] || claim(e, 'P957')[0] || '').replace(/-/g, ''), pages: (claim(e, 'P1104')[0] || {}).amount ? String(+claim(e, 'P1104')[0].amount) : '', place: {}
						};
					}).filter(Boolean);
					if (lang) books = books.filter(function (b) { return !b.lang || b.lang === lang; });
					return { total: r.total, books: books };
				});
			});
		});
	}

	/* ---------- merging and ranking ---------- */
	function sameBook(a, b) {
		if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
		/* each title also without what follows « - » or «:» (a subtitle, «مقالات ساخرة») */
		var forms = function (x) { return [x.title].concat(x.alt || []).reduce(function (o, t) { return o.concat([norm(t), norm(String(t).split(/\s[-–—:]\s|:\s/)[0])]); }, []); };
		var ta = forms(a), tb = forms(b);
		var titleMatch = ta.some(function (x) { return x && tb.indexOf(x) >= 0; });
		if (!titleMatch) return looseTwin(a, b);
		if (!a.authors.length || !b.authors.length) return true;
		var wa = words(a.authors.join(' '));
		return words(b.authors.join(' ')).some(function (w) { return wa.indexOf(w) >= 0; });
	}
	/* an upload's title is often the book's title with more around it — its author, a site, a number:
	   «عزازيل يوسف زيدان #عالم الكتب», «رواية عزازيل ليوسف زيدان», «أحمد مراد الفيل الأزرق». It is the same
	   book when what is left is only names of the authors, filler words or junk (a sequel's «2» is not junk) */
	var JUNK = /(www|\bcom\b|\bnet\b|\borg\b|ovh|pdf|نسخه|مكتبه|موقع|تحميل|جوده|كامله|\b\d{4,}\b)/;
	var FILL = ['ل', 'لل', 'د', 'دكتور', 'للدكتور', 'شاشه', 'الجزء', 'جزء', 'بقلم', 'تاليف', 'الكاتب', 'للكاتب', 'الكاتبه', 'روايه', 'كتاب', 'قصه', 'ديوان', 'عالم', 'الكتب', 'by'];
	function looseTwin(a, b) {
		var A = norm(a.title), B = norm(b.title);
		var long = A.length >= B.length ? A : B, short = long === A ? B : A;
		if (short.length < 3 || long === short) return false;
		var at = (' ' + long + ' ').indexOf(' ' + short + ' ');
		if (at < 0) return false;
		var rest = (' ' + long + ' ').replace(' ' + short + ' ', ' ').trim();
		if (JUNK.test(rest)) return true;
		var aw = words(a.authors.concat(b.authors).join(' '));
		if (!aw.length) return false;
		/* a part's number on an upload («1 تراب الماس أحمد مراد») is noise; on a publisher's record it may be a sequel */
		var upload = function (x) { return !x.authors.length && !x.publisher; };
		var longRec = long === A ? a : b;
		return rest.split(' ').every(function (w) {
			return FILL.indexOf(w) >= 0 || (upload(longRec) && /^\d{1,2}$/.test(w)) || aw.some(function (x) { return w.indexOf(x) >= 0 || (w.length > 2 && x.indexOf(w) >= 0); });
		});
	}
	/* the one kept takes what the other knows and it doesn't — and the cleaner title */
	function absorb(a, b) {
		var na = norm(a.title), nb = norm(b.title);
		if (b.authors.length && nb.length < na.length && na.indexOf(nb) >= 0) { a.title = b.title; if (!a.authors.length || !a.publisher) a.authors = b.authors; }
		b.src.forEach(function (s) { if (a.src.indexOf(s) < 0) a.src.push(s); });
		if (!a.coverId && !a.cover) { a.coverId = b.coverId || null; a.cover = b.cover || ''; }
		['publisher', 'year', 'isbn', 'pages', 'lang', 'link', 'work'].forEach(function (k) { if (!a[k] && b[k]) a[k] = b[k]; });
		if (!a.firstYear || (b.firstYear && b.firstYear < a.firstYear)) a.firstYear = b.firstYear || a.firstYear;
		a.publishers = (a.publishers || []).concat(b.publishers || []).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).slice(0, 12);
		if (!a.authors.length) a.authors = b.authors;
		if (b.editions) a.editions = Math.max(a.editions || 0, b.editions);
		if (b.bibalex) a.bibalex = true;
	}
	function score(b, q, by, rank) {
		var s = rank * (SOURCES[b.src[0]].weight || 1);
		var arQ = AR.test(q), nq = norm(q);
		if (arQ && (AR.test(b.title) || AR.test(b.authors.join(' ')))) s += 0.8;
		if (b.coverId || b.cover) s += 0.2;
		s += 0.35 * (b.src.length - 1);
		/* a library's record beats an upload: the Bibliotheca Alexandrina's, or one with a publisher */
		if (b.bibalex) s += 0.35; else if (b.publisher) s += 0.1;
		if (/كامل|مجموعة|جودة|pdf|تحميل|سلسلة .* -/i.test(b.title)) s -= 0.6;
		/* an upload with neither author nor publisher */
		if (!b.authors.length && !b.publisher) s -= 0.3;
		var nt = norm(b.title), na = norm(b.authors.join(' '));
		if (by !== 'author' && (nt === nq || nt.indexOf(nq) === 0)) s += 0.5;
		if (by !== 'title' && nq && na.indexOf(nq) >= 0) s += 0.4;
		return s;
	}
	function merge(into, lists, q, by) {
		var fresh = [], all = [];
		/* each keeps its rank in its own source; then, from every source together, the records with a publisher and an
		   author come first, so that the uploads fold into them rather than the other way round */
		lists.forEach(function (list) { list.forEach(function (b, i) { b._rank = 1 - i / Math.max(list.length, 8); all.push(b); }); });
		var good = function (b) { return (b.publisher ? 2 : 0) + (b.authors.length ? 1 : 0); };
		all.sort(function (a, b) { return good(b) - good(a) || b._rank - a._rank; });
		all.forEach(function (b) {
			var twin = into.concat(fresh).filter(function (x) { return sameBook(x, b); })[0];
			if (twin) { absorb(twin, b); twin._rank = Math.max(twin._rank, b._rank); }
			else fresh.push(b);
		});
		fresh.forEach(function (b) { b._score = score(b, q, by, b._rank); });
		fresh.sort(function (a, b) { return b._score - a._score; });
		return fresh;
	}

	/* ---------- which sources, and Google's key ---------- */
	function gbKey() { try { return localStorage.getItem('bl-gbkey') || ''; } catch (e) { return ''; } }
	function chosen() {
		var s = null;
		try { s = JSON.parse(localStorage.getItem('bl-sources') || 'null'); } catch (e) {}
		return Array.isArray(s) && s.length ? s.filter(function (k) { return SOURCES[k]; }) : ORDER_SRC.slice();
	}

	/* ---------- running a search ---------- */
	var form, input, results, status, moreBtn, hintEmpty, srcBox;
	var found = [], byKey = {}, run_ = null, ctrl = null;

	function run(more) {
		var q = input.value.trim();
		if (!q) { input.focus(); return; }
		var by = form.querySelector('[name="by"]:checked').value, lang = form.lang.value;
		if (!more) {
			found = [];
			run_ = { q: q, by: by, lang: lang, page: 0, src: {} };
			chosen().forEach(function (k) { run_.src[k] = { more: true, n: 0, total: 0, err: '' }; });
			results.innerHTML = skeleton();
			try { sessionStorage.setItem('bl-last', JSON.stringify({ q: q, by: by, lang: lang })); } catch (e) {}
		}
		var R = run_;
		R.page++;
		hintEmpty.hidden = true;
		moreBtn.hidden = true;
		status.innerHTML = L('جارٍ البحث في ', 'Searching ') + esc(Object.keys(R.src).map(function (k) { return SOURCES[k].name; }).join(L('، ', ', '))) + '…';
		if (ctrl && !more) ctrl.abort();
		ctrl = 'AbortController' in window ? new AbortController() : null;
		var signal = ctrl && ctrl.signal;
		var asks = Object.keys(R.src).filter(function (k) { return R.src[k].more; });
		Promise.all(asks.map(function (k) {
			var st = R.src[k];
			return SOURCES[k].search(R.q, R.by, R.lang, R.page, signal).then(function (r) {
				st.total = r.total; st.n += r.books.length;
				st.more = r.books.length > 0 && st.n < r.total;
				st.err = '';
				return r.books;
			}).catch(function (e) {
				if (e && e.name === 'AbortError') throw e;
				st.more = false;
				st.err = (e && (e.status === 429 || e.status === 403)) && k === 'gb' ? 'quota' : 'down';
				return [];
			});
		})).then(function (lists) {
			if (R !== run_) return;
			lists.forEach(function (l) { l.forEach(function (b) { byKey[b.id] = b; }); });
			var fresh = merge(found, lists, R.q, R.by);
			fresh.forEach(function (b) { byKey[b.id] = b; });
			found = found.concat(fresh);
			render();
			report(R);
			moreBtn.hidden = !Object.keys(R.src).some(function (k) { return R.src[k].more; });
		}).catch(function (e) {
			if (e && e.name === 'AbortError') return;
			results.innerHTML = '';
			status.textContent = L('تعذّر البحث. حاول بعد قليل.', 'The search failed. Try again in a moment.');
		});
	}

	function report(R) {
		var offline = navigator.onLine === false;
		var parts = Object.keys(R.src).map(function (k) {
			var st = R.src[k];
			var v = st.err === 'quota' ? '<button type="button" class="linkish" data-gbkey-open>' + L('انتهت الحصة المجانية — أضف مفتاحًا', 'free quota used up — add a key') + '</button>'
				: st.err ? L('لم يرد', 'no answer') : App.num(st.n);
			return '<span class="src-n src-' + k + (st.err ? ' is-err' : '') + '">' + esc(SOURCES[k].name) + ': ' + v + '</span>';
		}).join('');
		var lead = offline ? L('لا اتصال بالإنترنت؛ البحث يحتاجه. قوائمك تعمل دونه.', 'You’re offline; search needs the internet. Your lists work without it.')
			: found.length ? L('وُجد ' + App.books(found.length) + '. اسحب الغلاف إلى قائمة، أو اضغط عليه لتفاصيله.', App.books(found.length) + ' found. Drag a cover to a list, or tap it for its details.')
			: L('لم يُعثر على شيء. جرّب كلمات أقل، أو اكتب الاسم دون همزات، أو أضف الكتاب يدويًا.', 'Nothing found. Try fewer words, spell it without hamzas, or add the book by hand.');
		status.innerHTML = esc(lead) + '<span class="src-counts">' + parts + '</span>';
	}

	function skeleton() { var s = ''; for (var i = 0; i < 12; i++) s += '<div class="bk-card is-skel"><span class="cover"></span><span class="bk-t"><i></i><i></i></span></div>'; return s; }

	function cardHtml(b) {
		var at = App.find(b.id);
		var meta = [b.publisher, b.firstYear ? App.num(b.firstYear) : '', b.editions > 1 ? App.num(b.editions) + L(' طبعة', ' editions') : ''].filter(Boolean).join(' · ');
		return '<article class="bk-card" data-book="' + esc(b.id) + '" tabindex="0" aria-label="' + esc(b.title + (b.authors[0] ? ' — ' + b.authors[0] : '')) + '">' +
			App.coverHtml(b, 'M') +
			(at ? '<span class="bk-in" title="' + esc(App.tt(App.LISTS[at.list])) + '">' + App.icon(at.list) + '</span>' : '') +
			'<span class="bk-t"><b>' + esc(b.title) + '</b>' +
				'<small>' + esc(b.authors.join(L('، ', ', ')) || L('مؤلف غير معروف', 'Unknown author')) + '</small>' +
				(meta ? '<small class="bk-meta">' + esc(meta) + '</small>' : '') +
				'<span class="bk-src">' + b.src.map(function (s) { return '<i class="src-' + s + '">' + esc(SOURCES[s].short) + '</i>'; }).join('') + '</span></span>' +
			'<span class="bk-add" role="group" aria-label="' + esc(L('أضف إلى', 'Add to')) + '">' + App.ORDER.map(function (k) {
				return '<button type="button" data-add="' + k + '" title="' + esc(App.tt(App.LISTS[k])) + '" aria-label="' + esc(L('أضف إلى ', 'Add to ') + App.tt(App.LISTS[k])) + '"' + (at && at.list === k ? ' aria-pressed="true"' : '') + '>' + App.icon(k) + '</button>';
			}).join('') + '</span>' +
		'</article>';
	}
	function render() { results.innerHTML = found.map(cardHtml).join(''); }

	/* a book from the results (or the lists) by its id */
	function get(id) { var at = App.find(id); return at ? at.book : byKey[id] || null; }

	/* ---------- the sources row ---------- */
	function sourcesHtml() {
		var on = chosen(), key = gbKey();
		return '<span class="src-l">' + L('المصادر', 'Sources') + '</span>' +
			ORDER_SRC.map(function (k) {
				return '<label class="src-pick src-' + k + '"><input type="checkbox" name="src" value="' + k + '"' + (on.indexOf(k) >= 0 ? ' checked' : '') + '><span>' + esc(SOURCES[k].name) + '</span></label>';
			}).join('') +
			'<details class="gb-key"' + (gbKey.open ? ' open' : '') + '><summary>' + (key ? L('مفتاح Google Books ✓', 'Google Books key ✓') : L('مفتاح Google Books', 'Google Books key')) + '</summary>' +
				'<div class="gb-key-box"><p>' + L('حصة Google Books المجانية دون مفتاح مشتركة بين كل الناس وكثيرًا ما تنفد. مفتاحك المجاني (من <a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank" rel="noopener">Google Cloud</a>: فعّل Books API ثم أنشئ API key) يعطيك ألف بحث يوميًا، ويبقى في هذا المتصفح فقط.',
					'Google Books’ free keyless quota is shared by everyone and often runs out. A free key of your own (from <a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank" rel="noopener">Google Cloud</a>: enable the Books API, then create an API key) gives you 1,000 searches a day, and stays in this browser only.') + '</p>' +
				'<div class="gb-key-row"><input type="password" name="gbkey" dir="ltr" autocomplete="off" spellcheck="false" placeholder="AIza…" value="' + esc(key) + '" aria-label="' + esc(L('مفتاح Google Books', 'Google Books key')) + '">' +
				'<button type="button" class="btn btn-sm btn-primary" data-gbkey-save>' + L('حفظ', 'Save') + '</button>' +
				(key ? '<button type="button" class="btn btn-sm btn-ghost" data-gbkey-clear>' + L('احذفه', 'Remove') + '</button>' : '') + '</div></div></details>';
	}
	function drawSources() { srcBox.innerHTML = sourcesHtml(); gbKey.open = false; }

	/* ---------- a work's editions (Open Library) ---------- */
	var edCache = {};
	function editions(work) {
		if (!work) return Promise.resolve([]);
		if (edCache[work]) return Promise.resolve(edCache[work]);
		return getJSON('https://openlibrary.org' + work + '/editions.json?limit=60').then(function (j) {
			var list = (j.entries || []).map(function (e) {
				return {
					key: e.key, title: e.title + (e.subtitle ? ': ' + e.subtitle : ''),
					publisher: (e.publishers || [])[0] || '', year: year(e.publish_date), edition: e.edition_name || '', format: e.physical_format || '',
					lang: ((e.languages || [])[0] || {}).key ? e.languages[0].key.replace('/languages/', '') : '',
					isbn: (e.isbn_13 || [])[0] || (e.isbn_10 || [])[0] || '', pages: e.number_of_pages || '',
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
			? ['Naguib Mahfouz', 'Ahmed Khaled Tawfik', 'Radwa Ashour', 'Youssef Ziedan', 'The Yacoubian Building', 'Season of Migration to the North']
			: ['أحمد خالد توفيق', 'نجيب محفوظ', 'رضوى عاشور', 'يوسف زيدان', 'عمارة يعقوبيان', 'أحمد مراد', 'ثلاثية غرناطة'];
		document.getElementById('try').innerHTML = ex.map(function (x) { return '<button type="button" class="chip" data-try="' + esc(x) + '">' + esc(x) + '</button>'; }).join('');
	}

	function init() {
		form = document.querySelector('form.search');
		input = document.getElementById('q');
		results = document.getElementById('results');
		status = document.getElementById('status');
		moreBtn = document.getElementById('more');
		hintEmpty = document.getElementById('hint-empty');
		srcBox = document.getElementById('sources');
		drawSources();
		form.addEventListener('submit', function (ev) { ev.preventDefault(); input.blur(); run(false); });
		form.addEventListener('change', function (ev) {
			var t = ev.target;
			if (t.name === 'gbkey') return;
			if (t.name === 'src') {
				var on = [].map.call(form.querySelectorAll('[name="src"]:checked'), function (i) { return i.value; });
				if (!on.length) { t.checked = true; return; }
				try { localStorage.setItem('bl-sources', JSON.stringify(on)); } catch (e) {}
			}
			if (t.name !== 'q' && input.value.trim()) run(false);
		});
		srcBox.addEventListener('click', function (ev) {
			var t = ev.target;
			if (t.closest('[data-gbkey-save]') || t.closest('[data-gbkey-clear]')) {
				var v = t.closest('[data-gbkey-clear]') ? '' : form.gbkey.value.trim();
				try { if (v) localStorage.setItem('bl-gbkey', v); else localStorage.removeItem('bl-gbkey'); } catch (e) {}
				drawSources();
				App.say(v ? L('حُفظ مفتاح Google Books على هذا الجهاز.', 'Google Books key saved on this device.') : L('حُذف المفتاح.', 'Key removed.'));
				if (v && input.value.trim()) run(false);
			}
		});
		form.addEventListener('keydown', function (ev) {
			if (ev.key === 'Enter' && ev.target.name === 'gbkey') { ev.preventDefault(); form.querySelector('[data-gbkey-save]').click(); }
		});
		status.addEventListener('click', function (ev) {
			if (!ev.target.closest('[data-gbkey-open]')) return;
			var d = srcBox.querySelector('.gb-key'); d.open = true; form.gbkey.focus();
		});
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
			var at = App.find(b.id);
			if (add) {
				var k = add.getAttribute('data-add');
				if (at && at.list === k) { window.Book.open(b.id); return; }
				window.Lists.drop(k, b);
				return;
			}
			window.Book.open(at ? b.id : null, at ? null : { book: b });
		});
		results.addEventListener('keydown', function (ev) {
			if (ev.key !== 'Enter' || !ev.target.matches('.bk-card')) return;
			ev.preventDefault(); ev.target.click();
		});

		document.addEventListener('bl-change', function () { if (found.length) { var y = window.scrollY; render(); window.scrollTo(0, y); } });
		document.addEventListener('bl-lang', function () { examples(); drawSources(); if (found.length) { render(); report(run_); } });
		examples();

		/* the last search comes back when the app is reopened in this tab */
		try {
			var s = JSON.parse(sessionStorage.getItem('bl-last') || 'null');
			if (s && s.q && !/[?&]q=/.test(location.search)) { input.value = s.q; var r = form.querySelector('[name="by"][value="' + s.by + '"]'); if (r) r.checked = true; form.lang.value = s.lang || ''; run(false); }
		} catch (e) {}
	}

	window.Search = { init: init, get: get, editions: editions, SOURCES: SOURCES, norm: norm, run: function (q) { input.value = q; run(false); } };
})();
