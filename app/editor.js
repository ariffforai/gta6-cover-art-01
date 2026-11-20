// Neon Sunset Cover Studio — editor.
// Wires the cover engine to the page: photo upload, one-photo / mix assignment,
// per-panel drag-pan, wheel-zoom and sliders, layout + grade toolbar, live
// preview, PNG export at 1920x1080 / 1080x1080 / 1080x1350, and a ?shot=cover
// mode that stages a cover full-bleed for screenshots.

import { LAYOUTS, GRADES, layoutById, gradeById, drawCover, renderCover, panelRects } from './cover.js';

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const pctx = preview.getContext('2d');

const SAMPLES = [
  { src: 'samples/boulevard.jpg', label: 'BOULEVARD' },
  { src: 'samples/pier.jpg', label: 'PIER' },
];

// The staged state. The toolbar always reflects it (and vice versa), so a
// ?shot=cover staging shows the same layout and grade as the toolbar.
const state = {
  layout: 'vice-grid',
  grade: 'vice-sunset',
  title: 'NEON SHORE',
  subtitle: 'Vice City nights',
  heat: 4,
  badge: 'GTA VI',
  photos: [],          // { img, label }
  assign: [],          // panel index -> photo index
  crops: new Map(),    // "panel:photo" -> { zoom, ox, oy, moved }
  selected: 0,         // selected panel
};

let fontsReady = false;
let shotMode = false;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.src);
      state.photos.push({ img, label: s.label });
    } catch (e) {
      console.error(e);
    }
  }
  const panels = layoutById(state.layout).panels;
  state.assign = Array.from({ length: panels }, (_, i) => i % Math.max(1, state.photos.length));
}

function cropFor(panel, photoIdx) {
  const key = panel + ':' + photoIdx;
  if (!state.crops.has(key)) state.crops.set(key, { zoom: 1, ox: 0, oy: 0, moved: false });
  return state.crops.get(key);
}

// Build one photo view per panel (cover.js draws photos[assign[i]]).
function panelViews() {
  const panels = layoutById(state.layout).panels;
  return Array.from({ length: panels }, (_, i) => {
    const photoIdx = state.assign[i] ?? 0;
    const photo = state.photos[photoIdx];
    if (!photo) return null;
    const crop = cropFor(i, photoIdx);
    return { img: photo.img, label: photo.label, zoom: crop.zoom, ox: crop.ox, oy: crop.oy, moved: crop.moved };
  });
}

function drawState() {
  return {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    heat: state.heat,
    badge: state.badge,
    photos: panelViews(),
    assign: panelViews().map((_, i) => i),
  };
}

function drawPreview() {
  if (!fontsReady) return;
  drawCover(pctx, preview.width, preview.height, drawState());
  window.__coverReady = true;
}

function syncToolbar() {
  document.querySelectorAll('#layout-bar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
    b.setAttribute('aria-pressed', b.dataset.layout === state.layout ? 'true' : 'false');
  });
  document.querySelectorAll('#grade-bar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
    b.setAttribute('aria-pressed', b.dataset.grade === state.grade ? 'true' : 'false');
  });
  const titleInput = $('#title-input');
  if (titleInput && titleInput.value !== state.title) titleInput.value = state.title;
  const subInput = $('#subtitle-input');
  if (subInput && subInput.value !== state.subtitle) subInput.value = state.subtitle;
  const heatInput = $('#heat-input');
  if (heatInput) heatInput.value = String(state.heat);
  const heatOut = $('#heat-out');
  if (heatOut) heatOut.textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  syncSliders();
}

function syncSliders() {
  const photoIdx = state.assign[state.selected] ?? 0;
  const crop = cropFor(state.selected, photoIdx);
  const zoom = $('#zoom-slider'), px = $('#panx-slider'), py = $('#pany-slider');
  if (zoom) zoom.value = String(crop.zoom);
  if (px) px.value = String(crop.ox);
  if (py) py.value = String(crop.oy);
  const sel = $('#panel-label');
  if (sel) sel.textContent = `Panel ${state.selected + 1} — ${state.photos[photoIdx] ? state.photos[photoIdx].label : 'empty'}`;
}

function setLayout(id) {
  state.layout = layoutById(id).id;
  const panels = layoutById(state.layout).panels;
  while (state.assign.length < panels) state.assign.push(state.assign.length % Math.max(1, state.photos.length));
  state.assign.length = panels;
  state.selected = 0;
  syncToolbar();
  drawPreview();
}

function setGrade(id) {
  state.grade = gradeById(id).id;
  syncToolbar();
  drawPreview();
}

function buildToolbar() {
  const layoutBar = $('#layout-bar');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = l.id;
    b.textContent = l.label;
    b.addEventListener('click', () => setLayout(l.id));
    layoutBar.appendChild(b);
  });
  const gradeBar = $('#grade-bar');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = g.id;
    b.textContent = g.label;
    b.style.setProperty('--swatch', g.sunBottom);
    b.addEventListener('click', () => setGrade(g.id));
    gradeBar.appendChild(b);
  });
}

async function addUploads(files) {
  let added = false;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const label = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().toUpperCase().slice(0, 18) || `PHOTO ${state.photos.length + 1}`;
      state.photos.push({ img, label });
      added = true;
    } catch (e) {
      console.error(e);
    }
  }
  if (added) {
    state.assign = state.assign.map((_, i) => i % state.photos.length);
    renderPhotoList();
    drawPreview();
  }
}

function renderPhotoList() {
  const list = $('#photo-list');
  list.innerHTML = '';
  state.photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'photo-chip';
    b.textContent = p.label;
    b.title = 'Assign to selected panel';
    b.addEventListener('click', () => {
      state.assign[state.selected] = i;
      renderPhotoList();
      syncSliders();
      drawPreview();
    });
    if (state.assign[state.selected] === i) b.classList.add('active');
    list.appendChild(b);
  });
}

// Preview canvas geometry: the drawn cover fills the canvas, so hit-testing
// uses the same panel math as the engine.
function previewArea() {
  const W = preview.width, H = preview.height;
  const bandH = Math.round(H * 0.20);
  const pad = Math.max(12, Math.round(Math.min(W, H) * 0.022));
  return { x: pad, y: bandH + pad * 0.6, w: W - pad * 2, h: H - bandH - pad * 1.6 };
}

function panelAt(cx, cy) {
  const rect = preview.getBoundingClientRect();
  const scaleX = preview.width / rect.width;
  const scaleY = preview.height / rect.height;
  const x = (cx - rect.left) * scaleX;
  const y = (cy - rect.top) * scaleY;
  const rects = panelRects(state.layout, previewArea());
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindPointer() {
  let dragging = false;
  let lastX = 0, lastY = 0;
  preview.addEventListener('pointerdown', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    state.selected = i;
    syncToolbar();
    renderPhotoList();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const photoIdx = state.assign[state.selected] ?? 0;
    const crop = cropFor(state.selected, photoIdx);
    crop.ox = Math.max(-1, Math.min(1, crop.ox - ((e.clientX - lastX) / rect.width) * 2));
    crop.oy = Math.max(-1, Math.min(1, crop.oy - ((e.clientY - lastY) / rect.height) * 2));
    crop.moved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    syncSliders();
    drawPreview();
  });
  preview.addEventListener('pointerup', () => { dragging = false; });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const photoIdx = state.assign[state.selected] ?? 0;
    const crop = cropFor(state.selected, photoIdx);
    crop.zoom = Math.max(1, Math.min(3, crop.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    crop.moved = true;
    syncSliders();
    drawPreview();
  }, { passive: false });
}

function bindSliders() {
  $('#zoom-slider').addEventListener('input', (e) => {
    const crop = cropFor(state.selected, state.assign[state.selected] ?? 0);
    crop.zoom = parseFloat(e.target.value);
    crop.moved = true;
    drawPreview();
  });
  $('#panx-slider').addEventListener('input', (e) => {
    const crop = cropFor(state.selected, state.assign[state.selected] ?? 0);
    crop.ox = parseFloat(e.target.value);
    crop.moved = true;
    drawPreview();
  });
  $('#pany-slider').addEventListener('input', (e) => {
    const crop = cropFor(state.selected, state.assign[state.selected] ?? 0);
    crop.oy = parseFloat(e.target.value);
    crop.moved = true;
    drawPreview();
  });
}

function exportPNG(w, h) {
  const canvas = renderCover(drawState(), w, h);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

// Exposed for automated checks: export and report the real dimensions.
window.__exportCover = async (w, h) => {
  const canvas = renderCover(drawState(), w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const bmp = await createImageBitmap(blob);
  const out = { width: bmp.width, height: bmp.height, bytes: blob.size };
  bmp.close();
  return out;
};

function bindExport() {
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => {
      const [w, h] = b.dataset.export.split('x').map(Number);
      exportPNG(w, h);
    });
  });
}

function bindInputs() {
  $('#title-input').addEventListener('input', (e) => { state.title = e.target.value; drawPreview(); });
  $('#subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; drawPreview(); });
  $('#heat-input').addEventListener('input', (e) => { state.heat = parseInt(e.target.value, 10) || 0; syncToolbar(); drawPreview(); });
  $('#badge-input').addEventListener('input', (e) => { state.badge = e.target.value; drawPreview(); });
  $('#upload-input').addEventListener('change', (e) => addUploads([...e.target.files]));
  $('#one-photo').addEventListener('click', () => {
    const idx = state.assign[state.selected] ?? 0;
    state.assign = state.assign.map(() => idx);
    renderPhotoList();
    drawPreview();
  });
  $('#mix-photos').addEventListener('click', () => {
    state.assign = state.assign.map((_, i) => i % Math.max(1, state.photos.length));
    renderPhotoList();
    drawPreview();
  });
  const drop = $('#drop-zone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    addUploads([...e.dataTransfer.files]);
  });
}

// ?shot=cover stages one cover full-bleed: the preview canvas is resized to the
// requested export size and the toolbar reflects the staged layout and grade.
function applyShotParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('shot') !== 'cover') return;
  shotMode = true;
  document.body.classList.add('shot');
  if (q.get('layout')) state.layout = layoutById(q.get('layout')).id;
  if (q.get('grade')) state.grade = gradeById(q.get('grade')).id;
  if (q.get('title')) state.title = q.get('title');
  if (q.get('subtitle') !== null) state.subtitle = q.get('subtitle');
  if (q.get('heat')) state.heat = Math.max(0, Math.min(5, parseInt(q.get('heat'), 10) || 0));
  if (q.get('badge')) state.badge = q.get('badge');
  const w = parseInt(q.get('w') || '1920', 10);
  const h = parseInt(q.get('h') || '1080', 10);
  preview.width = w;
  preview.height = h;
  if (q.get('assign') === 'mix') {
    state.assign = state.assign.map((_, i) => i % Math.max(1, state.photos.length));
  } else if (q.get('assign') === 'one') {
    state.assign = state.assign.map(() => 0);
  }
}

async function init() {
  buildToolbar();
  bindInputs();
  bindSliders();
  bindPointer();
  bindExport();
  await loadSamples();
  applyShotParams();
  // Stage the toolbar to the (possibly shot-staged) layout and grade.
  const panels = layoutById(state.layout).panels;
  while (state.assign.length < panels) state.assign.push(state.assign.length % Math.max(1, state.photos.length));
  state.assign.length = panels;
  renderPhotoList();
  try {
    await Promise.all([
      document.fonts.load('400 40px "Archivo Black"'),
      document.fonts.load('700 40px "Dancing Script"'),
      document.fonts.ready,
    ]);
  } catch (e) {
    console.error(e);
  }
  fontsReady = true;
  syncToolbar();
  drawPreview();
  window.__editorReady = true;
}

init();
