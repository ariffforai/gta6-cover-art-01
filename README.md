# Neon Sunset Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Turn any photo into GTA-style cover art — in the browser, offline, no account.

**[Enter the bounty on make.fun](https://make.fun/c/gta6-cover-art-01)**

## What it does

Neon Sunset Cover Studio is a cover-art maker in the style of GTA 6's posters.
Drop in a photo (or use the two built-in samples), pick a layout and a sunset
grade, write a title, and export a poster-sized PNG to share.

- **6 layouts** — Vice Grid (2×2), Hero Three, Tilted Snaps (polaroids),
  Film Strip, Duo Split and Solo Poster.
- **5 sunset grades** — Vice Sunset, Neon Nights, Golden Hour, Hot Pink and
  Midnight Drive. Each grade re-colours the sky, the retro sun, the title and
  the photo tint.
- **Retro-sun title band** — a striped setting sun, hand-drawn palm
  silhouettes, a big Archivo Black title with a Dancing Script subtitle, a
  five-star heat meter and a badge ribbon, laid out in three separated zones
  so text never overlaps at any size.
- **Photo control** — click a panel to select it, drag to pan, scroll to
  zoom, or use the sliders. Assign one photo to every panel or mix photos
  across panels. Wide panels automatically lift the crop toward the faces.
- **Export** — real PNG export at 1920×1080 (landscape), 1080×1080 (square)
  and 1080×1350 (portrait). The export is exactly what the preview shows:
  same engine, same grain, same vignette.
- **Offline** — plain static files, no libraries, no network requests. The
  two display fonts (Archivo Black and Dancing Script, both SIL OFL) are
  vendored under `app/fonts/`, and the two sample photos were made for
  make.fun and are free to use.

## Try it

Serve `app/` with any static file server and open `index.html`:

```sh
python3 -m http.server 8080 --directory app
# open http://localhost:8080
```

Add `?shot=cover` to stage a cover full-screen, with optional
`layout`, `grade`, `title`, `subtitle`, `heat`, `badge`, `w`, `h` and
`assign` (one / mix) parameters — for example:

```
index.html?shot=cover&layout=vice-grid&grade=vice-sunset&title=NEON%20SHORE&w=1920&h=1080
```

## How it is built

- `app/cover.js` — the render engine: layouts, grades, title band, palms,
  star meter, badge ribbon, deterministic grain and vignette.
- `app/editor.js` — the editor: photo upload, assignment, per-panel pan and
  zoom, toolbar, live preview and PNG export.
- `app/index.html`, `app/style.css` — the page and its dark neon chrome.
- `main.ts` — the entry point: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun
  library. It only creates the output directory and copies files into it.
- `vendor/makefun-app.ts` — the make.fun dossier library, as shipped in
  the bounty kit.

No Rockstar Games logo, artwork or font is used anywhere in this entry.

## License

MIT — see [LICENSE](LICENSE).
