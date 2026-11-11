/* My lists — at the fair, from a bookshop, maybe, bought.
   After the Ahmed Khaled Tawfik site's lists, themselves adapted from Codrops' "Drag and Drop
   Interaction Ideas" (bottom slide): start dragging a book's cover and a panel slides up from the
   bottom with the lists to drop it on. Pointer events, so a long press starts the drag on touch.
   In the lists, each book's grip drags it up and down to reorder, or across to another list;
   the arrow keys do the same. Export as JSON, CSV or text, import back, share as text. */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc, tt = App.tt, LISTS = App.LISTS, ORDER = App.ORDER;

	var panel, overlay, fab, mount, dragView = false;

	/* ---------- drawing ---------- */
	function itemHtml(list, b) {
		var place = App.placeText(b.place, true);
		var meta = [b.authors && b.authors[0], b.publisher, b.year && App.num(b.year)].filter(Boolean).join(' · ');
		return '<li class="ls-item" data-id="' + esc(b.id) + '">' +
			'<button type="button" class="ls-grip" data-grip="' + list + '" data-id="' + esc(b.id) + '" aria-label="' + esc(L('حرّك «', 'Move “') + b.title + L('» — الأسهم للترتيب والنقل', '” — arrow keys reorder and move')) + '">' +
				'<svg viewBox="0 0 12 20" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="4" r="1.6"/><circle cx="9" cy="4" r="1.6"/><circle cx="3" cy="10" r="1.6"/><circle cx="9" cy="10" r="1.6"/><circle cx="3" cy="16" r="1.6"/><circle cx="9" cy="16" r="1.6"/></g></svg></button>' +
			'<button type="button" class="ls-thumb" data-edit="' + esc(b.id) + '" tabindex="-1" aria-hidden="true">' + App.coverHtml(b, 'S') + '</button>' +
			'<span class="ls-item-t"><button type="button" class="ls-title" data-edit="' + esc(b.id) + '">' + esc(b.title) + '</button>' +
				(meta ? '<small>' + esc(meta) + '</small>' : '') +
				'<span class="ls-tags">' +
					(place ? '<span class="tag tag-place">' + esc(place) + '</span>' : (list === 'fair' || list === 'store') ? '<button type="button" class="tag tag-need" data-edit="' + esc(b.id) + '" data-focus="place">' + (list === 'fair' ? L('أين جناحه؟', 'Which stand?') : L('أي مكتبة؟', 'Which shop?')) + '</button>' : '') +
					(b.price ? '<span class="tag">' + esc(App.money(b.price)) + (b.qty > 1 ? ' ×' + App.num(b.qty) : '') + '</span>' : '') +
					(b.lang ? '<span class="tag">' + esc(App.langName(b.lang)) + '</span>' : '') +
				'</span></span>' +
			'<button type="button" class="ls-x" data-remove="' + esc(b.id) + '" aria-label="' + esc(L('إزالة ', 'Remove ') + b.title) + '">×</button>' +
		'</li>';
	}

	function zoneHtml(k) {
		var items = App.state().lists[k], sum = App.sum(k);
		return '<section class="ls-zone ls-zone-' + k + '" data-list="' + k + '">' +
			'<h3>' + App.icon(k) + '<span>' + esc(tt(LISTS[k])) + '</span><b>' + esc(App.num(items.length)) + '</b>' +
				(items.length ? '<button type="button" class="ls-share" data-share-list="' + k + '" title="' + esc(L('شارك القائمة', 'Share the list')) + '" aria-label="' + esc(L('شارك القائمة', 'Share the list')) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/></svg></button>' : '') + '</h3>' +
			'<ul class="ls-items">' + items.map(function (b) { return itemHtml(k, b); }).join('') + '</ul>' +
			(items.length ? '' : '<p class="ls-empty">' + ({
				fair: L('اسحب إلى هنا ما ستشتريه من المعرض.', 'Drag here what you’ll buy at the fair.'),
				store: L('ما ستشتريه من مكتبة خارج المعرض.', 'What you’ll buy from a bookshop outside the fair.'),
				maybe: L('ما لم تقرر بعد.', 'What you haven’t decided on yet.'),
				bought: L('ما اشتريته — علّمه من «جولة المعرض».', 'What you bought — tick it off in “Fair route”.')
			})[k] + '</p>') +
			(sum != null ? '<p class="ls-sum">' + L('المجموع: ', 'Total: ') + '<b>' + esc(App.money(sum)) + '</b></p>' : '') +
			'<span class="ls-check" aria-hidden="true">✓</span>' +
		'</section>';
	}

	function toolsHtml() {
		return '<footer class="ls-tools">' +
			'<span class="ls-tools-l">' + L('تصدير', 'Export') + '</span>' +
			'<button type="button" data-export="json">JSON</button>' +
			'<button type="button" data-export="csv">CSV</button>' +
			'<button type="button" data-export="txt">' + L('نص', 'Text') + '</button>' +
			'<button type="button" data-export="copy">' + L('نسخ', 'Copy') + '</button>' +
			'<label class="ls-import">' + L('استيراد', 'Import') + '<input type="file" accept=".json,application/json"></label>' +
			(App.total() ? '<button type="button" class="ls-clear" data-clear>' + L('مسح القوائم', 'Clear lists') + '</button>' : '') +
		'</footer>';
	}

	function render() {
		if (panel) {
			panel.setAttribute('aria-label', L('قوائمي', 'My lists'));
			panel.innerHTML = '<div class="ls-inner">' +
				'<header class="ls-head"><h2>' + L('قوائمي', 'My lists') + '</h2>' +
					'<a class="ls-open-page" href="#lists" data-close>' + L('افتح صفحة القوائم', 'Open the lists page') + '</a>' +
					'<button type="button" class="ls-close" data-close aria-label="' + esc(L('إغلاق', 'Close')) + '">×</button></header>' +
				'<p class="ls-hint ls-hint-drag">' + L('أفلِت الغلاف في القائمة التي تريدها.', 'Drop the cover on a list.') + '</p>' +
				'<p class="ls-hint ls-hint-browse">' + L('اسحب أي غلاف من نتائج البحث (أو اضغط عليه مطوّلًا على الهاتف) لتضيفه إلى قائمة.', 'Drag any cover from the search results (or long-press it on a phone) to add it to a list.') + '</p>' +
				'<div class="ls-zones">' + ORDER.map(zoneHtml).join('') + '</div>' +
				toolsHtml() +
			'</div>';
		}
		if (mount) {
			mount.innerHTML = '<div class="ls-inpage">' +
				(App.total() ? '' : '<div class="ls-welcome">' + L('قوائمك فارغة. <a href="#search">ابحث عن كتاب</a> واسحب غلافه إلى هنا، أو <button type="button" class="linkish" data-manual-add>أضف كتابًا يدويًا</button>.', 'Your lists are empty. <a href="#search">Search for a book</a> and drag its cover here, or <button type="button" class="linkish" data-manual-add>add one by hand</button>.') + '</div>') +
				'<div class="ls-zones">' + ORDER.map(zoneHtml).join('') + '</div>' + toolsHtml() + '</div>';
		}
	}

	function renderFab() {
		if (!fab) return;
		var n = App.total();
		fab.innerHTML = App.icon('fair') + '<span class="ls-fab-t">' + L('قوائمي', 'My lists') + '</span>' + (n ? '<span class="ls-fab-n">' + esc(App.num(n)) + '</span>' : '');
		fab.setAttribute('aria-label', L('قوائمي', 'My lists') + (n ? ' (' + n + ')' : ''));
		var nn = document.querySelector('.nav-n');
		if (nn) { nn.hidden = !n; nn.textContent = App.num(n); }
	}

	/* ---------- the panel ---------- */
	var lastFocus = null;
	function open(drag) {
		dragView = !!drag;
		render();
		document.body.classList.toggle('ls-dragging', dragView);
		panel.classList.add('show');
		overlay.classList.add('show');
		panel.setAttribute('aria-hidden', 'false');
		if (!drag) { lastFocus = document.activeElement; setTimeout(function () { var b = panel.querySelector('.ls-close'); if (b) b.focus(); }, 50); }
	}
	function close() {
		panel.classList.remove('show');
		overlay.classList.remove('show');
		panel.setAttribute('aria-hidden', 'true');
		document.body.classList.remove('ls-dragging');
		dragView = false;
		if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
	}

	function wire(el) {
		el.addEventListener('click', onClick);
		el.addEventListener('pointerdown', onGripDown);
		el.addEventListener('keydown', onGripKey);
		el.addEventListener('change', onImport);
	}

	function onClick(ev) {
		var t = ev.target;
		if (t.closest('[data-close]')) { close(); return; }
		if (t.closest('[data-manual-add]')) { window.Book.open(null, { list: 'fair', manual: true }); return; }
		var b = t.closest('button');
		if (!b) return;
		if (b.hasAttribute('data-edit')) window.Book.open(b.getAttribute('data-edit'), { focus: b.getAttribute('data-focus') });
		else if (b.hasAttribute('data-remove')) {
			var gone = App.remove(b.getAttribute('data-remove'));
			if (gone) undoable(L('أُزيل «', 'Removed “') + gone.book.title + L('».', '”.'), function () { App.put(gone.list, gone.book, gone.index); });
		}
		else if (b.hasAttribute('data-export')) exportAs(b.getAttribute('data-export'), b);
		else if (b.hasAttribute('data-share-list')) shareList(b.getAttribute('data-share-list'));
		else if (b.hasAttribute('data-clear')) {
			if (window.confirm(L('مسح كل القوائم؟ صدّرها أولًا إن أردت الاحتفاظ بها.', 'Clear all lists? Export them first if you want to keep them.'))) App.setState(App.blank());
		}
	}

	function undoable(msg, undo) {
		if (!window.Notify) return;
		var n = window.Notify(App.esc(msg) + ' <button type="button" class="ns-action ns-later">' + L('تراجع', 'Undo') + '</button>', { html: true, type: 'notice', ttl: 5000 });
		var btn = n.el.querySelector('.ns-action');
		if (btn) btn.addEventListener('click', function () { undo(); n.dismiss(); });
	}

	/* ---------- adding a book to a list ---------- */
	function drop(list, src) {
		var at = App.find(src.id);
		var book = at ? at.book : JSON.parse(JSON.stringify(src));
		if (at && at.list === list) { App.say(L('موجود بالفعل في «', 'Already in “') + tt(LISTS[list]) + L('»', '”'), 'notice'); return false; }
		var was = App.put(list, book);
		App.say((was ? L('نُقل «', 'Moved “') : L('أُضيف «', 'Added “')) + book.title + L('» إلى ', '” to ') + tt(LISTS[list]));
		/* the fair and the bookshops: where exactly? */
		var p = book.place || {};
		var need = (list === 'fair' && !p.hall && !p.sec) || (list === 'store' && !p.store);
		if (need) setTimeout(function () { window.Book.open(book.id, { focus: 'place', fresh: !was }); }, dragView ? 700 : 150);
		return true;
	}

	/* ---------- dragging a cover (pointer events) ---------- */
	var DRAG_SEL = '.bk-card[data-book]';
	var pending = null, dragging = null, ghost = null, hot = null, suppress = false;

	function onDown(ev) {
		if (ev.button !== 0 || dragging || sorting) return;
		var card = ev.target.closest && ev.target.closest(DRAG_SEL);
		if (!card || ev.target.closest('button')) return;
		pending = { card: card, x: ev.clientX, y: ev.clientY, id: ev.pointerId, touch: ev.pointerType !== 'mouse' };
		if (pending.touch) pending.timer = setTimeout(function () { if (pending) start(pending.x, pending.y); }, 400);
	}
	function onMove(ev) {
		if (sorting) { ev.preventDefault(); sortMove(ev.clientX, ev.clientY); return; }
		if (dragging) { ev.preventDefault(); moveGhost(ev.clientX, ev.clientY); return; }
		if (!pending || ev.pointerId !== pending.id) return;
		var dx = ev.clientX - pending.x, dy = ev.clientY - pending.y, far = dx * dx + dy * dy > 64;
		if (pending.touch) { if (far) cancelPending(); return; }
		if (far) start(ev.clientX, ev.clientY);
	}
	function onUp(ev) {
		if (sorting) { sortEnd(); return; }
		if (dragging) { finish(); return; }
		cancelPending();
	}
	function cancelPending() { if (pending && pending.timer) clearTimeout(pending.timer); pending = null; }

	function start(x, y) {
		var card = pending.card;
		cancelPending();
		var book = window.Search.get(card.getAttribute('data-book'));
		if (!book) return;
		dragging = { book: book, card: card };
		card.classList.add('is-dragged');
		ghost = document.createElement('div');
		ghost.className = 'ls-ghost';
		ghost.innerHTML = App.coverHtml(book, 'M');
		var r = card.querySelector('.cover').getBoundingClientRect();
		ghost.style.setProperty('--w', Math.max(64, Math.min(110, r.width)) + 'px');
		document.body.appendChild(ghost);
		moveGhost(x, y);
		document.body.classList.add('ls-drag-active');
		if (navigator.vibrate && pending === null && card.matches(':active')) { try { navigator.vibrate(12); } catch (e) {} }
		open(true);
	}
	function moveGhost(x, y) {
		if (!ghost) return;
		ghost.style.transform = 'translate(' + (x - 30) + 'px,' + (y - 40) + 'px) rotate(-6deg)';
		var el = document.elementFromPoint(x, y);
		var z = el && el.closest('.ls-panel .ls-zone');
		if (z !== hot) { if (hot) hot.classList.remove('highlight'); hot = z; if (hot) hot.classList.add('highlight'); }
	}
	function finish() {
		var d = dragging, zone = hot;
		dragging = null; hot = null;
		suppress = true; setTimeout(function () { suppress = false; }, 80);
		document.body.classList.remove('ls-drag-active');
		d.card.classList.remove('is-dragged');
		var g = ghost; ghost = null;
		if (zone) {
			zone.classList.remove('highlight');
			var list = zone.getAttribute('data-list');
			var ok = drop(list, d.book);
			var z2 = panel.querySelector('.ls-zone[data-list="' + list + '"]');
			if (z2 && ok) z2.classList.add('drop-feedback');
			if (g) g.classList.add('is-dropped');
			setTimeout(close, 650);
		} else close();
		if (g) setTimeout(function () { g.remove(); }, zone ? 300 : 0);
	}

	/* ---------- rearranging: the grip ---------- */
	var sorting = null;
	function scroller(el) { return el.closest('.ls-panel') || null; }
	function onGripDown(ev) {
		var g = ev.target.closest('.ls-grip');
		if (!g || ev.button !== 0) return;
		ev.preventDefault();
		var li = g.closest('.ls-item'), r = li.getBoundingClientRect();
		var ghostLi = li.cloneNode(true);
		ghostLi.className = 'ls-item ls-sort-ghost';
		ghostLi.style.width = r.width + 'px';
		document.body.appendChild(ghostLi);
		li.classList.add('ls-placeholder');
		document.body.classList.add('ls-sorting');
		sorting = { from: g.getAttribute('data-grip'), id: g.getAttribute('data-id'), li: li, ghost: ghostLi, dx: ev.clientX - r.left, dy: ev.clientY - r.top, box: li.closest('.ls-zones'), root: li.closest('#lists-mount, .ls-panel'), sc: scroller(li) };
		try { g.setPointerCapture(ev.pointerId); } catch (e) {}
		sortMove(ev.clientX, ev.clientY);
	}
	function sortMove(x, y) {
		var s = sorting;
		s.ghost.style.transform = 'translate(' + (x - s.dx) + 'px,' + (y - s.dy) + 'px)';
		var el = document.elementFromPoint(x, y);
		var zone = el && el.closest('.ls-zone');
		if (zone && s.box.contains(zone)) {
			var ul = zone.querySelector('.ls-items'), before = null;
			var items = [].slice.call(ul.children).filter(function (n) { return n !== s.li; });
			for (var i = 0; i < items.length; i++) {
				var b = items[i].getBoundingClientRect();
				if (y < b.top + b.height / 2) { before = items[i]; break; }
			}
			if (before) { if (s.li.nextSibling !== before) ul.insertBefore(s.li, before); }
			else if (ul.lastElementChild !== s.li) ul.appendChild(s.li);
			s.box.querySelectorAll('.ls-zone').forEach(function (z) { z.classList.toggle('sort-target', z === zone); });
		}
		/* near the top or bottom edge, scroll */
		var step = y < 80 ? -14 : y > window.innerHeight - 80 ? 14 : 0;
		if (step) { if (s.sc) s.sc.scrollTop += step; else window.scrollBy(0, step); }
	}
	function sortEnd(cancel) {
		var s = sorting;
		sorting = null;
		s.ghost.remove();
		document.body.classList.remove('ls-sorting');
		if (cancel) { render(); return; }
		var ul = s.li.parentNode, to = ul.closest('.ls-zone').getAttribute('data-list');
		var index = [].indexOf.call(ul.children, s.li);
		var at = App.find(s.id);
		if (!at) return render();
		if (to === s.from && index === at.index) return render();
		App.put(to, at.book, index);
		if (to !== s.from) { App.say(L('نُقل إلى ', 'Moved to ') + tt(LISTS[to])); if (to === 'fair' || to === 'store') needPlace(at.book, to); }
		focusGrip(s.root, s.id);
	}
	function needPlace(book, list) {
		var p = book.place || {};
		if ((list === 'fair' && !p.hall && !p.sec) || (list === 'store' && !p.store)) setTimeout(function () { window.Book.open(book.id, { focus: 'place' }); }, 200);
	}
	function focusGrip(root, id) {
		var g = [].slice.call(root.querySelectorAll('.ls-grip')).filter(function (b) { return b.getAttribute('data-id') === id; })[0];
		if (g) g.focus();
	}

	/* the keyboard: up / down reorder, left / right move to the neighbouring list */
	function onGripKey(ev) {
		var g = ev.target.closest && ev.target.closest('.ls-grip');
		if (!g) return;
		var id = g.getAttribute('data-id'), at = App.find(id);
		if (!at) return;
		var n = App.state().lists[at.list].length, to = at.list, idx = at.index;
		var rtl = document.documentElement.dir === 'rtl', li = ORDER.indexOf(at.list);
		if (ev.key === 'ArrowUp') idx--;
		else if (ev.key === 'ArrowDown') idx++;
		else if (ev.key === 'Home') idx = 0;
		else if (ev.key === 'End') idx = n - 1;
		else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
			var fwd = (ev.key === 'ArrowRight') !== rtl;
			to = ORDER[(li + (fwd ? 1 : ORDER.length - 1)) % ORDER.length]; idx = 0;
		} else return;
		ev.preventDefault();
		if (to === at.list && (idx < 0 || idx >= n || idx === at.index)) return;
		var box = g.closest('#lists-mount, .ls-panel');
		App.put(to, at.book, idx);
		App.say(to !== at.list ? L('نُقل إلى ', 'Moved to ') + tt(LISTS[to]) : L('الترتيب ', 'Position ') + App.num(idx + 1) + L(' من ', ' of ') + App.num(n), 'notice');
		focusGrip(box, id);
	}

	/* ---------- export / import / share ---------- */
	var COLS = ['list', 'title', 'authors', 'publisher', 'year', 'edition', 'language', 'isbn', 'pages', 'where', 'hall', 'section', 'stand', 'stand_name', 'bookshop', 'price', 'qty', 'notes', 'link', 'found_in', 'added'];
	function rows() {
		var out = [];
		ORDER.forEach(function (k) {
			App.state().lists[k].forEach(function (b) {
				var p = b.place || {};
				out.push({ list: k, title: b.title, authors: (b.authors || []).join('; '), publisher: b.publisher || '', year: b.year || '', edition: b.edition || '', language: b.lang || '', isbn: b.isbn || '', pages: b.pages || '',
					where: p.where || '', hall: p.hall || '', section: p.sec || '', stand: (p.sec || '') + (p.num || ''), stand_name: p.pub || '', bookshop: p.store || '',
					price: b.price || '', qty: b.qty || 1, notes: b.notes || '', link: b.edKey ? 'https://openlibrary.org' + b.edKey : b.work ? 'https://openlibrary.org' + b.work : b.link || '', found_in: (b.src || []).join(' '), added: (b.added || '').slice(0, 10) });
			});
		});
		return out;
	}
	function lineOf(b) {
		var place = App.placeText(b.place, true);
		return '- ' + b.title + (b.authors && b.authors[0] ? ' — ' + b.authors[0] : '') +
			[b.publisher, b.edition, b.year].filter(Boolean).map(function (x) { return ' · ' + x; }).join('') +
			(place ? ' [' + place + ']' : '') + (b.price ? ' (' + App.money(b.price) + ')' : '');
	}
	function asText(only) {
		var out = [L('قائمة الكتب', 'Book list'), ''];
		(only ? [only] : ORDER).forEach(function (k) {
			var items = App.state().lists[k];
			if (!items.length) return;
			out.push(tt(LISTS[k]) + ' (' + items.length + ')');
			items.forEach(function (b) { out.push(lineOf(b)); });
			var s = App.sum(k);
			if (s != null) out.push(L('المجموع: ', 'Total: ') + App.money(s));
			out.push('');
		});
		return out.join('\n');
	}
	function download(name, type, text) {
		var a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([text], { type: type }));
		a.download = name;
		document.body.appendChild(a); a.click(); a.remove();
		setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
	}
	function exportAs(kind, btn) {
		var stamp = new Date().toISOString().slice(0, 10);
		if (kind === 'json') download('book-list-' + stamp + '.json', 'application/json', JSON.stringify({ app: 'book-list', version: 1, exported: new Date().toISOString(), lists: App.state().lists }, null, 2));
		else if (kind === 'csv') {
			var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
			/* a BOM so spreadsheet apps read the Arabic as UTF-8 */
			download('book-list-' + stamp + '.csv', 'text/csv;charset=utf-8', '﻿' + [COLS.join(',')].concat(rows().map(function (r) { return COLS.map(function (c) { return q(r[c]); }).join(','); })).join('\r\n'));
		}
		else if (kind === 'txt') download('book-list-' + stamp + '.txt', 'text/plain;charset=utf-8', asText());
		else if (kind === 'copy') {
			var old = btn.textContent;
			if (navigator.clipboard) navigator.clipboard.writeText(asText()).then(function () { btn.textContent = L('تم ✓', 'Done ✓'); setTimeout(function () { btn.textContent = old; }, 1400); });
		}
	}
	function shareList(k) {
		var text = asText(k);
		if (navigator.share) { navigator.share({ title: L('قائمتي «', 'My list “') + tt(LISTS[k]) + L('»', '”'), text: text }).catch(function () {}); return; }
		if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { App.say(L('نُسخت القائمة نصًّا؛ الصقها حيث تشاء.', 'The list is copied as text; paste it anywhere.')); });
	}
	var STR = function (v, n) { return typeof v === 'string' ? v.slice(0, n || 300) : typeof v === 'number' ? String(v) : ''; };
	function clean(x) {
		var p = x.place || {};
		return { id: STR(x.id, 80), title: STR(x.title), authors: Array.isArray(x.authors) ? x.authors.map(function (a) { return STR(a, 120); }).filter(Boolean).slice(0, 5) : [],
			coverId: typeof x.coverId === 'number' ? x.coverId : null, cover: /^https:\/\//.test(x.cover || '') ? STR(x.cover, 500) : '', work: STR(x.work, 60), edKey: STR(x.edKey, 60), link: /^https:\/\//.test(x.link || '') ? STR(x.link, 500) : '',
			src: Array.isArray(x.src) ? x.src.filter(function (k) { return /^(ol|gb|ia|wd)$/.test(k); }) : [], bibalex: !!x.bibalex,
			publisher: STR(x.publisher), year: STR(x.year, 10), edition: STR(x.edition), lang: STR(x.lang, 5), isbn: STR(x.isbn, 20), pages: STR(x.pages, 6),
			place: { where: p.where === 'fair' || p.where === 'store' ? p.where : '', hall: STR(p.hall, 2), sec: STR(p.sec, 2), num: STR(p.num, 6), pub: STR(p.pub, 120), store: STR(p.store, 120) },
			price: STR(x.price, 12), qty: +x.qty > 0 ? Math.min(99, +x.qty) : 1, notes: STR(x.notes, 2000), added: STR(x.added, 30), boughtAt: STR(x.boughtAt, 30) || undefined };
	}
	function onImport(ev) {
		var input = ev.target;
		if (input.type !== 'file' || !input.files || !input.files[0]) return;
		var reader = new FileReader();
		reader.onload = function () {
			try {
				var data = JSON.parse(reader.result);
				if (!data || data.app !== 'book-list' || !data.lists) throw new Error('format');
				var added = 0, s = App.state();
				ORDER.forEach(function (k) {
					(data.lists[k] || []).forEach(function (x) {
						if (!x || typeof x.id !== 'string' || typeof x.title !== 'string' || App.find(x.id)) return;
						s.lists[k].push(clean(x)); added++;
					});
				});
				App.save();
				App.say(L('استُورد ' + App.num(added) + ' كتابًا.', 'Imported ' + added + ' books.'));
			} catch (e) { App.say(L('هذا الملف ليس تصديرًا من قائمة الكتب.', 'That file is not a Book list export.'), 'error'); }
			input.value = '';
		};
		reader.readAsText(input.files[0]);
	}

	/* ---------- boot ---------- */
	function init() {
		overlay = document.createElement('div');
		overlay.className = 'ls-overlay';
		overlay.addEventListener('click', close);
		panel = document.createElement('div');
		panel.className = 'ls-panel';
		panel.id = 'ls-panel';
		panel.setAttribute('role', 'dialog');
		panel.setAttribute('aria-modal', 'true');
		panel.setAttribute('aria-hidden', 'true');
		panel.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
		wire(panel);
		fab = document.createElement('button');
		fab.type = 'button';
		fab.className = 'ls-fab';
		fab.setAttribute('aria-controls', 'ls-panel');
		fab.addEventListener('click', function () { open(false); });
		document.body.appendChild(panel);
		document.body.appendChild(overlay);
		document.body.appendChild(fab);

		mount = document.getElementById('lists-mount');
		wire(mount);

		document.addEventListener('pointerdown', onDown);
		document.addEventListener('pointermove', onMove, { passive: false });
		document.addEventListener('pointerup', onUp);
		document.addEventListener('pointercancel', function () { if (sorting) sortEnd(true); else if (dragging) { hot = null; finish(); } else cancelPending(); });
		document.addEventListener('touchmove', function (ev) { if (dragging || sorting) ev.preventDefault(); }, { passive: false });
		document.addEventListener('contextmenu', function (ev) { if (pending || dragging) ev.preventDefault(); });
		document.addEventListener('dragstart', function (ev) { if (ev.target.closest && ev.target.closest(DRAG_SEL)) ev.preventDefault(); });
		document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && panel.classList.contains('show') && !document.querySelector('.bk-dialog')) close(); });
		document.addEventListener('bl-change', function () { renderFab(); if (!sorting) render(); });
		document.addEventListener('bl-lang', function () { renderFab(); render(); });
		renderFab();
		render();
	}

	window.Lists = { init: init, open: open, close: close, drop: drop, render: render, justDragged: function () { return suppress; }, asText: asText };
})();
