[![Make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/ariffforai/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

# Neon Sunset Cover Studio

Turn any photo into GTA-style multi-panel cover art — offline, in your browser, in four steps. Built for the [Make GTA 6 Cover Art](https://make.fun/c/gta6-cover-art-01) bounty on [make.fun](https://make.fun/c/gta6-cover-art-01).

**1. Add photos → 2. Pick a layout → 3. Write the caption & grade → 4. Export a PNG.**

## What it does

- **Any photo, any panel.** Load your own photos from your machine (they never leave it). Fill all nine panels with one photo, or give every panel its own. Click a panel, drag the photo inside it, scroll to zoom, or use the sliders — each panel crops and positions independently.
- **Six poster layouts.** Vice Grid (nine-panel), Hero + Three, Full Bleed, Split Duo, Tilted Snaps (polaroids), and Story Columns.
- **Five sunset / neon grades.** Vice Sunset, Neon Nights, Golden Hour, Hot Pink, Teal Noir — warm light, cool neon, and a film grain + vignette finish on every cover.
- **Bold display lettering, your words.** An editable title in Anton with a sunset gradient fill and dark outline, a neon-script subtitle in Pacifico, a retro slit sun, hand-drawn palm silhouettes, and a five-star heat meter with a "Sunset City" badge ribbon.
- **Three post sizes, one click.** Export PNG at 1920×1080, 1080×1080, or 1080×1350 — or all three at once.
- **Live preview.** The preview is the exact cover the export writes, drawn by the same code.

## Run it

Serve `app/` with any static server and open `index.html` — no build step, no network request:

```sh
python3 -m http.server --directory app 8080
# open http://localhost:8080
```

Sample photos ship under `app/samples/` (model-made for this app) so the editor opens with art already in it.

## Originality

Everything here is original: the layouts, the lettering, the palm/sun art drawn in code, and the Anton + Pacifico fonts, both shipped under the SIL Open Font License (see `app/fonts/`). No Rockstar Games logo, wordmark, official artwork, character, or font appears anywhere.

## How the entry is handed in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR` outside the grader) and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-app.ts`. Running it twice writes byte-identical output.

## License

MIT — see [LICENSE](LICENSE).
