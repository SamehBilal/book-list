/* The page: its three views (search, my lists, the fair route) by the address's #, the Arabic /
   English switch, the light and dark themes, and the sample lists of ?demo=1. Starts the rest. */
(function () {
	'use strict';
	var App = window.App, html = document.documentElement;

	/* the page's words in English (their Arabic is in index.html) */
	var EN = {
		skip: 'Skip to content', brand: 'Book List', nav: 'Sections', navSearch: 'Search', navLists: 'My lists', navPlan: 'Fair route', theme: 'Theme',
		eyebrow: 'Book fair · Bookshop', title: 'What will you buy this year?',
		lead: 'Search for a book by its title or its author, then drag its cover to a list: at the fair, from a bookshop, or maybe later. Note its publisher, edition and stand (hall 1–6, section A, B or C) and walk the fair with a plan.',
		qLabel: 'Search for a book', qPh: 'Title, author or ISBN', go: 'Search', searchIn: 'Search in', byAll: 'All', byTitle: 'Title', byAuthor: 'Author',
		langLabel: 'Language', langAny: 'Any language', langAr: 'Arabic', langEn: 'English', langFr: 'French', manual: 'Add a book by hand', more: 'More', tryLabel: 'Try:',
		listsEyebrow: 'On this device', listsTitle: 'My lists',
		listsLead: 'Drag a book by its grip to reorder it or move it to another list, and tap its title to set its edition, price and stand at the fair. The lists stay on this device; export or share them any time.',
		planEyebrow: 'Today’s plan', planTitle: 'My fair route',
		planLead: 'The fair list ordered by hall, then section, then stand number, so you walk each hall once. Tick what you buy and it moves to “Bought”; the bookshops outside the fair come after.',
		footer: 'Book data and covers from <a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a>. Your lists are kept in this browser only.'
	};
	var AR = {};
	function i18n() {
		var en = App.lang === 'en';
		document.querySelectorAll('[data-i18n]').forEach(function (el) {
			var k = el.getAttribute('data-i18n');
			if (!(k in AR)) AR[k] = el.innerHTML;
			el.innerHTML = en ? EN[k] || AR[k] : AR[k];
		});
		document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
			var k = el.getAttribute('data-i18n-ph');
			if (!(k in AR)) AR[k] = el.placeholder;
			el.placeholder = en ? EN[k] : AR[k];
		});
		document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
			var k = el.getAttribute('data-i18n-aria');
			if (!(k in AR)) AR[k] = el.getAttribute('aria-label');
			el.setAttribute('aria-label', en ? EN[k] : AR[k]);
		});
		document.title = en ? 'Book List — for the fair and the bookshop' : 'قائمة الكتب — للمعرض والمكتبة';
		var lt = document.querySelector('.lang-toggle');
		lt.textContent = en ? 'ع' : 'EN';
		lt.setAttribute('lang', en ? 'ar' : 'en');
		lt.setAttribute('aria-label', en ? 'العربية' : 'English');
	}
	function setLang(l) {
		html.lang = l; html.dir = l === 'en' ? 'ltr' : 'rtl';
		try { localStorage.setItem('bl-lang', l); } catch (e) {}
		i18n();
		document.dispatchEvent(new CustomEvent('bl-lang'));
	}
	function toggleTheme() {
		var light = html.getAttribute('data-theme') !== 'light';
		if (light) html.setAttribute('data-theme', 'light'); else html.removeAttribute('data-theme');
		try { localStorage.setItem('bl-theme', light ? 'light' : 'dark'); } catch (e) {}
	}

	/* ---------- the views ---------- */
	var VIEWS = ['search', 'lists', 'plan'];
	function show() {
		var v = (location.hash || '').slice(1);
		if (VIEWS.indexOf(v) < 0) v = 'search';
		document.querySelectorAll('main > .view').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
		document.querySelectorAll('.nav a').forEach(function (a) { if (a.getAttribute('data-view') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
		document.body.setAttribute('data-view', v);
		if (show.v && show.v !== v) window.scrollTo(0, 0);
		show.v = v;
		if (window.Lists) window.Lists.close();
	}

	/* ---------- ?demo=1: sample lists for the screenshots ---------- */
	function demo() {
		var B = function (id, title, author, coverId, o) {
			var b = { id: 'ol:' + id, work: '/works/' + id, title: title, authors: [author], coverId: coverId, place: {}, added: new Date().toISOString() };
			for (var k in o) b[k] = o[k];
			return b;
		};
		var fair = function (hall, sec, num, pub) { return { where: 'fair', hall: hall, sec: sec, num: num, pub: pub }; };
		var en = App.lang === 'en';
		var s = App.blank();
		s.lists.fair = [
			B('OL1599742W', en ? 'Palace Walk' : 'بين القصرين', en ? 'Naguib Mahfouz' : 'نجيب محفوظ', 14816592, { publisher: en ? 'Dar El Shorouk' : 'دار الشروق', year: '2016', edition: en ? '12th' : 'الطبعة الثانية عشرة', lang: 'ara', price: '220', place: fair('1', 'B', '14', en ? 'Dar El Shorouk' : 'دار الشروق') }),
			B('OL1599698W', en ? 'Children of the Alley' : 'أولاد حارتنا', en ? 'Naguib Mahfouz' : 'نجيب محفوظ', 14814096, { publisher: en ? 'Dar El Shorouk' : 'دار الشروق', year: '2006', lang: 'ara', price: '180', place: fair('1', 'B', '14', en ? 'Dar El Shorouk' : 'دار الشروق') }),
			B('OL1599712W', en ? 'Midaq Alley' : 'زقاق المدق', en ? 'Naguib Mahfouz' : 'نجيب محفوظ', 14814058, { publisher: en ? 'Dar El Shorouk' : 'دار الشروق', lang: 'ara', price: '150', place: fair('1', 'B', '14', en ? 'Dar El Shorouk' : 'دار الشروق') }),
			B('OL2970107W', en ? 'Season of Migration to the North' : 'موسم الهجرة إلى الشمال', en ? 'Tayeb Salih' : 'الطيب صالح', 692835, { publisher: en ? 'Dar Al Ain' : 'دار العين', year: '2019', lang: 'ara', price: '140', place: fair('2', 'A', '7', en ? 'Dar Al Ain' : 'دار العين') }),
			B('OL19728977W', en ? 'Frankenstein in Baghdad' : 'فرانكشتاين في بغداد', en ? 'Ahmed Saadawi' : 'أحمد سعداوي', 15270490, { publisher: en ? 'Al Kamel' : 'منشورات الجمل', lang: 'ara', price: '260', place: fair('3', 'C', '58', en ? 'Al Kamel' : 'منشورات الجمل') }),
			B('OL1168083W', en ? 'Nineteen Eighty-Four' : '١٩٨٤', 'George Orwell', 9267242, { publisher: 'Penguin', year: '2008', lang: 'eng', price: '450', place: fair('5', 'A', '3', en ? 'Diwan' : 'ديوان') }),
			B('OL15297W', en ? 'Invisible Cities' : 'مدن لا مرئية', 'Italo Calvino', 963147, { lang: 'ara', place: { where: 'fair' } })
		];
		s.lists.store = [
			B('OL318900W', en ? 'The Prophet' : 'النبي', en ? 'Kahlil Gibran' : 'جبران خليل جبران', 418324, { publisher: 'Knopf', year: '1923', lang: 'eng', price: '390', place: { where: 'store', store: en ? 'Diwan — Zamalek' : 'ديوان — الزمالك' } }),
			B('OL10263W', en ? 'The Little Prince' : 'الأمير الصغير', 'Antoine de Saint-Exupéry', 10708272, { publisher: 'Gallimard', lang: 'fre', price: '320', place: { where: 'store', store: en ? 'Alef' : 'ألف' } })
		];
		s.lists.maybe = [
			B('OL274505W', en ? 'One Hundred Years of Solitude' : 'مئة عام من العزلة', 'Gabriel García Márquez', 12627383, { lang: 'ara', place: {} }),
			B('OL265620W', en ? 'The Yacoubian Building' : 'عمارة يعقوبيان', en ? 'Alaa Al Aswany' : 'علاء الأسواني', 1054711, { place: {} })
		];
		s.lists.bought = [
			B('OL796465W', en ? 'The Alchemist' : 'الخيميائي', 'Paulo Coelho', 7414780, { publisher: en ? 'Al Shorouk' : 'الشروق', lang: 'ara', price: '160', place: fair('1', 'B', '14', en ? 'Dar El Shorouk' : 'دار الشروق'), boughtAt: new Date().toISOString() })
		];
		App.setState(s);
	}

	function init() {
		i18n();
		document.querySelector('.lang-toggle').addEventListener('click', function () { setLang(App.lang === 'en' ? 'ar' : 'en'); if (App.demo) demo(); });
		document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
		if (App.demo) demo();
		window.Search.init();
		window.Lists.init();
		window.Plan.init();
		window.addEventListener('hashchange', show);
		show();
		/* ?q=… (the app's shortcut, or a link) searches at once */
		var q = new URLSearchParams(location.search).get('q');
		if (q) window.Search.run(q);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
