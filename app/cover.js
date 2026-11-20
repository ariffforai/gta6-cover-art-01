// Neon Sunset Cover Studio — cover render engine.
// Draws GTA-style multi-panel cover art on a 2D canvas: six layouts, five sunset
// grades, a retro-sun title band with hand-drawn palm silhouettes, a star heat
// meter, a badge ribbon, deterministic grain and a vignette. No network, no
// libraries — plain canvas, so the exported PNG is exactly what the preview shows.

export const LAYOUTS = [
  { id: 'vice-grid', label: 'Vice Grid', panels: 4 },
  { id: 'hero-three', label: 'Hero Three', panels: 3 },
  { id: 'tilted-snaps', label: 'Tilted Snaps', panels: 3 },
  { id: 'film-strip', label: 'Film Strip', panels: 4 },
  { id: 'duo-split', label: 'Duo Split', panels: 2 },
  { id: 'solo-poster', label: 'Solo Poster', panels: 1 },
];

export const GRADES = [
  {
    id: 'vice-sunset', label: 'Vice Sunset',
    bgTop: '#2b1055', bgBottom: '#ff7e2e', sunTop: '#ffd319', sunBottom: '#ff2975',
    title: '#fff3d6', subtitle: '#ffd319', accent: '#ff2975', tint: '#ff5e78', palm: '#1a0b2e',
  },
  {
    id: 'neon-nights', label: 'Neon Nights',
    bgTop: '#0b1035', bgBottom: '#7b2ff7', sunTop: '#22e6ff', sunBottom: '#ff2fb3',
    title: '#eafcff', subtitle: '#22e6ff', accent: '#ff2fb3', tint: '#3a6cff', palm: '#070a24',
  },
  {
    id: 'golden-hour', label: 'Golden Hour',
    bgTop: '#3d1e0f', bgBottom: '#ffb347', sunTop: '#fff3a3', sunBottom: '#ff7b00',
    title: '#fff8e7', subtitle: '#ffd97a', accent: '#ff7b00', tint: '#ff9a3d', palm: '#241106',
  },
  {
    id: 'hot-pink', label: 'Hot Pink',
    bgTop: '#3b0a3d', bgBottom: '#ff4d8d', sunTop: '#ffe259', sunBottom: '#ff2e63',
    title: '#fff0f5', subtitle: '#ffe259', accent: '#ff2e63', tint: '#ff4d8d', palm: '#26052b',
  },
  {
    id: 'midnight-drive', label: 'Midnight Drive',
    bgTop: '#050914', bgBottom: '#123a6d', sunTop: '#9be7ff', sunBottom: '#2b6cff',
    title: '#eaf2ff', subtitle: '#9be7ff', accent: '#2b6cff', tint: '#2b6cff', palm: '#02040a',
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// Deterministic PRNG (mulberry32) — the grain looks the same on every export.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function starPath(ctx, cx, cy, rOuter, rInner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// A hand-drawn palm: a leaning trunk and six drooping fronds, all bezier curves.
// flip mirrors it; the slight wobble in the control points keeps it sketchy.
function drawPalm(ctx, x, y, s, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: leans right as it rises.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -46, 34, -88);
  ctx.stroke();
  // Fronds fan out from the crown at the top of the trunk.
  ctx.lineWidth = 5;
  const fronds = [
    [[34, -88], [-52, -118], [-96, -84]],
    [[34, -88], [-30, -128], [-58, -104]],
    [[34, -88], [2, -138], [-6, -112]],
    [[34, -88], [40, -132], [52, -104]],
    [[34, -88], [78, -112], [104, -76]],
    [[34, -88], [92, -84], [112, -52]],
  ];
  for (const [p0, p1, p2] of fronds) {
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
    ctx.stroke();
    // A couple of leaflets hanging off each frond.
    ctx.lineWidth = 2.5;
    const mx = (p0[0] + p2[0]) / 2, my = (p0[1] + p2[1]) / 2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(mx + 6, my + 14, mx + 2, my + 26);
    ctx.stroke();
    ctx.lineWidth = 5;
  }
  // Coconuts at the crown.
  ctx.beginPath(); ctx.arc(28, -84, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(40, -82, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Retro sun: a gradient disc with horizontal slits that widen toward the bottom.
function drawRetroSun(ctx, cx, cy, r, grade) {
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, grade.sunTop);
  g.addColorStop(1, grade.sunBottom);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Slits: cut the lower half into bands.
  ctx.fillStyle = grade.bgTop;
  let y = cy + r * 0.05;
  let h = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, h);
    y += h + r * 0.16;
    h *= 1.45;
  }
  ctx.restore();
}

function fitText(ctx, text, maxWidth, startPx, fontFace, weight) {
  let px = startPx;
  while (px > 10) {
    ctx.font = `${weight} ${px}px ${fontFace}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= 2;
  }
  return px;
}

// Panel rectangles inside the photo area. Returns [{x, y, w, h, rot, polaroid}].
export function panelRects(layoutId, area) {
  const { x, y, w, h } = area;
  const gap = Math.max(10, Math.round(Math.min(w, h) * 0.018));
  const wide = w >= h;
  switch (layoutId) {
    case 'vice-grid': {
      const cw = (w - gap) / 2, ch = (h - gap) / 2;
      return [
        { x, y, w: cw, h: ch, rot: 0, polaroid: false },
        { x: x + cw + gap, y, w: cw, h: ch, rot: 0, polaroid: false },
        { x, y: y + ch + gap, w: cw, h: ch, rot: 0, polaroid: false },
        { x: x + cw + gap, y: y + ch + gap, w: cw, h: ch, rot: 0, polaroid: false },
      ];
    }
    case 'hero-three': {
      const heroW = w * 0.62;
      const sideW = w - heroW - gap;
      const sideH = (h - gap) / 2;
      return [
        { x, y, w: heroW, h, rot: 0, polaroid: false },
        { x: x + heroW + gap, y, w: sideW, h: sideH, rot: 0, polaroid: false },
        { x: x + heroW + gap, y: y + sideH + gap, w: sideW, h: sideH, rot: 0, polaroid: false },
      ];
    }
    case 'tilted-snaps': {
      const pw = w * 0.32, ph = h * 0.86;
      const py = y + (h - ph) / 2;
      const step = (w - pw) / 2;
      return [
        { x: x + step * 0, y: py + 8, w: pw, h: ph, rot: -0.10, polaroid: true },
        { x: x + step * 1, y: py - 6, w: pw, h: ph, rot: 0.015, polaroid: true },
        { x: x + step * 2, y: py + 8, w: pw, h: ph, rot: 0.10, polaroid: true },
      ];
    }
    case 'film-strip': {
      if (wide) {
        const cw = (w - gap * 3) / 4;
        return [0, 1, 2, 3].map((i) => ({ x: x + i * (cw + gap), y, w: cw, h, rot: 0, polaroid: false, film: true }));
      }
      const cw = (w - gap) / 2, ch = (h - gap) / 2;
      return [
        { x, y, w: cw, h: ch, rot: 0, polaroid: false, film: true },
        { x: x + cw + gap, y, w: cw, h: ch, rot: 0, polaroid: false, film: true },
        { x, y: y + ch + gap, w: cw, h: ch, rot: 0, polaroid: false, film: true },
        { x: x + cw + gap, y: y + ch + gap, w: cw, h: ch, rot: 0, polaroid: false, film: true },
      ];
    }
    case 'duo-split': {
      if (wide) {
        const cw = (w - gap) / 2;
        return [
          { x, y, w: cw, h, rot: 0, polaroid: false },
          { x: x + cw + gap, y, w: cw, h, rot: 0, polaroid: false },
        ];
      }
      const ch = (h - gap) / 2;
      return [
        { x, y, w, h: ch, rot: 0, polaroid: false },
        { x, y: y + ch + gap, w, h: ch, rot: 0, polaroid: false },
      ];
    }
    case 'solo-poster':
    default:
      return [{ x, y, w, h, rot: 0, polaroid: false }];
  }
}

// Draw one photo into a rect with cover-fit.
// Wide-short panels lift the crop toward the top so faces stay in frame, unless
// the user has dragged or slid the photo themselves (photo.moved).
function drawPhoto(ctx, photo, rect) {
  const img = photo.img;
  if (!img || !img.naturalWidth) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const rectAspect = rect.w / rect.h;
  const imgAspect = iw / ih;
  const zoom = photo.zoom || 1;
  let sw, sh, sx, sy;
  if (imgAspect > rectAspect) {
    // Image wider than the panel: crop the sides.
    sh = ih;
    sw = ih * rectAspect / zoom;
    const spanX = iw - sw;
    sx = spanX * (0.5 + (photo.ox || 0) * 0.4);
    sy = 0;
  } else {
    // Image taller than the panel: crop top/bottom, lifted toward the faces.
    sw = iw;
    sh = iw / rectAspect / zoom;
    const spanY = ih - sh;
    let lift = 0;
    if (!photo.moved) {
      if (rectAspect > 2) lift = 0.55;
      else if (rectAspect > 1.6) lift = 0.35;
      else if (rectAspect > 1.25) lift = 0.15;
    }
    const centre = 0.5 + (photo.oy || 0) * 0.4 - lift * 0.5;
    sy = spanY * Math.min(0.98, Math.max(0.02, centre));
    sx = 0;
  }
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
  return true;
}

function drawPanel(ctx, photo, rect, grade, index) {
  ctx.save();
  if (rect.rot) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(rect.rot);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  } else {
    ctx.translate(rect.x, rect.y);
  }
  const w = rect.w, h = rect.h;
  // Drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(8, w * 0.03);
  ctx.shadowOffsetY = Math.max(4, h * 0.012);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const frame = rect.polaroid ? Math.max(8, w * 0.035) : Math.max(4, w * 0.008);
  const captionH = rect.polaroid ? Math.max(26, h * 0.11) : 0;
  const art = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 - captionH };

  ctx.save();
  ctx.beginPath();
  ctx.rect(art.x, art.y, art.w, art.h);
  ctx.clip();
  if (rect.polaroid) ctx.fillStyle = '#fff8ef'; else ctx.fillStyle = '#1b1030';
  ctx.fillRect(art.x, art.y, art.w, art.h);
  const drawn = photo ? drawPhoto(ctx, photo, art) : false;
  if (!drawn) {
    // Empty slot: a soft placeholder so the layout still reads.
    const g = ctx.createLinearGradient(art.x, art.y, art.x + art.w, art.y + art.h);
    g.addColorStop(0, grade.bgTop);
    g.addColorStop(1, grade.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(art.x, art.y, art.w, art.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.max(14, art.w * 0.05)}px "Archivo Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`PHOTO ${index + 1}`, art.x + art.w / 2, art.y + art.h / 2);
  }
  // Grade tint over the photo, kept light so faces stay readable.
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(art.x, art.y, art.w, art.h);
  ctx.globalAlpha = 1;
  // A gentle bottom shade so a caption can sit on the art if needed.
  const shade = ctx.createLinearGradient(0, art.y + art.h * 0.6, 0, art.y + art.h);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(art.x, art.y + art.h * 0.6, art.w, art.h * 0.4);
  ctx.restore();

  if (rect.polaroid) {
    // White polaroid frame + caption strip; the caption is left-aligned and
    // sized to live inside the art area, never over the photo.
    ctx.fillStyle = '#fff8ef';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(art.x, art.y, art.w, art.h);
    ctx.clip();
    if (photo) drawPhoto(ctx, photo, art);
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = grade.tint;
    ctx.fillRect(art.x, art.y, art.w, art.h);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(art.x + 0.5, art.y + 0.5, art.w - 1, art.h - 1);
    if (photo && photo.label) {
      const capPx = Math.max(13, Math.min(captionH * 0.52, w * 0.075));
      ctx.font = `700 ${capPx}px "Dancing Script", cursive`;
      ctx.fillStyle = '#222';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(photo.label, frame + 4, h - captionH / 2 + 1, w - frame * 2 - 8);
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(3, w * 0.008);
    ctx.strokeRect(art.x, art.y, art.w, art.h);
    if (rect.film) {
      // Film sprocket holes along the top and bottom edges.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const holeW = Math.max(6, w * 0.045), holeH = Math.max(4, h * 0.018);
      const n = Math.max(3, Math.floor(w / (holeW * 2.4)));
      for (let i = 0; i < n; i++) {
        const hx = art.x + ((i + 0.5) * art.w) / n - holeW / 2;
        roundRect(ctx, hx, art.y + 3, holeW, holeH, 2); ctx.fill();
        roundRect(ctx, hx, art.y + art.h - holeH - 3, holeW, holeH, 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// The title band across the top: three separated zones — retro sun on the left,
// title + subtitle in the centre, stars + badge ribbon on the right — so nothing
// ever overlaps, at any export size.
function drawTitleBand(ctx, W, bandH, grade, state) {
  const sunZoneW = bandH * 1.15;
  const rightZoneW = Math.max(bandH * 1.7, W * 0.17);
  const titleX0 = sunZoneW + 8;
  const titleX1 = W - rightZoneW - 8;
  const titleW = Math.max(60, titleX1 - titleX0);
  const cx = (titleX0 + titleX1) / 2;

  // Palms flank the band, drawn dark against the grade background.
  const palmS = bandH / 120;
  drawPalm(ctx, 6, bandH * 0.98, palmS * 0.9, false, grade.palm);
  drawPalm(ctx, W - 6, bandH * 0.98, palmS * 0.9, true, grade.palm);

  // Retro sun, left zone, kept clear of the title.
  const sunR = Math.min(bandH * 0.42, sunZoneW * 0.42);
  drawRetroSun(ctx, sunZoneW / 2, bandH * 0.52, sunR, grade);

  // Title + subtitle, centre zone.
  const title = (state.title || 'NEON SHORE').toUpperCase();
  const titlePx = fitText(ctx, title, titleW, Math.min(bandH * 0.42, 120), '"Archivo Black"', 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = grade.title;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  const titleY = bandH * 0.52;
  ctx.font = `400 ${titlePx}px "Archivo Black", sans-serif`;
  ctx.fillText(title, cx, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const sub = state.subtitle || '';
  if (sub) {
    const subPx = fitText(ctx, sub, titleW, Math.min(bandH * 0.30, 64), '"Dancing Script"', 700);
    ctx.font = `700 ${subPx}px "Dancing Script", cursive`;
    ctx.fillStyle = grade.subtitle;
    ctx.fillText(sub, cx, bandH * 0.88);
  }

  // Right zone: star heat meter on top, badge ribbon below it.
  const rzX = W - rightZoneW;
  const starR = Math.min(bandH * 0.13, rightZoneW * 0.085);
  const starGap = starR * 2.5;
  const starsW = starGap * 4 + starR * 2;
  const starsX0 = rzX + (rightZoneW - starsW) / 2;
  const starsY = bandH * 0.30;
  const heat = Math.max(0, Math.min(5, state.heat ?? 4));
  for (let i = 0; i < 5; i++) {
    const sx = starsX0 + starR + i * starGap;
    starPath(ctx, sx, starsY, starR, starR * 0.45);
    if (i < heat) {
      ctx.fillStyle = grade.sunTop;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Badge ribbon.
  const badge = (state.badge || 'GTA VI').toUpperCase();
  const ribH = Math.max(18, bandH * 0.24);
  const ribW = Math.min(rightZoneW * 0.92, badge.length * ribH * 0.62 + ribH * 1.6);
  const ribX = rzX + (rightZoneW - ribW) / 2;
  const ribY = bandH * 0.56;
  ctx.save();
  ctx.translate(ribX + ribW / 2, ribY + ribH / 2);
  ctx.rotate(-0.05);
  ctx.translate(-ribW / 2, -ribH / 2);
  ctx.fillStyle = grade.accent;
  roundRect(ctx, 0, 0, ribW, ribH, ribH / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  const badgePx = fitText(ctx, badge, ribW - ribH * 0.9, ribH * 0.52, '"Archivo Black"', 400);
  ctx.font = `400 ${badgePx}px "Archivo Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, ribW / 2, ribH / 2 + 1);
  ctx.restore();
}

function drawGrain(ctx, W, H) {
  const rand = mulberry32(1337);
  const count = Math.floor((W * H) / 1400);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rand() * W, y = rand() * H;
    ctx.globalAlpha = 0.04 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? '#fff' : '#000';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// state: { layout, grade, title, subtitle, heat, badge, photos, assign }
// photos: [{ img, label, zoom, ox, oy, moved }]; assign: panel index -> photo index.
export function drawCover(ctx, W, H, state) {
  const grade = gradeById(state.grade);
  const layout = layoutById(state.layout);
  ctx.clearRect(0, 0, W, H);

  // Background: grade gradient. Tilted Snaps gets a soft radial glow instead
  // of a sun, so the three polaroids read as prints on a wall, not a pyramid.
  if (layout.id === 'tilted-snaps') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, grade.bgTop);
    g.addColorStop(1, grade.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, Math.max(W, H) * 0.55);
    glow.addColorStop(0, 'rgba(255,255,255,0.20)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W * 0.25, H);
    g.addColorStop(0, grade.bgTop);
    g.addColorStop(1, grade.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const bandH = Math.round(H * 0.20);
  drawTitleBand(ctx, W, bandH, grade, state);

  const pad = Math.max(12, Math.round(Math.min(W, H) * 0.022));
  const area = { x: pad, y: bandH + pad * 0.6, w: W - pad * 2, h: H - bandH - pad * 1.6 };
  const rects = panelRects(layout.id, area);
  const assign = state.assign || rects.map((_, i) => i % Math.max(1, (state.photos || []).length));
  rects.forEach((rect, i) => {
    const photo = (state.photos || [])[assign[i] % Math.max(1, (state.photos || []).length)] || null;
    drawPanel(ctx, photo, rect, grade, i);
  });

  drawGrain(ctx, W, H);
  drawVignette(ctx, W, H);
}

// Render a fresh canvas at the requested export size and return it.
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), w, h, state);
  return canvas;
}
