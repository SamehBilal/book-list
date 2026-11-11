/* Notifications — after Codrops' NotificationFx ("growl" layout, "jelly" effect), rebuilt
   without classie: window.Notify(message, { type, title, ttl }) shows a box in the top
   corner that wobbles in, closes itself after ttl ms (or with its cross), and stacks with
   any others. type: notice | success | warning | error. Loaded on every page. */
(function () {
	'use strict';
	var stack = null;

	/* the notes start just under the site's header, whatever its height on this screen, never over the menu */
	function place() {
		var h = document.querySelector('.site-header');
		var b = h ? h.getBoundingClientRect().bottom : 0;
		stack.style.top = Math.max(10, Math.round(b) + 12) + 'px';
	}

	function ensure() {
		if (stack && stack.isConnected) { place(); return stack; }
		stack = document.createElement('div');
		stack.className = 'ns-stack';
		stack.setAttribute('role', 'status');
		stack.setAttribute('aria-live', 'polite');
		document.body.appendChild(stack);
		place();
		window.addEventListener('resize', place);
		window.addEventListener('scroll', place, { passive: true });
		return stack;
	}

	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

	function Notify(message, opt) {
		opt = opt || {};
		var root = ensure();
		var App = window.App, L = App ? App.L : function (a) { return a; };
		var box = document.createElement('div');
		box.className = 'ns-box ns-growl ns-effect-jelly ns-type-' + (opt.type || 'notice');
		box.innerHTML = '<div class="ns-box-inner">' + (opt.title ? '<span class="ns-title">' + esc(opt.title) + '</span>' : '') +
			'<p>' + (opt.html ? message : esc(message)) + '</p></div>' +
			'<button type="button" class="ns-close" aria-label="' + esc(L('إغلاق', 'Close')) + '"></button>';
		/* newest on top, at most four at once */
		root.insertBefore(box, root.firstChild);
		while (root.children.length > 4) root.lastChild.remove();

		var active = true, timer = null;
		var dismiss = function () {
			if (!active) return;
			active = false; clearTimeout(timer);
			box.classList.remove('ns-show');
			setTimeout(function () { box.classList.add('ns-hide'); }, 25);
			var gone = function () { if (box.parentNode) box.remove(); };
			box.addEventListener('animationend', function (ev) { if (ev.target === box && box.classList.contains('ns-hide')) gone(); });
			setTimeout(gone, 600); /* in case the animation never runs */
		};
		box.querySelector('.ns-close').addEventListener('click', dismiss);
		/* a hovered notification waits */
		box.addEventListener('mouseenter', function () { clearTimeout(timer); });
		box.addEventListener('mouseleave', function () { if (active && opt.ttl !== 0) timer = setTimeout(dismiss, 2500); });
		requestAnimationFrame(function () { box.classList.add('ns-show'); });
		setTimeout(function () { box.classList.add('ns-show'); }, 30);
		if (opt.ttl !== 0) timer = setTimeout(dismiss, opt.ttl || 4500);
		return { dismiss: dismiss, el: box };
	}

	window.Notify = Notify;
})();
