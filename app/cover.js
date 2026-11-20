/* Neon Sunset Cover Studio — cover engine.
 * Draws GTA-poster-style multi-panel cover art onto any 2D canvas:
 * six panel layouts, five sunset/neon colour grades, a retro slit-sun
 * title band with palm silhouettes, gradient display lettering, a
 * five-star heat meter and a city badge. Everything is drawn in code
 * from the photos the user loads; the render is deterministic — the
 * same state always paints the same pixels.
 */
'use strict';

(function (global) {
  var COVER = {};

  /* ------------------------------------------------------------ sizes */

  /** The three post sizes the app exports, in pixels. */
  COVER.SIZES = {
    landscape: { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
    square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
    portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  };

  /* ---------------------------------------------------------- layouts */

  /** Panel counts per layout, in load order. */
  COVER.LAYOUTS = [
    { id: 'vice-grid', name: 'Vice Grid', blurb: 'Nine-panel poster grid', panels: 9 },
    { id: 'hero-three', name: 'Hero + Three', blurb: 'One hero shot, three beside it', panels: 4 },
    { id: 'full-bleed', name: 'Full Bleed', blurb: 'One photo edge to edge', panels: 1 },
    { id: 'split-duo', name: 'Split Duo', blurb: 'Two halves, one story', panels: 2 },
    { id: 'tilted-snaps', name: 'Tilted Snaps', blurb: 'Three tilted polaroids', panels: 3 },
    { id: 'story-columns', name: 'Story Columns', blurb: 'Three tall columns', panels: 3 },
  ];

  COVER.panelCount = function (layoutId) {
    for (var i = 0; i < COVER.LAYOUTS.length; i++) {
      if (COVER.LAYOUTS[i].id === layoutId) return COVER.LAYOUTS[i].panels;
    }
    return 9;
  };

  /**
   * Geometry for a layout at a canvas of W x H.
   * Returns { panels, band, overlay } where panels are rects in pixels
   * ({x, y, w, h, tilt, caption}) and band is the title band rect, or
   * null when the layout carries no band. overlay means the band sits
   * on top of the panels with a scrim instead of below them.
   */
  COVER.layoutGeometry = function (layoutId, W, H) {
    var gap = Math.max(4, Math.round(Math.min(W, H) * 0.012));
    var bandH = Math.round(H * (H > W ? 0.2 : 0.24));
    var topH = H - bandH;
    var panels = [];
    var band = { x: 0, y: topH, w: W, h: bandH };
    var overlay = false;

    function grid(cols, rows, x, y, w, h) {
      var cw = (w - gap * (cols - 1)) / cols;
      var ch = (h - gap * (rows - 1)) / rows;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          panels.push({
            x: x + c * (cw + gap), y: y + r * (ch + gap),
            w: cw, h: ch, tilt: 0, caption: '',
          });
        }
      }
    }

    if (layoutId === 'vice-grid') {
      grid(3, 3, gap, gap, W - gap * 2, topH - gap * 2);
    } else if (layoutId === 'hero-three') {
      var heroW = Math.round((W - gap * 3) * 0.6);
      var sideX = gap + heroW + gap;
      var sideW = W - gap - sideX;
      panels.push({ x: gap, y: gap, w: heroW, h: topH - gap * 2, tilt: 0, caption: '' });
      var sh = (topH - gap * 4) / 3;
      for (var i = 0; i < 3; i++) {
        panels.push({ x: sideX, y: gap + i * (sh + gap), w: sideW, h: sh, tilt: 0, caption: '' });
      }
    } else if (layoutId === 'full-bleed') {
      panels.push({ x: 0, y: 0, w: W, h: H, tilt: 0, caption: '' });
      band = { x: 0, y: Math.round(H * 0.74), w: W, h: H - Math.round(H * 0.74) };
      overlay = true;
    } else if (layoutId === 'split-duo') {
      var half = (W - gap * 3) / 2;
      panels.push({ x: gap, y: gap, w: half, h: topH - gap * 2, tilt: 0, caption: '' });
      panels.push({ x: gap * 2 + half, y: gap, w: half, h: topH - gap * 2, tilt: 0, caption: '' });
    } else if (layoutId === 'tilted-snaps') {
      var cardW = Math.round(W * 0.3);
      var cardH = Math.round(cardW * 1.22);
      var cy = Math.round((topH - cardH) / 2);
      var tilts = [-7, 2, 6];
      var centres = [0.22, 0.5, 0.78];
      for (var k = 0; k < 3; k++) {
        panels.push({
          x: Math.round(W * centres[k] - cardW / 2), y: cy,
          w: cardW, h: cardH, tilt: tilts[k], caption: '',
        });
      }
    } else if (layoutId === 'story-columns') {
      var colW = (W - gap * 4) / 3;
      for (var j = 0; j < 3; j++) {
        panels.push({ x: gap + j * (colW + gap), y: 0, w: colW, h: H, tilt: 0, caption: '' });
      }
      band = { x: 0, y: Math.round(H * 0.76), w: W, h: H - Math.round(H * 0.76) };
      overlay = true;
    } else {
      grid(3, 3, gap, gap, W - gap * 2, topH - gap * 2);
    }
    return { panels: panels, band: band, overlay: overlay, gap: gap };
  };

  /* ----------------------------------------------------------- grades */

  /** Colour grades: a canvas filter plus a tint wash. */
  COVER.GRADES = {
    'vice-sunset': {
      name: 'Vice Sunset', filter: 'saturate(1.35) contrast(1.12) brightness(1.04) sepia(0.18)',
      tint: ['#ff9a3d', '#ff2e88'], blend: 'soft-light', alpha: 0.42,
    },
    'neon-nights': {
      name: 'Neon Nights', filter: 'saturate(1.5) contrast(1.18) brightness(0.96) hue-rotate(-12deg)',
      tint: ['#ff2e88', '#22d3ee'], blend: 'overlay', alpha: 0.34,
    },
    'golden-hour': {
      name: 'Golden Hour', filter: 'saturate(1.3) contrast(1.08) brightness(1.08) sepia(0.28)',
      tint: ['#ffd166', '#ff7b2f'], blend: 'soft-light', alpha: 0.46,
    },
    'hot-pink': {
      name: 'Hot Pink', filter: 'saturate(1.6) contrast(1.15) brightness(1.0) hue-rotate(18deg)',
      tint: ['#ff5ea8', '#b537f2'], blend: 'overlay', alpha: 0.38,
    },
    'teal-noir': {
      name: 'Teal Noir', filter: 'saturate(0.9) contrast(1.22) brightness(0.92)',
      tint: ['#2dd4bf', '#1e3a8a'], blend: 'soft-light', alpha: 0.44,
    },
  };
  COVER.GRADE_IDS = ['vice-sunset', 'neon-nights', 'golden-hour', 'hot-pink', 'teal-noir'];

  /* ------------------------------------------------------- determinism */

  /** FNV-1a hash of a string, for seeding the grain. */
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Mulberry32: a tiny seeded PRNG, so grain never flickers between runs. */
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

  /* ------------------------------------------------------------ panels */

  /**
   * Default per-panel settings for a layout: photos cycle through the
   * loaded set, wide panels start cropped a touch high so faces stay
   * in frame, tall panels stay centred.
   */
  COVER.defaultPanels = function (layoutId, photoCount) {
    var n = COVER.panelCount(layoutId);
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ photo: photoCount > 0 ? i % photoCount : 0, zoom: 1, ox: 0, oy: 0 });
    }
    return out;
  };

  /** Cover-fit a photo into a rect, honouring zoom and pan offsets. */
  function drawPhotoIn(ctx, img, rect, pan, grade) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var zoom = pan.zoom || 1;
    var scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2 + (pan.ox || 0) * rect.w;
    var dy = rect.y + (rect.h - dh) / 2 + (pan.oy || 0) * rect.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    var tint = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    tint.addColorStop(0, grade.tint[0]);
    tint.addColorStop(1, grade.tint[1]);
    ctx.globalCompositeOperation = grade.blend;
    ctx.globalAlpha = grade.alpha;
    ctx.fillStyle = tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /** A flat sunset placeholder when a panel has no photo yet. */
  function drawEmptyPanel(ctx, rect, grade) {
    var g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, '#3b1155');
    g.addColorStop(0.55, '#c22a6d');
    g.addColorStop(1, '#ff7b2f');
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = Math.max(12, Math.round(rect.h * 0.09)) + 'px Anton, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /** A tilted polaroid card: white frame, photo, caption strip. */
  function drawPolaroid(ctx, rect, photo, pan, grade, caption) {
    var frame = Math.max(6, Math.round(rect.w * 0.045));
    var stripH = Math.max(18, Math.round(rect.h * 0.16));
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.tilt * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    ctx.shadowColor = 'rgba(10, 2, 24, 0.55)';
    ctx.shadowBlur = Math.round(rect.w * 0.06);
    ctx.shadowOffsetY = Math.round(rect.w * 0.03);
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.shadowColor = 'transparent';
    var inner = { x: frame, y: frame, w: rect.w - frame * 2, h: rect.h - frame * 2 - stripH };
    if (photo) drawPhotoIn(ctx, photo, inner, pan, grade);
    else drawEmptyPanel(ctx, inner, grade);
    if (caption) {
      ctx.fillStyle = '#2b2b3a';
      ctx.font = Math.max(13, Math.round(stripH * 0.52)) + 'px Pacifico, cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption, rect.w / 2, rect.h - stripH / 2, rect.w - frame * 2);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------- title band */

  /** A five-pointed star path centred at (cx, cy) with radius r. */
  function starPath(ctx, cx, cy, r) {
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
  }

  /** Retro sun: a disc sliced into horizontal bands, gaps widening low. */
  function drawSlitSun(ctx, cx, cy, r, top, bottom) {
    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.save();
    ctx.fillStyle = g;
    var slices = 14;
    for (var i = 0; i < slices; i++) {
      var y0 = cy - r + (2 * r * i) / slices;
      var y1 = cy - r + (2 * r * (i + 1)) / slices;
      var mid = (y0 + y1) / 2;
      var half = Math.sqrt(Math.max(0, r * r - (mid - cy) * (mid - cy)));
      var cut = i < slices / 2 ? 0 : (i - slices / 2) * ((2 * r) / slices) * 0.16;
      ctx.fillRect(cx - half, y0, half * 2, Math.max(0.5, y1 - y0 - cut));
    }
    ctx.restore();
  }

  /** A hand-drawn palm silhouette: curved trunk, drooping fronds. */
  function drawPalm(ctx, x, y, s, color, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * 14, -52, lean * 26, -96);
    ctx.stroke();
    var cx = lean * 26;
    var cy = -96;
    for (var f = 0; f < 7; f++) {
      var a = -Math.PI * (0.08 + (f / 6) * 0.84);
      var len = 52 - Math.abs(f - 3) * 7;
      var ex = cx + Math.cos(a) * len;
      var ey = cy + Math.sin(a) * len * 0.55 + 16;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.4 - 6, ex, ey);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Shrink a font until text fits maxW; returns the fitted size. */
  function fitFont(ctx, text, maxW, start, family, weight) {
    var size = start;
    ctx.font = weight + ' ' + size + 'px ' + family;
    while (size > 10 && ctx.measureText(text).width > maxW) {
      size -= 2;
      ctx.font = weight + ' ' + size + 'px ' + family;
    }
    return size;
  }

  /** The title band: slit sun, palms, gradient title, neon subtitle, stars, badge. */
  function drawTitleBand(ctx, band, state, W) {
    var x = band.x;
    var y = band.y;
    var w = band.w;
    var h = band.h;
    var pad = Math.max(14, Math.round(h * 0.16));

    var bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#241040');
    bg.addColorStop(0.55, '#1a0a30');
    bg.addColorStop(1, '#12041f');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    var rule = ctx.createLinearGradient(x, 0, x + w, 0);
    rule.addColorStop(0, '#ffd319');
    rule.addColorStop(0.5, '#ff2e88');
    rule.addColorStop(1, '#22d3ee');
    ctx.fillStyle = rule;
    ctx.fillRect(x, y, w, Math.max(3, Math.round(h * 0.03)));

    var sunR = Math.round(h * 0.52);
    var sunCx = Math.round(x + w - sunR * 1.15);
    var sunCy = Math.round(y + h * 0.46);
    drawSlitSun(ctx, sunCx, sunCy, sunR, '#ffd319', '#ff2e88');

    drawPalm(ctx, x + pad * 0.4, y + h - 2, h / 130, '#0d0218', 1);
    drawPalm(ctx, x + w - pad * 0.5, y + h - 2, h / 170, '#0d0218', -1);

    var title = (state.title || 'NEON SHORE').toUpperCase();
    var titleMaxW = Math.round(w * 0.62);
    var titleSize = fitFont(ctx, title, titleMaxW, Math.round(h * 0.5), 'Anton, sans-serif', '400');
    var titleGrad = ctx.createLinearGradient(0, y + h * 0.14, 0, y + h * 0.72);
    titleGrad.addColorStop(0, '#fff3b0');
    titleGrad.addColorStop(0.45, '#ffd319');
    titleGrad.addColorStop(0.75, '#ff7b2f');
    titleGrad.addColorStop(1, '#ff2e88');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14041f';
    ctx.lineWidth = Math.max(2, Math.round(titleSize * 0.09));
    var titleX = x + pad * 2.1;
    var titleY = y + h * 0.52;
    ctx.strokeText(title, titleX, titleY);
    ctx.fillStyle = titleGrad;
    ctx.fillText(title, titleX, titleY);

    var sub = state.subtitle || '';
    if (sub) {
      var subSize = fitFont(ctx, sub, Math.round(w * 0.5), Math.round(h * 0.2), 'Pacifico, cursive', '400');
      ctx.font = '400 ' + subSize + 'px Pacifico, cursive';
      ctx.fillStyle = '#7ef9ff';
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = Math.round(h * 0.09);
      ctx.fillText(sub, titleX, y + h * 0.86);
      ctx.shadowBlur = 0;
    }

    var starR = Math.max(7, Math.round(h * 0.085));
    var starsW = starR * 2 * 5 + starR * 4 * 0.6;
    var starsX = Math.round(x + w - pad - starsW);
    var starsY = Math.round(y + h * 0.82);
    ctx.font = '400 ' + Math.round(h * 0.11) + 'px Anton, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('HEAT', starsX, starsY - starR - Math.round(h * 0.05));
    for (var s = 0; s < 5; s++) {
      var sx = starsX + starR + s * (starR * 2 + starR * 0.6);
      starPath(ctx, sx, starsY, starR);
      if (s < (state.heat || 0)) {
        ctx.fillStyle = '#ffd319';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1.5, starR * 0.12);
        ctx.stroke();
      }
    }

    var badgeText = state.badge || 'Sunset City • Est. 2026';
    var badgeSize = Math.max(11, Math.round(h * 0.13));
    ctx.font = '400 ' + badgeSize + 'px Anton, sans-serif';
    var badgeW = ctx.measureText(badgeText).width + pad * 1.6;
    var badgeH = Math.round(h * 0.24);
    var badgeX = Math.round(x + w - pad - badgeW);
    var badgeY = Math.round(y + pad * 0.9);
    ctx.fillStyle = 'rgba(255,46,136,0.16)';
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(1.5, h * 0.012);
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9f4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------------------------------------------------------- grain */

  /** Seeded film grain plus a vignette, identical for identical state. */
  function drawGrainAndVignette(ctx, W, H, state) {
    var seed = hashString([state.layout, state.grade, state.title, state.subtitle, W, H].join('|'));
    var rnd = mulberry32(seed);
    var count = Math.min(12000, Math.floor((W * H) / 1600));
    ctx.save();
    for (var i = 0; i < count; i++) {
      var v = rnd();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1.4, 1.4);
    }
    ctx.restore();
    var vg = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.72
    );
    vg.addColorStop(0, 'rgba(8,2,18,0)');
    vg.addColorStop(1, 'rgba(8,2,18,0.3)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------ render */

  /**
   * Paint the whole cover onto ctx at W x H.
   * state: { layout, grade, title, subtitle, heat, badge,
   *          photos: [{img, label}], panels: [{photo, zoom, ox, oy}] }
   */
  COVER.drawCover = function (ctx, W, H, state) {
    var layoutId = state.layout || 'vice-grid';
    var grade = COVER.GRADES[state.grade] || COVER.GRADES['vice-sunset'];
    var geo = COVER.layoutGeometry(layoutId, W, H);
    var photos = state.photos || [];
    var panels = state.panels || COVER.defaultPanels(layoutId, photos.length);

    if (layoutId === 'tilted-snaps') {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2b0f54');
      sky.addColorStop(0.5, '#8a1d63');
      sky.addColorStop(1, '#ff7b2f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      drawSlitSun(ctx, Math.round(W * 0.5), Math.round(H * 0.3), Math.round(Math.min(W, H) * 0.16), '#ffe66d', '#ff5e78');
    } else {
      ctx.fillStyle = '#12041f';
      ctx.fillRect(0, 0, W, H);
    }

    if (geo.overlay) {
      geo.panels.forEach(function (rect, i) {
        var pan = panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
        var photo = photos[pan.photo] ? photos[pan.photo].img : null;
        if (photo) drawPhotoIn(ctx, photo, rect, pan, grade);
        else drawEmptyPanel(ctx, rect, grade);
      });
      var scrim = ctx.createLinearGradient(0, geo.band.y - geo.band.h * 0.7, 0, H);
      scrim.addColorStop(0, 'rgba(18,4,31,0)');
      scrim.addColorStop(1, 'rgba(18,4,31,0.88)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, geo.band.y - geo.band.h * 0.7, W, geo.band.h * 1.7);
    } else {
      geo.panels.forEach(function (rect, i) {
        var pan = panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
        var photo = photos[pan.photo] ? photos[pan.photo].img : null;
        if (layoutId === 'tilted-snaps') {
          var caption = photo && photos[pan.photo].label ? photos[pan.photo].label : '';
          drawPolaroid(ctx, rect, photo, pan, grade, caption);
        } else {
          if (photo) drawPhotoIn(ctx, photo, rect, pan, grade);
          else drawEmptyPanel(ctx, rect, grade);
          ctx.strokeStyle = 'rgba(253,248,239,0.95)';
          ctx.lineWidth = Math.max(2, geo.gap * 0.5);
          ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        }
      });
    }

    drawTitleBand(ctx, geo.band, state, W);
    drawGrainAndVignette(ctx, W, H, state);
  };

  /** Default cover state, before any photo is loaded. */
  COVER.defaultState = function () {
    return {
      layout: 'vice-grid',
      grade: 'vice-sunset',
      title: 'NEON SHORE',
      subtitle: 'chase the sunset',
      heat: 4,
      badge: 'Sunset City • Est. 2026',
      photos: [],
      panels: COVER.defaultPanels('vice-grid', 0),
    };
  };

  global.CoverArt = COVER;
})(typeof window !== 'undefined' ? window : globalThis);
