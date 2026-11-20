'use strict';
/*
 * Neon Sunset Cover Studio — cover render engine.
 *
 * Pure canvas drawing: no network, no DOM input, no randomness outside a
 * fixed seed, so the same state always draws the same pixels. The editor
 * (editor.js) owns state and photos; this file only draws.
 *
 * Layout: a title band across the top (~20% of the height) split into three
 * zones that never overlap — retro sun + palms on the left, title and
 * subtitle in the middle, badge ribbon + star heat meter on the right —
 * and a panel area below it holding 1–4 photo panels.
 *
 * Photos are drawn cover-fit with a focal point. The default focal height
 * sits at face height (fy 0.2) and wide panels get an extra upward lift so
 * faces stay in frame; the lift switches off the moment the user pans or
 * zooms a panel by hand.
 */

var CoverStudio = (function () {
  // ---------------------------------------------------------------- data

  // Panel rects are fractions of the art area (the canvas below the band).
  // tilt is degrees, used by the polaroid layout only.
  var LAYOUTS = {
    'vice-grid': {
      label: 'Vice Grid',
      panels: [
        { x: 0.02, y: 0.03, w: 0.47, h: 0.45 },
        { x: 0.51, y: 0.03, w: 0.47, h: 0.45 },
        { x: 0.02, y: 0.52, w: 0.47, h: 0.45 },
        { x: 0.51, y: 0.52, w: 0.47, h: 0.45 }
      ]
    },
    'hero-three': {
      label: 'Hero Three',
      panels: [
        { x: 0.02, y: 0.03, w: 0.60, h: 0.94 },
        { x: 0.64, y: 0.03, w: 0.34, h: 0.45 },
        { x: 0.64, y: 0.52, w: 0.34, h: 0.45 }
      ]
    },
    'tilted-snaps': {
      label: 'Tilted Snaps',
      polaroid: true,
      panels: [
        { x: 0.04, y: 0.10, w: 0.40, h: 0.70, tilt: -4 },
        { x: 0.30, y: 0.06, w: 0.40, h: 0.70, tilt: 2 },
        { x: 0.56, y: 0.12, w: 0.40, h: 0.70, tilt: 5 }
      ]
    },
    'duo-split': {
      label: 'Duo Split',
      panels: [
        { x: 0.02, y: 0.03, w: 0.47, h: 0.94 },
        { x: 0.51, y: 0.03, w: 0.47, h: 0.94 }
      ]
    },
    'single-hero': {
      label: 'Single Hero',
      panels: [
        { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }
      ]
    },
    'film-strip': {
      label: 'Film Strip',
      panels: [
        { x: 0.02, y: 0.03, w: 0.96, h: 0.58 },
        { x: 0.02, y: 0.65, w: 0.31, h: 0.32 },
        { x: 0.345, y: 0.65, w: 0.31, h: 0.32 },
        { x: 0.67, y: 0.65, w: 0.31, h: 0.32 }
      ]
    }
  };

  // One grade = one sunset. sky paints the band, wash tints the photos,
  // sun/glow light the title band, frame edges the panels.
  var GRADES = {
    'vice-sunset': {
      label: 'Vice Sunset',
      skyTop: '#2b0a4a', skyBottom: '#ff7e5f',
      sun: '#ffd166', glow: '#ff5e8a',
      title: '#ffe9f3', subtitle: '#ffd166',
      washTop: 'rgba(255, 94, 138, 0.16)', washBottom: 'rgba(255, 126, 95, 0.10)',
      frame: '#ff5e8a', bandLine: '#ffd166'
    },
    'neon-nights': {
      label: 'Neon Nights',
      skyTop: '#0b0620', skyBottom: '#7b2ff7',
      sun: '#22d3ee', glow: '#e879f9',
      title: '#eafcff', subtitle: '#22d3ee',
      washTop: 'rgba(123, 47, 247, 0.20)', washBottom: 'rgba(34, 211, 238, 0.10)',
      frame: '#22d3ee', bandLine: '#e879f9'
    },
    'golden-hour': {
      label: 'Golden Hour',
      skyTop: '#3d1c02', skyBottom: '#f5a623',
      sun: '#fff3b0', glow: '#ff8c42',
      title: '#fff8e1', subtitle: '#ffe08a',
      washTop: 'rgba(245, 166, 35, 0.16)', washBottom: 'rgba(255, 140, 66, 0.10)',
      frame: '#f5a623', bandLine: '#fff3b0'
    },
    'hot-pink': {
      label: 'Hot Pink',
      skyTop: '#2a0033', skyBottom: '#ff2e88',
      sun: '#ff9ecf', glow: '#ff2e88',
      title: '#fff0f7', subtitle: '#ff9ecf',
      washTop: 'rgba(255, 46, 136, 0.20)', washBottom: 'rgba(255, 158, 207, 0.10)',
      frame: '#ff2e88', bandLine: '#ff9ecf'
    },
    'miami-dawn': {
      label: 'Miami Dawn',
      skyTop: '#062a33', skyBottom: '#ff9e7d',
      sun: '#ffe66d', glow: '#2ec4b6',
      title: '#f2ffff', subtitle: '#ffe66d',
      washTop: 'rgba(46, 196, 182, 0.14)', washBottom: 'rgba(255, 158, 125, 0.12)',
      frame: '#2ec4b6', bandLine: '#ffe66d'
    }
  };

  var SIZES = {
    '1920x1080': [1920, 1080],
    '1080x1080': [1080, 1080],
    '1080x1350': [1080, 1350]
  };

  var BAND_FRACTION = 0.20; // title band share of the canvas height
  var GRAIN_SEED = 20261121; // fixed: every render grains identically
  var FACE_FY = 0.20; // default focal height — face height, not photo middle

  // ---------------------------------------------------------------- helpers

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Deterministic PRNG (mulberry32). Same seed, same specks, every render.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gradeFor(name) {
    return GRADES[name] || GRADES['vice-sunset'];
  }

  function layoutFor(name) {
    return LAYOUTS[name] || LAYOUTS['vice-grid'];
  }

  function defaultState() {
    return {
      layout: 'vice-grid',
      grade: 'vice-sunset',
      title: 'NEON SHORE',
      subtitle: 'Vice City',
      badge: 'VICE CITY',
      heat: 4,
      assign: 'mix', // 'mix' spreads photos across panels, 'one' fills all with one
      onePhoto: 0,
      panels: [
        { photo: 0, fx: 0.5, fy: FACE_FY, zoom: 1, touched: false },
        { photo: 1, fx: 0.5, fy: FACE_FY, zoom: 1, touched: false },
        { photo: 0, fx: 0.5, fy: FACE_FY, zoom: 1, touched: false },
        { photo: 1, fx: 0.5, fy: FACE_FY, zoom: 1, touched: false }
      ]
    };
  }

  // Which photo index fills panel i under the current assignment mode.
  function photoIndexFor(state, i) {
    if (state.assign === 'one') return state.onePhoto || 0;
    var p = state.panels[i];
    return p && typeof p.photo === 'number' ? p.photo : i % 2;
  }

  // Cover-fit source rect for a photo inside a panel, with the face lift:
  // wide panels shift the crop window upward (toward faces) unless the user
  // has panned or zoomed that panel by hand.
  function panelSourceRect(img, panel, pw, ph) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var z = panel.zoom && panel.zoom > 0 ? panel.zoom : 1;
    var s = Math.max(pw / iw, ph / ih) * z;
    var sw = pw / s;
    var sh = ph / s;
    var fx = panel.fx == null ? 0.5 : panel.fx;
    var fy = panel.fy == null ? FACE_FY : panel.fy;
    var aspect = pw / ph;
    var lift = panel.touched ? 0
      : aspect > 2.0 ? 0.55
      : aspect > 1.4 ? 0.35
      : aspect > 1.0 ? 0.15 : 0;
    var sx = fx * iw - sw / 2;
    var sy = fy * ih - sh / 2 - lift * sh * 0.45;
    sx = clamp(sx, 0, Math.max(0, iw - sw));
    sy = clamp(sy, 0, Math.max(0, ih - sh));
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  // Shrink a font until the text fits maxWidth. Returns the fitted size.
  function fitFont(ctx, text, maxWidth, startSize, family, weight) {
    var size = startSize;
    while (size > 12) {
      ctx.font = (weight ? weight + ' ' : '') + size + 'px "' + family + '"';
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  // ------------------------------------------------------------ band pieces

  // Retro sun: a disc with horizontal slits that widen toward the bottom.
  function drawRetroSun(ctx, cx, cy, r, color, bandBg) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bandBg;
    var slits = 5;
    for (var i = 0; i < slits; i++) {
      var y = cy + (r * 0.15) + (i * r * 0.16);
      var h = 2 + i * (r * 0.035);
      var half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
      ctx.fillRect(cx - half, y, half * 2, h);
    }
    ctx.restore();
  }

  // Hand-drawn palm silhouette: curved trunk, five drooping fronds.
  function drawPalm(ctx, x, y, s, flip, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Trunk, leaning gently.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(6, -34, 16, -62);
    ctx.stroke();
    // Fronds fanning from the crown.
    var fronds = [
      [-52, -66, -30, -92, -8, -72],
      [-46, -58, -58, -84, -34, -60],
      [-10, -88, 4, -104, 18, -84],
      [30, -84, 52, -92, 58, -66],
      [38, -62, 58, -70, 52, -48]
    ];
    for (var i = 0; i < fronds.length; i++) {
      var f = fronds[i];
      ctx.beginPath();
      ctx.moveTo(16, -62);
      ctx.quadraticCurveTo(f[0], f[1], f[2], f[3]);
      ctx.quadraticCurveTo(f[4], f[5], 16, -62);
      ctx.fill();
    }
    ctx.restore();
  }

  // Five-star heat meter; `heat` stars filled, the rest outlined.
  function drawStarMeter(ctx, x, y, w, heat, color) {
    var n = 5;
    var gap = w / n;
    var r = Math.min(gap * 0.36, 14 * (w / 200 + 0.4));
    for (var i = 0; i < n; i++) {
      var cx = x + gap * (i + 0.5);
      drawStar(ctx, cx, y, r, i < heat, color);
    }
  }

  function drawStar(ctx, cx, cy, r, filled, color) {
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var px = cx + Math.cos(ang) * rad;
      var py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ribbon with folded ends and centred text.
  function drawBadgeRibbon(ctx, x, y, w, h, text, grade) {
    var notch = h * 0.28;
    ctx.save();
    ctx.fillStyle = grade.frame;
    ctx.beginPath();
    ctx.moveTo(x + notch, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - notch, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + notch, y);
    ctx.lineTo(x + notch, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var size = fitFont(ctx, text, w - notch * 2 - 8, h * 0.52, 'Bebas Neue', '400');
    ctx.font = '400 ' + size + 'px "Bebas Neue"';
    ctx.fillText(text, x + w / 2 + notch * 0.3, y + h / 2 + 1);
    ctx.restore();
  }

  // ------------------------------------------------------------ title band

  function drawTitleBand(ctx, state, grade, W, H) {
    var bandH = H * BAND_FRACTION;
    // Band background: sky gradient of the grade.
    var sky = ctx.createLinearGradient(0, 0, 0, bandH);
    sky.addColorStop(0, grade.skyTop);
    sky.addColorStop(1, grade.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, bandH);
    // Soft glow behind the centre.
    var glow = ctx.createRadialGradient(W * 0.5, bandH * 0.5, 0, W * 0.5, bandH * 0.5, W * 0.45);
    glow.addColorStop(0, grade.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, bandH);
    ctx.globalAlpha = 1;

    // Zone dividers are invisible — the zones just never overlap:
    // left 0–28% sun + palms, centre 28–72% title, right 72–100% badge + stars.
    var leftEnd = W * 0.28;
    var rightStart = W * 0.72;

    // Left zone: retro sun, palms at both edges.
    var sunR = bandH * 0.42;
    var sunCx = leftEnd * 0.52;
    var sunCy = bandH * 0.56;
    drawRetroSun(ctx, sunCx, sunCy, sunR, grade.sun, grade.skyBottom);
    drawPalm(ctx, W * 0.015, bandH * 0.98, bandH / 110, false, 'rgba(20,4,32,0.9)');
    drawPalm(ctx, leftEnd - W * 0.015, bandH * 0.98, bandH / 130, true, 'rgba(20,4,32,0.85)');

    // Centre zone: title + subtitle, shrunk to fit.
    var cx = (leftEnd + rightStart) / 2;
    var zoneW = rightStart - leftEnd - W * 0.02;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var titleSize = fitFont(ctx, state.title, zoneW, bandH * 0.58, 'Bebas Neue', '400');
    ctx.font = '400 ' + titleSize + 'px "Bebas Neue"';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(state.title, cx + 3, bandH * 0.36 + 3);
    ctx.fillStyle = grade.title;
    ctx.fillText(state.title, cx, bandH * 0.36);
    var subSize = fitFont(ctx, state.subtitle, zoneW, bandH * 0.26, 'Caveat', '700');
    ctx.font = '700 ' + subSize + 'px "Caveat"';
    ctx.fillStyle = grade.subtitle;
    ctx.fillText(state.subtitle, cx, bandH * 0.78);

    // Right zone: badge ribbon on top, star meter below.
    var rx = rightStart + W * 0.015;
    var rw = W - rightStart - W * 0.03;
    var ribbonH = bandH * 0.34;
    drawBadgeRibbon(ctx, rx, bandH * 0.10, rw, ribbonH, state.badge, grade);
    drawStarMeter(ctx, rx, bandH * 0.72, rw, state.heat || 0, grade.subtitle);

    // Neon divider line under the band.
    ctx.fillStyle = grade.bandLine;
    ctx.fillRect(0, bandH - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));
  }

  // ------------------------------------------------------------ photo panels

  function drawPhotoPanel(ctx, img, panel, px, py, pw, ph, grade, label) {
    if (!img) return;
    var src = panelSourceRect(img, panel, pw, ph);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, px, py, pw, ph);
    // Grade wash: a translucent sunset tint over the photo.
    var wash = ctx.createLinearGradient(px, py, px, py + ph);
    wash.addColorStop(0, grade.washTop);
    wash.addColorStop(1, grade.washBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
    // Thin neon frame.
    ctx.strokeStyle = grade.frame;
    ctx.lineWidth = Math.max(2, pw * 0.006);
    ctx.strokeRect(px, py, pw, ph);
  }

  // Polaroid card: white border, photo inside, caption strip at the bottom
  // sized inside the art area so it never spills past the card.
  function drawPolaroid(ctx, img, panel, px, py, pw, ph, grade, label, tilt) {
    var stripH = ph * 0.16;
    var pad = pw * 0.045;
    var cx = px + pw / 2;
    var cy = py + ph / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((tilt || 0) * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = pw * 0.06;
    ctx.shadowOffsetY = pw * 0.02;
    ctx.fillStyle = '#fdf8f2';
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowColor = 'transparent';
    var ix = -pw / 2 + pad;
    var iy = -ph / 2 + pad;
    var iw = pw - pad * 2;
    var ih = ph - stripH - pad * 1.6;
    if (img) {
      var src = panelSourceRect(img, panel, iw, ih);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, ix, iy, iw, ih);
      var wash = ctx.createLinearGradient(ix, iy, ix, iy + ih);
      wash.addColorStop(0, grade.washTop);
      wash.addColorStop(1, grade.washBottom);
      ctx.fillStyle = wash;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.restore();
    }
    // Caption inside the strip, fitted so it cannot overflow the card.
    ctx.fillStyle = '#221a2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cap = label || '';
    if (cap) {
      var size = fitFont(ctx, cap, pw - pad * 3, stripH * 0.62, 'Caveat', '700');
      ctx.font = '700 ' + size + 'px "Caveat"';
      ctx.fillText(cap, 0, ph / 2 - stripH / 2);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ grain + vignette

  function applyGrain(ctx, W, H) {
    var rand = mulberry32(GRAIN_SEED);
    var count = Math.floor((W * H) / 1400);
    ctx.save();
    for (var i = 0; i < count; i++) {
      var v = rand();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
    }
    ctx.restore();
  }

  function applyVignette(ctx, W, H) {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------ main entry

  function drawCover(canvas, state, photos) {
    var W = canvas.width;
    var H = canvas.height;
    var ctx = canvas.getContext('2d');
    var grade = gradeFor(state.grade);
    var layout = layoutFor(state.layout);
    var bandH = H * BAND_FRACTION;

    // Deep backdrop: the grade's night sky fills every gap.
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, grade.skyTop);
    bg.addColorStop(1, '#12041f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawTitleBand(ctx, state, grade, W, H);

    // Art area below the band.
    var ax = 0;
    var ay = bandH;
    var aw = W;
    var ah = H - bandH;

    for (var i = 0; i < layout.panels.length; i++) {
      var def = layout.panels[i];
      var panel = state.panels[i] || { photo: i, fx: 0.5, fy: FACE_FY, zoom: 1, touched: false };
      var px = ax + def.x * aw;
      var py = ay + def.y * ah;
      var pw = def.w * aw;
      var ph = def.h * ah;
      var photoIdx = photoIndexFor(state, i);
      var photo = photos && photos[photoIdx];
      var img = photo && photo.img ? photo.img : null;
      var label = photo && photo.label ? photo.label : '';
      if (layout.polaroid) {
        drawPolaroid(ctx, img, panel, px, py, pw, ph, grade, label, def.tilt || 0);
      } else {
        drawPhotoPanel(ctx, img, panel, px, py, pw, ph, grade, label);
      }
    }

    applyGrain(ctx, W, H);
    applyVignette(ctx, W, H);
    return canvas;
  }

  return {
    LAYOUTS: LAYOUTS,
    GRADES: GRADES,
    SIZES: SIZES,
    BAND_FRACTION: BAND_FRACTION,
    FACE_FY: FACE_FY,
    defaultState: defaultState,
    layoutFor: layoutFor,
    gradeFor: gradeFor,
    photoIndexFor: photoIndexFor,
    drawCover: drawCover
  };
})();
