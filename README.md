# Neon Sunset Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Neon Sunset Cover Studio** turns your photos and a caption into GTA-style
multi-panel cover art — a Vice City sunset grade, bold display lettering, a
retro-sun title band with palm silhouettes, a star heat meter and a badge
ribbon — and exports it as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on
[make.fun](https://make.fun).

## What it does

- **Six multi-panel layouts** — Vice Grid, Hero Three, Tilted Snaps
  (polaroids), Duo Split, Single Hero and Film Strip — each with its own
  panel geometry.
- **Five sunset / neon grades** — Vice Sunset, Neon Nights, Golden Hour,
  Hot Pink and Miami Dawn — that tint the photos and paint the title band.
- **Any photo** — upload your own (they never leave your machine) or use
  the two model-made samples. Crop and position each panel: drag to pan,
  scroll to zoom, or use the sliders. One photo can fill every panel, or
  photos can mix across panels.
- **Editable caption** — title, subtitle, badge ribbon and a 0–5 star heat
  meter, all live in the preview.
- **Fast and easy** — a photo to a finished PNG in a few clicks, at the
  three common post sizes: **1920 × 1080**, **1080 × 1080** and
  **1080 × 1350**.
- **Original art only** — the lettering, sun, palms, grades and grain are
  drawn by the app. No Rockstar logo, artwork or font anywhere. The two
  display fonts are vendored under `app/fonts/` under the SIL Open Font
  License: Bebas Neue (titles) and Caveat (subtitles).

## Run it

The app is static files under `app/` — no build step, no network. Serve
the folder with any static server and open `app/index.html` in desktop
Chrome:

```sh
python3 -m http.server 8080 --directory app
# open http://localhost:8080
```

1. Add photos (upload, drop onto the preview, or load the samples).
2. Pick a layout and a grade.
3. Type the title, subtitle and badge; set the heat.
4. Click a panel, then drag, scroll or slide to crop it.
5. Pick an export size and hit **Export PNG**.

## Staging mode (for screenshots)

`?shot=cover` renders one staged cover at export size with the editor
chrome hidden; `?shot=editor` stages the editor with photos loaded. Both
take `layout`, `grade`, `title`, `subtitle`, `badge`, `heat` and `size`
parameters, for example:

```text
index.html?shot=cover&layout=vice-grid&grade=vice-sunset&title=NEON%20SHORE&size=1920x1080
```

## Layout

- `app/index.html` — the page and editor chrome.
- `app/style.css` — the dark neon editor theme and font faces.
- `app/cover.js` — the render engine: layouts, grades, retro sun, palms,
  star meter, badge ribbon, deterministic grain and vignette.
- `app/editor.js` — photo upload, per-panel crop controls, assignment,
  live preview, PNG export and staging mode.
- `app/fonts/` — Bebas Neue + Caveat (SIL OFL), with licence texts.
- `app/samples/` — two model-made sample photos.
- `main.ts` — the entrypoint: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json` with `buildDossier` from
  `vendor/makefun-app.ts` (the kit's copy, unchanged).
- `screenshots/` — four JPEGs: the exported cover first, then the editor
  at work and the other export sizes.

## Verify it

```sh
rm -rf /tmp/out1 /tmp/out2
MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts
MAKEFUN_OUTPUT_DIR=/tmp/out2 node main.ts
diff -r /tmp/out1 /tmp/out2   # clean: both runs write identical bytes
```

## License

MIT — see [LICENSE](LICENSE).
