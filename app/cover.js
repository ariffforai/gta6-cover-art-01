// Neon Sunset Cover Studio — the cover engine.
//
// Draws GTA-poster-style multi-panel cover art on a 2D canvas: a grid of
// photo panels with a Vice City sunset / neon grade, a retro-sun title band
// with hand-drawn palm silhouettes, bold display lettering and a star badge.
// Everything is drawn in code from the photos the user loads; no artwork,
// logo or font comes from any game. Deterministic: the grain uses a fixed
// seed, so the same state always exports the same PNG bytes.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------- sizes

  var SIZES = [
    { id: 'wide', label: 'Story wide · 1920 x 1080', w: 1920, h: 1080 },
    { id: 'square', label: 'Square post · 1080 x 1080', w: 1080, h: 1080 },
    { id: 'portrait', label: 'Portrait post · 1080 x 1350', w: 1080, h: 1350 },
  ];

  function sizeById(id) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === id) return SIZES[i];
    return SIZES[0];
  }

  // ---------------------------------------------------------------- grades

  // Each grade is a canvas filter for the photo plus one or two tint
  // overlays painted over it. The overlays are what make the sunset / neon
  // look: warm light from below, cool neon from above.
  var GRADES = [
    {
      id: 'vice-sunset',
      name: 'Vice Sunset',
      swatch: 'linear-gradient(135deg,#ffd166,#ff6b35 55%,#e84a7a)',
      filter: 'saturate(1.4) contrast(1.08) sepia(0.22) brightness(1.03)',
      overlays: [
        { blend: 'soft-light', alpha: 0.55, stops: [[0, '#ff9e00'], [1, '#ff2e88']] },
        { blend: 'screen', alpha: 0.10, stops: [[0, '#fff3b0'], [1, '#ff8c42']] },
      ],
    },
    {
      id: 'neon-nights',
      name: 'Neon Nights',
      swatch: 'linear-gradient(135deg,#00e5ff,#7b2d8b 55%,#ff2e88)',
      filter: 'saturate(1.55) contrast(1.14) brightness(0.98) hue-rotate(-12deg)',
      overlays: [
        { blend: 'overlay', alpha: 0.5, stops: [[0, '#00e5ff'], [1, '#ff2e88']] },
        { blend: 'screen', alpha: 0.08, stops: [[0, '#7df9ff'], [1, '#ff5da2']] },
      ],
    },
    {
      id: 'golden-hour',
      name: 'Golden Hour',
      swatch: 'linear-gradient(135deg,#fff3b0,#ffb347 55%,#c96f2e)',
      filter: 'saturate(1.3) sepia(0.35) contrast(1.05) brightness(1.06)',
      overlays: [
        { blend: 'soft-light', alpha: 0.5, stops: [[0, '#ffd166'], [1, '#ff8c42']] },
        { blend: 'screen', alpha: 0.08, stops: [[0, '#fff8d6'], [1, '#ffb347']] },
      ],
    },
    {
      id: 'hot-pink',
      name: 'Hot Pink',
      swatch: 'linear-gradient(135deg,#ff8fd1,#ff2e88 55%,#7b2d8b)',
      filter: 'saturate(1.7) contrast(1.1) hue-rotate(8deg) brightness(1.02)',
      overlays: [
        { blend: 'screen', alpha: 0.16, stops: [[0, '#ff8fd1'], [1, '#ff2e88']] },
        { blend: 'overlay', alpha: 0.3, stops: [[0, '#ff5da2'], [1, '#7b2d8b']] },
      ],
    },
    {
      id: 'teal-noir',
      name: 'Teal Noir',
      swatch: 'linear-gradient(135deg,#0f766e,#164e63 55%,#1b0f3b)',
      filter: 'saturate(0.85) contrast(1.22) brightness(0.94)',
      overlays: [
        { blend: 'multiply', alpha: 0.28, stops: [[0, '#0e7490'], [1, '#164e63']] },
        { blend: 'screen', alpha: 0.07, stops: [[0, '#a5f3fc'], [1, '#67e8f9']] },
      ],
    },
  ];

  function gradeById(id) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].id === id) return GRADES[i];
    return GRADES[0];
  }

  // ---------------------------------------------------------------- layouts

  // A layout is a function of the art rectangle (the area above the title
  // band) returning panel rects in pixels. Panels carry an optional rotation
  // for the tilted polaroid layout. The title band is always the bottom 26%.
  var TITLE_FRACTION = 0.26;

  function frameOf(w, h) {
    return Math.max(6, Math.round(Math.min(w, h) * 0.011));
  }

  function gutterOf(w, h) {
    return Math.max(4, Math.round(Math.min(w, h) * 0.009));
  }

  function gridPanels(art, cols, rows, g) {
    var panels = [];
    var cw = (art.w - g * (cols - 1)) / cols;
    var ch = (art.h - g * (rows - 1)) / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        panels.push({
          x: art.x + c * (cw + g),
          y: art.y + r * (ch + g),
          w: cw,
          h: ch,
          rot: 0,
        });
      }
    }
    return panels;
  }

  var LAYOUTS = [
    {
      id: 'vice-grid',
      name: 'Vice Grid',
      blurb: 'Nine-panel poster grid',
      panels: function (art, g) {
        return gridPanels(art, 3, 3, g);
      },
    },
    {
      id: 'hero-three',
      name: 'Hero + Three',
      blurb: 'One hero panel, three stacked',
      panels: function (art, g) {
        var heroW = art.w * 0.62;
        var sideX = art.x + heroW + g;
        var sideW = art.w - heroW - g;
        var ch = (art.h - g * 2) / 3;
        var panels = [{ x: art.x, y: art.y, w: heroW, h: art.h, rot: 0 }];
        for (var i = 0; i < 3; i++) {
          panels.push({ x: sideX, y: art.y + i * (ch + g), w: sideW, h: ch, rot: 0 });
        }
        return panels;
      },
    },
    {
      id: 'full-bleed',
      name: 'Full Bleed',
      blurb: 'One photo, edge to edge',
      panels: function (art, g, w, h) {
        return [{ x: 0, y: 0, w: w, h: h, rot: 0 }];
      },
    },
    {
      id: 'split-duo',
      name: 'Split Duo',
      blurb: 'Two tall halves',
      panels: function (art, g) {
        return gridPanels(art, 2, 1, g);
      },
    },
    {
      id: 'tilted-snaps',
      name: 'Tilted Snaps',
      blurb: 'Three tilted polaroids',
      panels: function (art, g) {
        // Polaroid height includes the caption strip below the photo, so
        // size the photo to leave room for it inside the art area.
        var ph = art.h * 0.74;
        var totalH = ph * 1.14;
        var cy = art.y + (art.h - totalH) / 2;
        var pw = art.w * 0.31;
        return [
          { x: art.x + art.w * 0.02, y: cy - art.h * 0.02, w: pw, h: ph, rot: -0.09, polaroid: true },
          { x: art.x + art.w * 0.345, y: cy + art.h * 0.02, w: pw, h: ph, rot: 0.02, polaroid: true },
          { x: art.x + art.w * 0.67, y: cy - art.h * 0.02, w: pw, h: ph, rot: 0.08, polaroid: true },
        ];
      },
    },
    {
      id: 'story-columns',
      name: 'Story Columns',
      blurb: 'Three columns, staggered',
      panels: function (art, g) {
        var cw = (art.w - g * 2) / 3;
        return [
          { x: art.x, y: art.y, w: cw, h: art.h, rot: 0 },
          { x: art.x + cw + g, y: art.y + art.h * 0.09, w: cw, h: art.h * 0.82, rot: 0 },
          { x: art.x + (cw + g) * 2, y: art.y, w: cw, h: art.h, rot: 0 },
        ];
      },
    },
  ];

  function layoutById(id) {
    for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].id === id) return LAYOUTS[i];
    return LAYOUTS[0];
  }

  // Panels + title zone for a canvas of W x H and a layout id.
  function layoutPanels(w, h, layoutId) {
    var layout = layoutById(layoutId);
    var f = frameOf(w, h);
    var g = gutterOf(w, h);
    var titleH = Math.round(h * TITLE_FRACTION);
    var art = { x: f, y: f, w: w - 2 * f, h: h - titleH - f };
    var panels = layout.panels(art, g, w, h);
    var titleZone = { x: 0, y: h - titleH, w: w, h: titleH };
    return { panels: panels, titleZone: titleZone, frame: f, gutter: g, art: art };
  }

  // ---------------------------------------------------------------- helpers

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Deterministic pseudo-random: the same seed always draws the same grain.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // One five-point star, centred, for the heat-meter row.
  function drawStar(ctx, cx, cy, r, fill, stroke) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var px = cx + Math.cos(ang) * rad;
      var py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // A stylised palm silhouette: curved trunk, seven drooping fronds.
  function drawPalm(ctx, x, y, s, lean) {
    var topX = x + lean * s;
    var topY = y - s * 1.15;
    ctx.save();
    ctx.strokeStyle = '#160a2e';
    ctx.fillStyle = '#160a2e';
    ctx.lineCap = 'round';
    // Trunk, drawn as a tapering filled shape.
    ctx.beginPath();
    ctx.moveTo(x - s * 0.045, y);
    ctx.quadraticCurveTo(x + lean * s * 0.4, y - s * 0.6, topX - s * 0.02, topY);
    ctx.lineTo(topX + s * 0.05, topY);
    ctx.quadraticCurveTo(x + lean * s * 0.4 + s * 0.06, y - s * 0.55, x + s * 0.045, y);
    ctx.closePath();
    ctx.fill();
    // Fronds.
    ctx.lineWidth = Math.max(2, s * 0.035);
    var fronds = [-2.6, -2.0, -1.4, -0.7, 0, 0.7, 1.4, 2.0];
    for (var i = 0; i < fronds.length; i++) {
      var a = fronds[i];
      var ex = topX + Math.sin(a) * s * 0.62;
      var ey = topY - Math.cos(a) * s * 0.28 + Math.abs(a) * s * 0.14;
      var mx = topX + Math.sin(a) * s * 0.34;
      var my = topY - Math.cos(a) * s * 0.3;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // Leaflets along the frond.
      var lx = topX;
      var ly = topY;
      for (var k = 1; k <= 3; k++) {
        var t = k / 4;
        var bx = topX + (ex - topX) * t;
        var by = topY + (ey - topY) * t;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a) * s * 0.1, by + s * 0.09);
        ctx.stroke();
        lx = bx;
        ly = by;
      }
    }
    // Coconuts.
    ctx.beginPath();
    ctx.arc(topX - s * 0.03, topY + s * 0.05, s * 0.035, 0, Math.PI * 2);
    ctx.arc(topX + s * 0.05, topY + s * 0.06, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBird(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = 'rgba(27,15,59,0.75)';
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.7, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.7, x + s, y);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- grading

  // Paints one photo, graded, into a panel rect of the destination context.
  // The photo is first drawn cover-fit onto a scratch canvas at panel size
  // (so the filter and tint apply per panel), then blitted in place.
  function drawGradedPhoto(ctx, img, rect, crop, grade) {
    var pw = Math.max(2, Math.round(rect.w));
    var ph = Math.max(2, Math.round(rect.h));
    var scratch = document.createElement('canvas');
    scratch.width = pw;
    scratch.height = ph;
    var sctx = scratch.getContext('2d');
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var base = Math.max(pw / iw, ph / ih);
    var scale = base * (crop.zoom || 1);
    var sw = pw / scale;
    var sh = ph / scale;
    var cx = (crop.fx == null ? 0.5 : crop.fx) * iw;
    var cy = (crop.fy == null ? 0.5 : crop.fy) * ih;
    var sx = clamp(cx - sw / 2, 0, Math.max(0, iw - sw));
    var sy = clamp(cy - sh / 2, 0, Math.max(0, ih - sh));
    sctx.filter = grade.filter;
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
    sctx.filter = 'none';
    for (var i = 0; i < grade.overlays.length; i++) {
      var ov = grade.overlays[i];
      var grad = sctx.createLinearGradient(0, 0, pw * 0.25, ph);
      for (var j = 0; j < ov.stops.length; j++) {
        grad.addColorStop(ov.stops[j][0], ov.stops[j][1]);
      }
      sctx.globalCompositeOperation = ov.blend;
      sctx.globalAlpha = ov.alpha;
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, pw, ph);
    }
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    ctx.drawImage(scratch, rect.x, rect.y, rect.w, rect.h);
  }

  // A flat sunset wash for panels with no photo yet.
  function drawEmptyPanel(ctx, rect, grade, index) {
    var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.3, rect.y + rect.h);
    grad.addColorStop(0, '#7b2d8b');
    grad.addColorStop(0.55, '#e84a7a');
    grad.addColorStop(1, '#ff8c42');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 ' + Math.max(14, Math.round(rect.h * 0.09)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO ' + (index + 1), rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  // ---------------------------------------------------------------- title band

  function drawTitleBand(ctx, w, h, zone, state, skyGrad) {
    var grade = gradeById(state.gradeId);
    var title = (state.title || 'NEON SHORE').toUpperCase();
    var subtitle = state.subtitle || '';
    var band = zone;
    // Sky.
    ctx.fillStyle = skyGrad;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    // Retro sun, upper right, with slit cuts in the sky's own gradient.
    var sunR = band.h * 0.44;
    var sunX = w * 0.8;
    var sunY = band.y + band.h * 0.46;
    var sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunGrad.addColorStop(0, '#fff3b0');
    sunGrad.addColorStop(0.55, '#ffb347');
    sunGrad.addColorStop(1, '#ff5e62');
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = skyGrad;
    var slit = sunR * 0.1;
    for (var i = 0; i < 4; i++) {
      var sy = sunY + sunR * 0.08 + i * sunR * 0.2;
      ctx.fillRect(sunX - sunR, sy, sunR * 2, slit * (1 + i * 0.35));
    }
    ctx.restore();
    // Palms left and right, birds, halftone dots.
    var palmH = band.h * 0.92;
    drawPalm(ctx, w * 0.045, band.y + band.h * 0.98, palmH * 0.62, 0.35);
    drawPalm(ctx, w * 0.955, band.y + band.h * 0.98, palmH * 0.5, -0.3);
    drawBird(ctx, w * 0.3, band.y + band.h * 0.2, Math.max(8, band.h * 0.05));
    drawBird(ctx, w * 0.38, band.y + band.h * 0.32, Math.max(6, band.h * 0.04));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    var dotGap = Math.max(10, band.h * 0.11);
    for (var dy = band.y + dotGap; dy < band.y + band.h * 0.45; dy += dotGap) {
      for (var dx = band.x + dotGap; dx < w * 0.22; dx += dotGap) {
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(1.5, band.h * 0.014), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Gold rule above the band.
    var rule = ctx.createLinearGradient(0, 0, w, 0);
    rule.addColorStop(0, 'rgba(255,209,102,0)');
    rule.addColorStop(0.5, '#ffd166');
    rule.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = rule;
    ctx.fillRect(0, band.y - 1, w, Math.max(2, band.h * 0.02));
    // Title: fit to 86% of the width.
    var maxW = w * 0.86;
    var size = band.h * 0.5;
    var fontFor = function (s) {
      return s + 'px Anton, "Arial Black", sans-serif';
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontFor(size);
    try {
      ctx.letterSpacing = '2px';
    } catch (e) {
      /* older canvas: no letter spacing */
    }
    while (size > 12 && ctx.measureText(title).width > maxW) {
      size -= 2;
      ctx.font = fontFor(size);
    }
    var titleY = band.y + band.h * 0.4;
    var titleGrad = ctx.createLinearGradient(0, titleY - size * 0.55, 0, titleY + size * 0.55);
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(0.5, '#ffe66d');
    titleGrad.addColorStop(1, '#ff7b39');
    ctx.save();
    ctx.shadowColor = 'rgba(20,5,40,0.5)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = Math.max(2, size * 0.05);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.07);
    ctx.strokeStyle = '#1b0f3b';
    ctx.strokeText(title, w / 2, titleY);
    ctx.fillStyle = titleGrad;
    ctx.fillText(title, w / 2, titleY);
    ctx.restore();
    try {
      ctx.letterSpacing = '0px';
    } catch (e) {
      /* ignore */
    }
    // Subtitle in neon script, with a glow.
    var subY = band.y + band.h * 0.72;
    if (subtitle) {
      var subSize = band.h * 0.15;
      ctx.font = subSize + 'px Pacifico, cursive';
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = Math.max(6, subSize * 0.5);
      ctx.fillStyle = '#ff8fd1';
      ctx.fillText(subtitle, w / 2, subY);
      ctx.shadowBlur = 0;
    }
    // Star heat meter + badge ribbon, centred under the subtitle.
    var starY = band.y + band.h * 0.9;
    var starR = Math.max(4, band.h * 0.045);
    var starGap = starR * 2.6;
    var starsW = starGap * 4;
    var badge = 'SUNSET CITY  •  EST. 2026';
    var badgeFont = Math.max(9, Math.round(band.h * 0.075)) + 'px Anton, "Arial Black", sans-serif';
    ctx.font = badgeFont;
    var badgeW = ctx.measureText(badge).width + band.h * 0.22;
    var rowW = starsW + band.h * 0.14 + badgeW;
    var rowX = (w - rowW) / 2;
    for (var s = 0; s < 5; s++) {
      drawStar(ctx, rowX + starGap * s + starR, starY, starR, '#ffd166', '#1b0f3b');
    }
    var bx = rowX + starsW + band.h * 0.14;
    var by = starY - band.h * 0.075;
    var bh = band.h * 0.15;
    ctx.fillStyle = 'rgba(20,8,40,0.6)';
    roundRect(ctx, bx, by, badgeW, bh, bh / 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, band.h * 0.008);
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = badgeFont;
    ctx.textAlign = 'center';
    ctx.fillText(badge, bx + badgeW / 2, by + bh / 2 + 1);
    ctx.textAlign = 'center';
  }

  // ---------------------------------------------------------------- the cover

  // state: { layoutId, gradeId, title, subtitle, photos: [img,...],
  //          assign: [photoIndex per panel], crops: [{zoom,fx,fy} per panel] }
  function drawCover(ctx, w, h, state) {
    var layout = layoutPanels(w, h, state.layoutId);
    var grade = gradeById(state.gradeId);
    var f = layout.frame;
    var g = layout.gutter;
    var fullBleed = state.layoutId === 'full-bleed';
    // Base: deep dusk purple.
    ctx.fillStyle = '#1b0f3b';
    ctx.fillRect(0, 0, w, h);
    // Art area background: a sunset wash that shows through the gutters
    // and behind the tilted polaroids.
    var wash = ctx.createLinearGradient(0, 0, w * 0.2, h * 0.74);
    wash.addColorStop(0, '#2b1055');
    wash.addColorStop(0.5, '#7b2d8b');
    wash.addColorStop(1, '#ff8c42');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h * (1 - TITLE_FRACTION));
    // Panels.
    var border = Math.max(3, Math.round(Math.min(w, h) * 0.006));
    for (var i = 0; i < layout.panels.length; i++) {
      var p = layout.panels[i];
      var photoIdx = state.assign && state.assign[i] != null ? state.assign[i] : i % Math.max(1, (state.photos || []).length);
      var photo = state.photos && state.photos[photoIdx];
      // Photos arrive as { img, label } from the editor, or as bare images.
      var img = photo && (photo.img || photo);
      var label = photo && (photo.label || (photo.dataset && photo.dataset.label));
      var crop = (state.crops && state.crops[i]) || { zoom: 1, fx: 0.5, fy: 0.5 };
      ctx.save();
      if (p.rot) {
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        ctx.translate(-p.w / 2, -p.h / 2);
      } else {
        ctx.translate(p.x, p.y);
      }
      if (p.polaroid) {
        // White polaroid frame with a caption strip at the bottom.
        ctx.fillStyle = '#fdfbf7';
        ctx.fillRect(-border * 2, -border * 2, p.w + border * 4, p.h + border * 2 + p.h * 0.14);
        ctx.shadowColor = 'rgba(10,4,30,0.55)';
        ctx.shadowBlur = Math.max(8, p.w * 0.03);
        ctx.shadowOffsetY = Math.max(4, p.w * 0.015);
        ctx.fillRect(-border * 2, -border * 2, p.w + border * 4, p.h + border * 2 + p.h * 0.14);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        var inner = { x: 0, y: 0, w: p.w, h: p.h };
        if (img) drawGradedPhoto(ctx, img, inner, crop, grade);
        else drawEmptyPanel(ctx, inner, grade, i);
        ctx.fillStyle = '#1b0f3b';
        ctx.font = Math.max(12, Math.round(p.h * 0.05)) + 'px Anton, "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label ? label.toUpperCase() : 'SNAPSHOT ' + (i + 1), p.w / 2, p.h + p.h * 0.07);
      } else {
        var rect = { x: 0, y: 0, w: p.w, h: p.h };
        if (img) drawGradedPhoto(ctx, img, rect, crop, grade);
        else drawEmptyPanel(ctx, rect, grade, i);
        // White poster border + thin dark keyline.
        ctx.lineWidth = border;
        ctx.strokeStyle = '#fdfbf7';
        ctx.strokeRect(border / 2, border / 2, p.w - border, p.h - border);
        ctx.lineWidth = Math.max(1, border * 0.25);
        ctx.strokeStyle = 'rgba(27,15,59,0.6)';
        ctx.strokeRect(border * 1.5, border * 1.5, p.w - border * 3, p.h - border * 3);
      }
      ctx.restore();
    }
    // Title band. Full-bleed gets a dark scrim first so the lettering reads.
    var skyGrad = ctx.createLinearGradient(0, layout.titleZone.y, 0, h);
    skyGrad.addColorStop(0, '#2b1055');
    skyGrad.addColorStop(0.4, '#7b2d8b');
    skyGrad.addColorStop(0.7, '#e84a7a');
    skyGrad.addColorStop(0.9, '#ff8c42');
    skyGrad.addColorStop(1, '#ffd166');
    if (fullBleed) {
      var scrim = ctx.createLinearGradient(0, layout.titleZone.y - h * 0.1, 0, h);
      scrim.addColorStop(0, 'rgba(27,15,59,0)');
      scrim.addColorStop(0.5, 'rgba(27,15,59,0.55)');
      scrim.addColorStop(1, 'rgba(27,15,59,0.82)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, layout.titleZone.y - h * 0.1, w, h - layout.titleZone.y + h * 0.1);
      // On a photo, keep the sky band translucent so the photo shows through.
      ctx.globalAlpha = 0.88;
      drawTitleBand(ctx, w, h, layout.titleZone, state, skyGrad);
      ctx.globalAlpha = 1;
    } else {
      drawTitleBand(ctx, w, h, layout.titleZone, state, skyGrad);
    }
    // Outer white frame (except full-bleed, where the photo is the frame).
    if (!fullBleed) {
      ctx.lineWidth = f;
      ctx.strokeStyle = '#fdfbf7';
      ctx.strokeRect(f / 2, f / 2, w - f, h - f);
    }
    // Grain + vignette, deterministic.
    var rnd = mulberry32(20261119);
    var dots = Math.round((w * h) / 900);
    ctx.save();
    for (var d = 0; d < dots; d++) {
      var gx = rnd() * w;
      var gy = rnd() * h;
      ctx.globalAlpha = 0.03 + rnd() * 0.05;
      ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#160a2e';
      ctx.fillRect(gx, gy, 1.4, 1.4);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    var vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(20,8,40,0)');
    vig.addColorStop(1, 'rgba(20,8,40,0.32)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    return layout;
  }

  global.NeonCover = {
    SIZES: SIZES,
    GRADES: GRADES,
    LAYOUTS: LAYOUTS,
    sizeById: sizeById,
    gradeById: gradeById,
    layoutById: layoutById,
    layoutPanels: layoutPanels,
    drawCover: drawCover,
    TITLE_FRACTION: TITLE_FRACTION,
  };
})(window);
