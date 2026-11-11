# قائمة الكتب — Book List

A bilingual (Arabic / English) app for planning what to buy at the book fair or from a bookshop. Search for a book by title or author, drag its cover to a list, note its publisher, edition and where to find it — the fair's hall (1–6), section (A, B, C) and stand number (A1, B14, C58…), or a bookshop outside the fair — then walk the fair hall by hall.

Static site, no build step and no server: open it from any static host (GitHub Pages works). It installs as an app and works offline.

## What it does

| View | |
|---|---|
| **ابحث · Search** (`#search`) | Searches [Open Library](https://openlibrary.org/developers/api) by everything, title or author, with a language filter (an ISBN goes straight to its book). Each result is a cover: **drag it** (or long-press on a phone) and a panel slides up from the bottom with the four lists to drop it on; or use the small list buttons on the cover, or tap it for its details. «أضف كتابًا يدويًا» adds a book Open Library doesn't have. |
| **قوائمي · My lists** (`#lists`) | Four lists: **من المعرض** (at the fair), **من مكتبة** (from a bookshop), **ربما** (maybe) and **اشتريته** (bought). Drag a book by its grip to reorder it or move it to another list (or focus the grip and use the arrow keys). Each list shows its total price. Export as JSON, CSV (opens in Excel with the Arabic intact) or text, copy, import a JSON export back, share a list as text. |
| **جولة المعرض · Fair route** (`#plan`) | The fair list ordered by hall, then section, then stand number, so each hall is walked once; the six halls as a map with how many books wait in each (tap one to see only it); the books with no stand yet; then the bookshop list grouped by shop. Tick a book and it moves to «اشتريته» (with undo). «اطبع القائمة» prints it as a paper list. |

**A book's card** (tap a title or cover): which list; where to buy it — the fair (hall, section, stand number, and the stand's or publisher's name) or a bookshop (with suggestions); the edition — publisher, year, edition, language, ISBN, pages — typed by hand or picked from Open Library's editions of the work (Arabic editions first); price and copies; notes. When a publisher's stand is already in your list, it offers to use the same stand.

Everything is kept in this browser (`localStorage`, key `bl-lists`); nothing is sent anywhere except the searches to Open Library.

The drag and drop is the one from the [Ahmed Khaled Tawfik site](https://github.com/samehbilal/ahmed-khaled-tawfik)'s lists, itself adapted from Codrops' *Drag and Drop Interaction Ideas* (the bottom slide), rebuilt on pointer events. The notifications are its Codrops *NotificationFx* (growl, jelly).

## Files

| | |
|---|---|
| `index.html` | The page and its three views |
| `assets/js/core.js` | Language, numbers, the lists' state and storage, a book's place as text |
| `assets/js/search.js` | Open Library search and editions |
| `assets/js/lists.js` | The lists: the bottom panel, dragging covers, the grip, export / import / share |
| `assets/js/book.js` | A book's card |
| `assets/js/plan.js` | The fair route |
| `assets/js/main.js` | Views, Arabic / English, light / dark, the `?demo=1` sample lists |
| `assets/js/pwa.js`, `sw.js`, `manifest.webmanifest`, `offline.html` | The app: install button (and the steps on iPhone), update prompt, offline |
| `assets/js/notify.js`, `assets/css/notify.css` | Notifications |

## The app (PWA)

`sw.js` caches the app so it opens offline; covers are kept once seen, so your lists show them without a connection (search needs one). The manifest has icons (including maskable), shortcuts to the three views, and screenshots for the richer install dialog.

After changing any file, run:

```bash
node tools/build-sw.js
```

It rewrites `sw.js`'s file list and version, so installed apps offer the update.

To redraw the icons (from `assets/img/icon.svg`) and the install screenshots (`assets/img/screens/`, taken from `?demo=1` with a live search), with Chrome or Edge installed and Node 22+:

```bash
node tools/shoot.js
```

## Try it locally

```bash
node tools/serve.js
```

then open http://localhost:8080 (`?demo=1` fills the lists with samples that are not saved).
