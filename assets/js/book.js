/* A book's card: which list, where to buy it (the fair's hall, section and stand, or a bookshop),
   and its edition — publisher, year, edition, language, ISBN, pages — filled by hand or chosen
   from Open Library's editions. Book.open(id) edits a book in the lists; Book.open(null, { book })
   shows a search result before it is added; Book.open(null, { manual: true }) starts a blank one. */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc, tt = App.tt;

	var SHOPS = ['ديوان', 'الشروق', 'ألف', 'الكتب خان', 'تنمية', 'مدبولي', 'دار المعارف', 'البلد', 'Virgin Megastore', 'Amazon', 'جملون'];
	var box = null, cur = null;

	/* what the lists already know: the bookshops used, and each publisher's stand at the fair */
	function known() {
		var shops = {}, stands = {}, pubs = {};
		App.ORDER.forEach(function (k) {
			App.state().lists[k].forEach(function (b) {
				var p = b.place || {};
				if (p.store) shops[p.store] = 1;
				if (p.where === 'fair' && (p.hall || p.sec)) {
					[b.publisher, p.pub].filter(Boolean).forEach(function (n) { stands[norm(n)] = { hall: p.hall, sec: p.sec, num: p.num, pub: p.pub, name: n }; });
				}
				if (b.publisher) pubs[b.publisher] = 1;
				if (p.pub) pubs[p.pub] = 1;
			});
		});
		SHOPS.forEach(function (s) { shops[s] = 1; });
		return { shops: Object.keys(shops), stands: stands, pubs: Object.keys(pubs) };
	}
	function norm(s) { return String(s || '').toLowerCase().replace(/^(دار|مكتبة|منشورات|the)\s+/, '').replace(/[\s.،,]+/g, ' ').trim(); }

	/* where the book was found, and its page there */
	function links(b) {
		var out = [];
		if (b.work) out.push('<a href="https://openlibrary.org' + esc(b.edKey || b.work) + '" target="_blank" rel="noopener">Open Library ↗</a>' + (b.editions > 1 ? ' (' + App.num(b.editions) + L(' طبعة', ' editions') + ')' : ''));
		if (/^https:\/\/(books\.google\.|play\.google\.)/.test(b.link || '')) out.push('<a href="' + esc(b.link) + '" target="_blank" rel="noopener">Google Books ↗</a>');
		if (/^https:\/\/(ar\.wikipedia|www\.wikidata)\.org\//.test(b.link || '')) out.push('<a href="' + esc(b.link) + '" target="_blank" rel="noopener">' + (/wikipedia/.test(b.link) ? L('ويكيبيديا', 'Wikipedia') : 'Wikidata') + ' ↗</a>');
		if (b.bibalex) out.push('<span>' + L('في فهرس مكتبة الإسكندرية', 'In the Bibliotheca Alexandrina’s catalogue') + '</span>');
		else if ((b.src || []).indexOf('ia') >= 0) out.push('<span>Internet Archive</span>');
		return out.length ? '<p class="bd-links">' + out.join(' · ') + '</p>' : '';
	}

	function chips(name, values, chosen, label) {
		return '<div class="chips-pick" role="radiogroup" aria-label="' + esc(label) + '">' + values.map(function (v) {
			return '<label><input type="radio" name="' + name + '" value="' + esc(v) + '"' + (String(chosen) === v ? ' checked' : '') + '><span>' + esc(name === 'hall' ? App.num(v) : v) + '</span></label>';
		}).join('') + '</div>';
	}

	function html(b, list, isNew) {
		var p = b.place || {}, k = known();
		var where = p.where || (App.LISTS[list] && App.LISTS[list].where) || 'fair';
		var langs = Object.keys(App.LANGS);
		if (b.lang && langs.indexOf(b.lang) < 0) langs.push(b.lang);
		var pubOpts = (b.publishers || []).concat(k.pubs).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 40);
		return '<form class="bk-dialog-card" novalidate>' +
			'<header class="bd-head">' +
				'<div class="bd-cover">' + App.coverHtml(b, 'L') + '</div>' +
				'<div class="bd-main">' +
					'<p class="eyebrow">' + (isNew ? L('أضف إلى قوائمي', 'Add to my lists') : L('في «', 'In “') + esc(tt(App.LISTS[list])) + L('»', '”')) + '</p>' +
					'<label class="fld fld-title"><span>' + L('العنوان', 'Title') + '</span><input name="title" required value="' + esc(b.title) + '"></label>' +
					'<label class="fld"><span>' + L('المؤلف', 'Author') + '</span><input name="authors" value="' + esc((b.authors || []).join(L('، ', ', '))) + '" placeholder="' + esc(L('افصل بين الأسماء بفاصلة', 'Separate names with commas')) + '"></label>' +
					links(b) +
				'</div>' +
				'<button type="button" class="bd-x" data-cancel aria-label="' + esc(L('إغلاق', 'Close')) + '">×</button>' +
			'</header>' +

			'<fieldset class="bd-sec"><legend>' + L('القائمة', 'List') + '</legend>' +
				'<div class="seg seg-lists">' + App.ORDER.map(function (k2) {
					return '<label><input type="radio" name="list" value="' + k2 + '"' + (k2 === list ? ' checked' : '') + '><span>' + App.icon(k2) + esc(tt(App.LISTS[k2])) + '</span></label>';
				}).join('') + '</div></fieldset>' +

			'<fieldset class="bd-sec bd-place" data-where="' + where + '"><legend>' + L('من أين تشتريه؟', 'Where will you buy it?') + '</legend>' +
				'<div class="seg"><label><input type="radio" name="where" value="fair"' + (where === 'fair' ? ' checked' : '') + '><span>' + L('معرض الكتاب', 'The book fair') + '</span></label>' +
					'<label><input type="radio" name="where" value="store"' + (where === 'store' ? ' checked' : '') + '><span>' + L('مكتبة خارج المعرض', 'A bookshop outside the fair') + '</span></label></div>' +
				'<div class="bd-fair">' +
					'<div class="bd-stand-hint" hidden></div>' +
					'<div class="fld"><span>' + L('القاعة', 'Hall') + '</span>' + chips('hall', App.HALLS, p.hall || '', L('القاعة', 'Hall')) + '</div>' +
					'<div class="bd-row">' +
						'<div class="fld"><span>' + L('القسم', 'Section') + '</span>' + chips('sec', App.SECTIONS, p.sec || '', L('القسم', 'Section')) + '</div>' +
						'<label class="fld fld-num"><span>' + L('رقم الجناح', 'Stand no.') + '</span><input name="num" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="' + esc(p.num || '') + '" placeholder="58"></label>' +
						'<output class="bd-code" aria-live="polite"></output>' +
					'</div>' +
					'<label class="fld"><span>' + L('اسم الجناح أو الدار', 'Stand or publisher name') + '</span><input name="pub" list="bd-pubs" value="' + esc(p.pub || '') + '" placeholder="' + esc(L('مثلًا: دار الشروق', 'e.g. Dar El Shorouk')) + '"></label>' +
				'</div>' +
				'<div class="bd-store">' +
					'<label class="fld"><span>' + L('المكتبة', 'Bookshop') + '</span><input name="store" list="bd-shops" value="' + esc(p.store || '') + '" placeholder="' + esc(L('مثلًا: ديوان — الزمالك', 'e.g. Diwan, Zamalek')) + '"></label>' +
				'</div>' +
			'</fieldset>' +

			'<fieldset class="bd-sec"><legend>' + L('الطبعة', 'Edition') + '</legend>' +
				(b.work ? '<button type="button" class="btn btn-ghost btn-sm" data-editions>' + L('اختر من طبعات Open Library', 'Choose from Open Library’s editions') + '</button><div class="bd-eds" hidden></div>' : '') +
				'<div class="bd-grid">' +
					'<label class="fld"><span>' + L('الناشر', 'Publisher') + '</span><input name="publisher" list="bd-pubs" value="' + esc(b.publisher || '') + '"></label>' +
					'<label class="fld"><span>' + L('سنة النشر', 'Year') + '</span><input name="year" inputmode="numeric" maxlength="4" value="' + esc(b.year || '') + '"></label>' +
					'<label class="fld"><span>' + L('الطبعة', 'Edition') + '</span><input name="edition" value="' + esc(b.edition || '') + '" placeholder="' + esc(L('مثلًا: الطبعة الثالثة', 'e.g. 3rd edition')) + '"></label>' +
					'<label class="fld"><span>' + L('اللغة', 'Language') + '</span><select name="lang"><option value="">—</option>' + langs.map(function (c) {
						return '<option value="' + esc(c) + '"' + (c === b.lang ? ' selected' : '') + '>' + esc(App.langName(c)) + '</option>';
					}).join('') + '</select></label>' +
					'<label class="fld"><span>ISBN</span><input name="isbn" inputmode="numeric" dir="ltr" value="' + esc(b.isbn || '') + '"></label>' +
					'<label class="fld"><span>' + L('الصفحات', 'Pages') + '</span><input name="pages" inputmode="numeric" maxlength="5" value="' + esc(b.pages || '') + '"></label>' +
				'</div></fieldset>' +

			'<fieldset class="bd-sec"><legend>' + L('السعر والملاحظات', 'Price and notes') + '</legend>' +
				'<div class="bd-grid">' +
					'<label class="fld"><span>' + L('السعر (ج.م)', 'Price (EGP)') + '</span><input name="price" inputmode="decimal" value="' + esc(b.price || '') + '"></label>' +
					'<label class="fld"><span>' + L('النسخ', 'Copies') + '</span><input name="qty" type="number" min="1" max="99" value="' + esc(b.qty || 1) + '"></label>' +
				'</div>' +
				'<label class="fld"><span>' + L('ملاحظات', 'Notes') + '</span><textarea name="notes" rows="2" placeholder="' + esc(L('هدية لفلان، أو اسأل عن الطبعة المجلدة…', 'A gift for someone, ask for the hardback…')) + '">' + esc(b.notes || '') + '</textarea></label>' +
			'</fieldset>' +

			'<datalist id="bd-pubs">' + pubOpts.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
			'<datalist id="bd-shops">' + k.shops.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +

			'<footer class="bd-act">' +
				'<button type="submit" class="btn btn-primary">' + (isNew ? L('أضف', 'Add') : L('حفظ', 'Save')) + '</button>' +
				'<button type="button" class="btn btn-ghost" data-cancel>' + L('إلغاء', 'Cancel') + '</button>' +
				(isNew ? '' : '<button type="button" class="btn btn-ghost bd-del" data-delete>' + L('احذفه من القوائم', 'Remove from lists') + '</button>') +
			'</footer>' +
		'</form>';
	}

	function open(id, opt) {
		opt = opt || {};
		var at = id ? App.find(id) : null;
		var book, list, isNew = !at;
		if (at) { book = at.book; list = at.list; }
		else if (opt.book) { book = JSON.parse(JSON.stringify(opt.book)); list = opt.list || 'fair'; }
		else { book = { id: 'm:' + App.uid(), title: opt.title || '', authors: [], place: {}, manual: true }; list = opt.list || 'fair'; }
		cur = { book: book, list: list, isNew: isNew, last: document.activeElement };

		close(true);
		box = document.createElement('div');
		box.className = 'bk-dialog';
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-modal', 'true');
		box.setAttribute('aria-label', book.title || L('كتاب جديد', 'New book'));
		box.innerHTML = html(book, list, isNew);
		document.body.appendChild(box);
		document.documentElement.classList.add('bd-open');
		var form = box.querySelector('form');
		form.addEventListener('submit', function (ev) { ev.preventDefault(); save(form); });
		form.addEventListener('input', function () { sync(form); });
		form.addEventListener('change', function () { sync(form); });
		box.addEventListener('click', function (ev) {
			if (ev.target === box || ev.target.closest('[data-cancel]')) close();
			else if (ev.target.closest('[data-delete]')) {
				var gone = App.remove(book.id); close();
				if (gone) App.say(L('حُذف «', 'Removed “') + book.title + L('».', '”.'), 'notice');
			}
			else if (ev.target.closest('[data-editions]')) loadEditions(form, ev.target.closest('[data-editions]'));
			else if (ev.target.closest('[data-ed]')) pickEdition(form, ev.target.closest('[data-ed]'));
			else if (ev.target.closest('[data-stand]')) useStand(form);
		});
		box.addEventListener('keydown', function (ev) {
			if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
			if (ev.key === 'Tab') trap(ev);
		});
		sync.lastList = sync.lastWhere = null;
		sync(form);
		setTimeout(function () {
			var f = opt.focus === 'place'
				? form.querySelector(form.where.value === 'store' ? '[name="store"]' : '[name="hall"]')
				: opt.manual ? form.title : form.querySelector('[type="submit"]');
			if (opt.focus === 'place') form.querySelector('.bd-place').scrollIntoView({ block: 'center' });
			if (f) f.focus({ preventScroll: opt.focus === 'place' });
		}, 40);
	}

	function trap(ev) {
		var f = [].filter.call(box.querySelectorAll('button, input, select, textarea, a[href]'), function (el) { return !el.disabled && el.offsetParent !== null; });
		if (!f.length) return;
		var first = f[0], last = f[f.length - 1];
		if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
		else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
	}

	/* the form follows itself: the fair or a bookshop, the stand's code, a publisher's stand already known */
	function sync(form) {
		var list = form.list.value, where = form.where.value;
		var place = form.querySelector('.bd-place');
		/* the fair list and the bookshop list say where; choosing one chooses the other */
		var listMoved = sync.lastList && sync.lastList !== list, whereMoved = sync.lastWhere && sync.lastWhere !== where;
		if (listMoved && App.LISTS[list].where) { form.where.value = App.LISTS[list].where; where = form.where.value; }
		else if (whereMoved && App.LISTS[list].where && App.LISTS[list].where !== where) { form.list.value = where; list = where; }
		sync.lastList = list; sync.lastWhere = where;
		place.setAttribute('data-where', where);
		var hall = form.hall.value, sec = form.sec.value, num = form.num.value.replace(/\D/g, '');
		if (num !== form.num.value) form.num.value = num;
		form.querySelector('.bd-code').textContent = where === 'fair' && (hall || sec || num) ? App.placeText({ where: 'fair', hall: hall, sec: sec, num: num }, true) : '';
		var hint = form.querySelector('.bd-stand-hint');
		var k = known(), st = null;
		[form.publisher.value, form.pub.value].some(function (n) { return n && (st = k.stands[norm(n)]); });
		if (st && where === 'fair' && !(st.hall === hall && st.sec === sec && st.num === num)) {
			hint.hidden = false;
			hint.innerHTML = L('جناح «', 'The “') + esc(st.name) + L('» في قائمتك: ', '” stand in your list: ') + '<b>' + esc(App.placeText({ where: 'fair', hall: st.hall, sec: st.sec, num: st.num }, true)) + '</b> <button type="button" class="btn btn-sm btn-ghost" data-stand>' + L('استخدمه', 'Use it') + '</button>';
			hint._stand = st;
		} else hint.hidden = true;
	}
	function useStand(form) {
		var st = form.querySelector('.bd-stand-hint')._stand;
		if (!st) return;
		var r = form.querySelector('[name="hall"][value="' + st.hall + '"]'); if (r) r.checked = true;
		r = form.querySelector('[name="sec"][value="' + st.sec + '"]'); if (r) r.checked = true;
		form.num.value = st.num || '';
		if (!form.pub.value) form.pub.value = st.pub || st.name;
		sync(form);
	}

	function loadEditions(form, btn) {
		var holder = form.querySelector('.bd-eds');
		holder.hidden = false;
		holder.innerHTML = '<p class="muted">' + L('جارٍ جلب الطبعات…', 'Fetching editions…') + '</p>';
		btn.disabled = true;
		window.Search.editions(cur.book.work).then(function (eds) {
			cur.eds = eds;
			if (!eds.length) { holder.innerHTML = '<p class="muted">' + L('لا طبعات مسجلة.', 'No editions listed.') + '</p>'; return; }
			holder.innerHTML = '<div class="ed-grid">' + eds.map(function (e, i) {
				var label = [e.publisher, e.year && App.num(e.year), e.edition, App.langName(e.lang)].filter(Boolean).join(' · ');
				return '<button type="button" class="ed" data-ed="' + i + '"' + (cur.book.edKey === e.key ? ' aria-pressed="true"' : '') + '>' + App.coverHtml({ title: e.title, coverId: e.coverId }, 'M') + '<span>' + esc(label || e.title) + '</span></button>';
			}).join('') + '</div>';
		}).catch(function () { holder.innerHTML = '<p class="muted">' + L('تعذّر جلب الطبعات.', 'Could not fetch the editions.') + '</p>'; btn.disabled = false; });
	}
	function pickEdition(form, el) {
		var e = cur.eds[+el.getAttribute('data-ed')];
		if (!e) return;
		form.querySelectorAll('.ed').forEach(function (x) { x.setAttribute('aria-pressed', String(x === el)); });
		form.publisher.value = e.publisher || form.publisher.value;
		form.year.value = e.year || form.year.value;
		form.edition.value = e.edition || form.edition.value;
		form.isbn.value = e.isbn || form.isbn.value;
		form.pages.value = e.pages || form.pages.value;
		if (e.lang) {
			if (![].some.call(form.lang.options, function (o) { return o.value === e.lang; })) form.lang.add(new Option(App.langName(e.lang), e.lang));
			form.lang.value = e.lang;
		}
		cur.pick = e;
		if (e.coverId) { var img = box.querySelector('.bd-cover'); img.innerHTML = App.coverHtml({ title: form.title.value, coverId: e.coverId }, 'L'); }
		sync(form);
	}

	function save(form) {
		var b = cur.book;
		var title = form.title.value.trim();
		if (!title) { form.title.focus(); form.title.setAttribute('aria-invalid', 'true'); return; }
		b.title = title;
		b.authors = form.authors.value.split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean);
		['publisher', 'year', 'edition', 'lang', 'isbn', 'pages', 'price', 'notes'].forEach(function (k) { b[k] = form[k].value.trim(); });
		b.qty = Math.max(1, Math.min(99, parseInt(form.qty.value, 10) || 1));
		if (cur.pick) { b.edKey = cur.pick.key; if (cur.pick.coverId) b.coverId = cur.pick.coverId; }
		var where = form.where.value;
		b.place = { where: where, hall: form.hall.value, sec: form.sec.value, num: form.num.value, pub: form.pub.value.trim(), store: form.store.value.trim() };
		if (where === 'fair') b.place.store = ''; else { b.place.hall = b.place.sec = b.place.num = b.place.pub = ''; }
		delete b.publishers; delete b.langs;
		var list = form.list.value, at = App.find(b.id);
		if (at && at.list === list) App.save();
		else App.put(list, b, 0);
		App.say(cur.isNew ? L('أُضيف «', 'Added “') + b.title + L('» إلى ', '” to ') + tt(App.LISTS[list]) : L('حُفظ «', 'Saved “') + b.title + L('».', '”.'));
		close();
	}

	function close(silent) {
		if (!box) return;
		box.remove(); box = null;
		document.documentElement.classList.remove('bd-open');
		if (!silent && cur && cur.last && cur.last.isConnected && cur.last.focus) cur.last.focus();
	}

	window.Book = { open: open, close: close };
})();
