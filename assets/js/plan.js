/* The fair route: the fair list's books ordered hall by hall, then by section and stand number,
   so each hall is walked once; a map of the six halls with how many books wait in each; and the
   bookshop list grouped by shop. Ticking a book moves it to «Bought». Prints as a paper list. */
(function () {
	'use strict';
	var App = window.App, L = App.L, esc = App.esc;
	var mount, onlyHall = '';

	function byStand(a, b) {
		var pa = a.place || {}, pb = b.place || {};
		return (pa.sec || 'Z').localeCompare(pb.sec || 'Z') || (parseInt(pa.num, 10) || 9999) - (parseInt(pb.num, 10) || 9999) || a.title.localeCompare(b.title);
	}

	function rowHtml(b, list) {
		var p = b.place || {};
		var code = list === 'fair' ? (p.sec || '') + (p.num || '') : '';
		return '<li class="pl-row' + (list === 'bought' ? ' is-done' : '') + '">' +
			'<label class="pl-tick"><input type="checkbox" data-tick="' + esc(b.id) + '"' + (list === 'bought' ? ' checked' : '') + '><span aria-hidden="true">✓</span><span class="visually-hidden">' + esc(L('اشتريته: ', 'Bought: ') + b.title) + '</span></label>' +
			(code ? '<span class="pl-code">' + esc(code) + '</span>' : '') +
			'<button type="button" class="pl-cover" data-edit="' + esc(b.id) + '" tabindex="-1" aria-hidden="true">' + App.coverHtml(b, 'S') + '</button>' +
			'<span class="pl-t"><button type="button" class="ls-title" data-edit="' + esc(b.id) + '">' + esc(b.title) + '</button>' +
				'<small>' + esc([b.authors && b.authors[0], b.publisher, b.edition, b.year && App.num(b.year)].filter(Boolean).join(' · ')) + '</small>' +
				(p.pub ? '<small class="pl-pub">' + esc(L('جناح: ', 'Stand: ') + p.pub) + '</small>' : '') +
				(b.notes ? '<small class="pl-note">' + esc(b.notes) + '</small>' : '') + '</span>' +
			(b.price ? '<span class="pl-price">' + esc(App.money(b.price)) + (b.qty > 1 ? ' ×' + App.num(b.qty) : '') + '</span>' : '') +
		'</li>';
	}

	function render() {
		if (!mount) return;
		var s = App.state(), fair = s.lists.fair, store = s.lists.store;
		var bought = s.lists.bought;
		var halls = {}, noPlace = [];
		App.HALLS.forEach(function (h) { halls[h] = []; });
		fair.forEach(function (b) { var h = (b.place || {}).hall; if (halls[h]) halls[h].push(b); else noPlace.push(b); });
		/* what was bought at the fair, counted under its hall */
		var doneIn = {};
		bought.forEach(function (b) { var p = b.place || {}; if (p.where === 'fair' && p.hall) doneIn[p.hall] = (doneIn[p.hall] || 0) + 1; });
		var fairSum = App.sum('fair');

		var out = '<div class="pl-bar">' +
			'<p class="pl-count">' + (fair.length
				? '<b>' + App.books(fair.length) + '</b>' + L(' في قائمة المعرض', ' on the fair list') + (fairSum != null ? L(' · نحو <b>' + esc(App.money(fairSum)) + '</b>', ' · about <b>' + esc(App.money(fairSum)) + '</b>') : '') +
					(bought.length ? L(' · اشتريت ' + App.num(bought.length), ' · ' + bought.length + ' bought') : '')
				: L('قائمة المعرض فارغة.', 'The fair list is empty.')) + '</p>' +
			'<button type="button" class="btn btn-ghost btn-sm" data-print><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>' + L('اطبع القائمة', 'Print the list') + '</button>' +
		'</div>';

		/* the six halls */
		out += '<div class="pl-map" role="group" aria-label="' + esc(L('القاعات', 'Halls')) + '">' + App.HALLS.map(function (h) {
			var n = halls[h].length, d = doneIn[h] || 0;
			return '<button type="button" class="pl-hall' + (n ? ' has' : '') + (onlyHall === h ? ' on' : '') + '" data-hall="' + h + '" aria-pressed="' + (onlyHall === h) + '">' +
				'<span class="pl-hall-n">' + App.num(h) + '</span><span class="pl-hall-l">' + L('قاعة', 'Hall') + '</span>' +
				'<span class="pl-hall-c">' + (n ? App.books(n) : d ? L('تمّت ✓', 'Done ✓') : '—') + '</span>' +
				(n || d ? '<span class="pl-hall-bar" style="--p:' + Math.round(d / (n + d) * 100) + '%"></span>' : '') + '</button>';
		}).join('') + '</div>';

		if (!fair.length && !store.length) {
			out += '<div class="ls-welcome">' + L('أضف كتبًا إلى قائمة «من المعرض» واذكر القاعة والجناح، فتظهر هنا مرتبة في جولة واحدة. <a href="#search">ابحث عن كتاب</a>.', 'Add books to “At the fair” with their hall and stand, and they show up here in one walk. <a href="#search">Search for a book</a>.') + '</div>';
		}

		/* the route */
		var stop = 0;
		App.HALLS.forEach(function (h) {
			if (!halls[h].length || (onlyHall && onlyHall !== h)) return;
			stop++;
			var list = halls[h].slice().sort(byStand);
			var sum = 0, any = false;
			list.forEach(function (b) { var p = parseFloat(b.price); if (!isNaN(p)) { sum += p * (b.qty || 1); any = true; } });
			out += '<section class="pl-group"><h3><span class="pl-stop">' + App.num(stop) + '</span>' + L('القاعة ', 'Hall ') + App.num(h) +
				'<small>' + App.books(list.length) + (any ? ' · ' + esc(App.money(sum)) : '') + '</small></h3>' +
				'<ul class="pl-list">' + list.map(function (b) { return rowHtml(b, 'fair'); }).join('') + '</ul></section>';
		});
		if (noPlace.length && !onlyHall) {
			out += '<section class="pl-group pl-noplace"><h3>' + L('في المعرض، والمكان لم يُحدد', 'At the fair, no stand yet') + '<small>' + L('اضغط على الكتاب لتحدد قاعته وجناحه', 'Tap a book to set its hall and stand') + '</small></h3>' +
				'<ul class="pl-list">' + noPlace.map(function (b) { return rowHtml(b, 'fair'); }).join('') + '</ul></section>';
		}

		/* the bookshops */
		if (store.length && !onlyHall) {
			var shops = {}, order = [];
			store.forEach(function (b) { var k = (b.place || {}).store || ''; if (!shops[k]) { shops[k] = []; order.push(k); } shops[k].push(b); });
			order.sort(function (a, b) { return !a - !b || a.localeCompare(b); });
			out += '<h2 class="pl-h2">' + App.icon('store') + L('من المكتبات خارج المعرض', 'From bookshops outside the fair') + '</h2>' +
				order.map(function (k) {
					return '<section class="pl-group"><h3>' + esc(k || L('مكتبة لم تُحدد', 'Shop not chosen')) + '<small>' + App.books(shops[k].length) + '</small></h3>' +
						'<ul class="pl-list">' + shops[k].map(function (b) { return rowHtml(b, 'store'); }).join('') + '</ul></section>';
				}).join('');
		}

		/* bought, the last few */
		if (bought.length && !onlyHall) {
			out += '<details class="pl-bought"><summary>' + App.icon('bought') + L('اشتريته', 'Bought') + ' <b>' + App.num(bought.length) + '</b>' + (App.sum('bought') != null ? ' · ' + esc(App.money(App.sum('bought'))) : '') + '</summary>' +
				'<ul class="pl-list">' + bought.map(function (b) { return rowHtml(b, 'bought'); }).join('') + '</ul></details>';
		}
		mount.innerHTML = out;
	}

	function init() {
		mount = document.getElementById('plan-mount');
		mount.addEventListener('click', function (ev) {
			var t = ev.target;
			var h = t.closest('[data-hall]');
			if (h) { var v = h.getAttribute('data-hall'); onlyHall = onlyHall === v ? '' : v; render(); return; }
			if (t.closest('[data-print]')) { window.print(); return; }
			var e = t.closest('[data-edit]');
			if (e) window.Book.open(e.getAttribute('data-edit'));
		});
		mount.addEventListener('change', function (ev) {
			var c = ev.target.closest('[data-tick]');
			if (!c) return;
			var at = App.find(c.getAttribute('data-tick'));
			if (!at) return;
			if (c.checked) {
				var from = at.list;
				var li = c.closest('.pl-row'); li.classList.add('is-done');
				setTimeout(function () {
					App.put('bought', at.book);
					var n = window.Notify && window.Notify(App.esc(L('اشتريت «', 'Bought “') + at.book.title + L('» ✓', '” ✓')) + ' <button type="button" class="ns-action ns-later">' + L('تراجع', 'Undo') + '</button>', { html: true, type: 'success', ttl: 5000 });
					var u = n && n.el.querySelector('.ns-action');
					if (u) u.addEventListener('click', function () { App.put(from, at.book, at.index); n.dismiss(); });
				}, 350);
			} else {
				/* unticked: back to where it was to be bought */
				App.put(at.book.place && at.book.place.where === 'store' ? 'store' : 'fair', at.book);
			}
		});
		document.addEventListener('bl-change', render);
		document.addEventListener('bl-lang', render);
		render();
	}

	window.Plan = { init: init, render: render };
})();
