# Neon Sunset Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns any photo and a caption into GTA-style
multi-panel cover art, exported as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/c/gta6-cover-art-01) bounty on
make.fun.

## What it does

- **Six layouts** — Vice Grid (nine panels), Hero + Three, Full Bleed,
  Split Duo, Tilted Snaps (polaroids) and Story Columns.
- **Five sunset/neon grades** — Vice Sunset, Neon Nights, Golden Hour,
  Hot Pink and Teal Noir, applied as canvas filters plus tint washes.
- **Poster lettering, drawn in code** — a retro slit-sun title band with
  hand-drawn palm silhouettes, an Anton title filled with a sunset
  gradient, a Pacifico neon subtitle, a five-star heat meter and a
  "Sunset City • Est. 2026" badge. Deterministic seeded grain and a
  vignette finish every cover.
- **Any photo** — load your own photos (they never leave your machine),
  fill several panels with one photo or mix several, then crop and
  position each panel by dragging, scrolling to zoom, or with sliders.
- **Fast and easy** — photo to PNG in three steps, exported at the
  common post sizes: 1920 × 1080, 1080 × 1080 and 1080 × 1350.

## Try it

Serve `app/` with any static file server and open `app/index.html` in
desktop Chrome. Everything runs offline: no network requests, no
upload, no build step.

```sh
cd app && python3 -m http.server 8080
# open http://localhost:8080
```

Click **Load sample photos** to try it with the two model-made sample
shots shipped under `app/samples/`, or add your own photos instead.

## Layout

- `main.ts` — the entry program (Node 22, stdlib only): copies `app/`
  and `screenshots/` to the output directory and writes
  `dossier.json` via `vendor/makefun-app.ts`.
- `app/index.html`, `app/style.css` — the editor page and its chrome.
- `app/cover.js` — the cover engine: layouts, grades, title band,
  palms, slit sun, grain, vignette.
- `app/editor.js` — photo loading, per-panel crop/position, live
  preview, PNG export, and the `?shot=cover` staging mode used for
  the screenshots.
- `app/fonts/` — Anton and Pacifico, shipped under the SIL Open Font
  License (see each font's `OFL.txt`).
- `app/samples/` — two model-made sample photos, free to use.
- `screenshots/` — the cover and editor shots taken from the app
  itself: an exported 1920 × 1080 cover, the editor with photos
  loaded, an exported 1080 × 1350 cover and an exported 1080 × 1080
  cover.

## Originality

All art and lettering here is original and drawn in code. No Rockstar
Games logo, wordmark, official artwork, character or font is used
anywhere in the app or its screenshots.

## License

MIT — see [LICENSE](LICENSE). SPDX-License-Identifier: MIT.
