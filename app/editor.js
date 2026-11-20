// Neon Sunset Cover Studio — the editor.
//
// Wires the controls (photos, layout, crop, caption, grade, export) to the
// cover engine in cover.js. The preview canvas is a live render of the exact
// cover the Export button writes, at the exact export size.

(function () {
  'use strict';

  var Cover = window.NeonCover;
  var canvas = document.getElementById('preview-canvas');
  var ctx = canvas.getContext('2d');

  var state = {
    layoutId: 'vice-grid',
    gradeId: 'vice-sunset',
    title: 'NEON SHORE',
    subtitle: 'a sunset city story',
    sizeId: 'wide',
    photos: [], // { img, label }
    assign: [], // photo index per panel
    crops: [], // { zoom, fx, fy } per panel
    selectedPanel: 0,
    selectedPhoto: 0,
  };

  var layoutCache = null; // layoutPanels() for the current preview size
  var exportedOnce = false;

  // ---------------------------------------------------------------- helpers

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function panelCount() {
    return layoutCache ? layoutCache.panels.length : 0;
  }

  function ensurePanelState() {
    var n = panelCount();
    while (state.assign.length < n) state.assign.push(state.photos.length ? (state.assign.length % state.photos.length) : 0);
    while (state.crops.length < n) {
      var i = state.crops.length;
      state.crops.push({ zoom: 1, fx: 0.3 + 0.4 * ((i * 7) % 10) / 10, fy: 0.35 + 0.3 * ((i * 3) % 10) / 10 });
    }
    state.assign.length = n;
    state.crops.length = n;
    if (state.selectedPanel >= n) state.selectedPanel = 0;
  }

  // ---------------------------------------------------------------- render

  function previewSize() {
    var size = Cover.sizeById(state.sizeId);
    var maxW = 960;
    var maxH = 1100;
    var scale = Math.min(maxW / size.w, maxH / size.h, 1);
    return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
  }

  function render() {
    var ps = previewSize();
    if (canvas.width !== ps.w || canvas.height !== ps.h) {
      canvas.width = ps.w;
      canvas.height = ps.h;
    }
    layoutCache = Cover.layoutPanels(ps.w, ps.h, state.layoutId);
    ensurePanelState();
    Cover.drawCover(ctx, ps.w, ps.h, state);
    $('preview-size-label').textContent =
      Cover.sizeById(state.sizeId).w + ' x ' + Cover.sizeById(state.sizeId).h;
    $('panel-label').textContent = String(state.selectedPanel + 1);
    syncSliders();
    markSteps();
  }

  function syncSliders() {
    var crop = state.crops[state.selectedPanel] || { zoom: 1, fx: 0.5, fy: 0.5 };
    $('zoom').value = String(crop.zoom);
    $('zoom-val').textContent = crop.zoom.toFixed(2).replace(/0$/, '') + 'x';
    $('pan-x').value = String(crop.fx);
    $('pan-y').value = String(crop.fy);
  }

  function markSteps() {
    var steps = document.querySelectorAll('.steps li');
    if (!steps.length) return;
    var done1 = state.photos.length > 0;
    var done2 = state.layoutId !== 'vice-grid' || done1;
    var done3 = state.title.trim() !== '' && done1;
    steps[0].classList.toggle('done', done1);
    steps[1].classList.toggle('done', done2);
    steps[2].classList.toggle('done', done3);
    steps[3].classList.toggle('done', exportedOnce);
    steps.forEach(function (li) {
      li.classList.remove('on');
    });
    var current = exportedOnce ? 3 : done3 ? 3 : done1 ? 2 : 0;
    steps[current].classList.add('on');
  }

  // ---------------------------------------------------------------- photos

  function addPhoto(img, label) {
    state.photos.push({ img: img, label: label });
    state.selectedPhoto = state.photos.length - 1;
    buildPhotoStrip();
    ensurePanelState();
    render();
  }

  function buildPhotoStrip() {
    var strip = $('photo-strip');
    strip.innerHTML = '';
    state.photos.forEach(function (photo, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-thumb' + (idx === state.selectedPhoto ? ' sel' : '');
      btn.title = 'Use "' + photo.label + '" for the selected panel';
      var thumb = document.createElement('img');
      thumb.src = photo.img.currentSrc || photo.img.src;
      thumb.alt = photo.label;
      var name = document.createElement('span');
      name.textContent = photo.label;
      var rm = document.createElement('span');
      rm.className = 'remove';
      rm.textContent = 'x';
      rm.title = 'Remove photo';
      rm.addEventListener('click', function (ev) {
        ev.stopPropagation();
        removePhoto(idx);
      });
      btn.appendChild(thumb);
      btn.appendChild(name);
      btn.appendChild(rm);
      btn.addEventListener('click', function () {
        state.selectedPhoto = idx;
        state.assign[state.selectedPanel] = idx;
        buildPhotoStrip();
        render();
      });
      strip.appendChild(btn);
    });
  }

  function removePhoto(idx) {
    state.photos.splice(idx, 1);
    if (state.selectedPhoto >= state.photos.length) state.selectedPhoto = Math.max(0, state.photos.length - 1);
    for (var i = 0; i < state.assign.length; i++) {
      if (state.assign[i] === idx) state.assign[i] = 0;
      else if (state.assign[i] > idx) state.assign[i]--;
    }
    buildPhotoStrip();
    render();
  }

  function loadSamples() {
    var samples = [
      { el: $('sample-boulevard'), label: 'Boulevard' },
      { el: $('sample-pier'), label: 'Pier' },
    ];
    samples.forEach(function (s) {
      if (!s.el) return;
      var add = function () {
        if (state.photos.some(function (p) { return p.img === s.el; })) return;
        addPhoto(s.el, s.label);
      };
      if (s.el.complete && s.el.naturalWidth > 0) add();
      else s.el.addEventListener('load', add);
    });
  }

  $('photo-input').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.dataset.label = file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo';
      img.onload = function () {
        addPhoto(img, img.dataset.label);
      };
      img.src = url;
    });
    ev.target.value = '';
  });

  $('sample-btn').addEventListener('click', loadSamples);

  $('fill-one-btn').addEventListener('click', function () {
    var idx = state.selectedPhoto;
    ensurePanelState();
    for (var i = 0; i < state.assign.length; i++) {
      state.assign[i] = idx;
      // Vary the crop per panel so one photo reads differently in each.
      state.crops[i] = {
        zoom: 1.15,
        fx: 0.25 + 0.5 * ((i * 2 + 1) % 3) / 2,
        fy: 0.3 + 0.4 * ((i * 3 + 1) % 3) / 2,
      };
    }
    render();
  });

  $('mix-btn').addEventListener('click', function () {
    if (!state.photos.length) return;
    ensurePanelState();
    for (var i = 0; i < state.assign.length; i++) state.assign[i] = i % state.photos.length;
    render();
  });

  // ---------------------------------------------------------------- pickers

  function buildLayoutPicker() {
    var grid = $('layout-grid');
    Cover.LAYOUTS.forEach(function (layout) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layout-btn' + (layout.id === state.layoutId ? ' sel' : '');
      btn.title = layout.blurb;
      var glyph = document.createElement('span');
      glyph.className = 'glyph';
      var name = document.createElement('span');
      name.textContent = layout.name;
      btn.appendChild(glyph);
      btn.appendChild(name);
      btn.addEventListener('click', function () {
        state.layoutId = layout.id;
        buildLayoutPicker();
        render();
      });
      grid.appendChild(btn);
    });
  }

  function buildGradePicker() {
    var grid = $('grade-grid');
    Cover.GRADES.forEach(function (grade) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grade-btn' + (grade.id === state.gradeId ? ' sel' : '');
      btn.title = grade.name;
      var swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = grade.swatch;
      var name = document.createElement('span');
      name.textContent = grade.name;
      btn.appendChild(swatch);
      btn.appendChild(name);
      btn.addEventListener('click', function () {
        state.gradeId = grade.id;
        buildGradePicker();
        render();
      });
      grid.appendChild(btn);
    });
  }

  function buildSizePicker() {
    var grid = $('size-grid');
    Cover.SIZES.forEach(function (size) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'size-btn' + (size.id === state.sizeId ? ' sel' : '');
      var b = document.createElement('b');
      b.textContent = size.w + ' x ' + size.h;
      var small = document.createElement('span');
      small.textContent = size.label.split('·')[0].trim();
      btn.appendChild(b);
      btn.appendChild(small);
      btn.addEventListener('click', function () {
        state.sizeId = size.id;
        buildSizePicker();
        render();
      });
      grid.appendChild(btn);
    });
  }

  // ---------------------------------------------------------------- caption

  $('title-input').addEventListener('input', function (ev) {
    state.title = ev.target.value;
    render();
  });

  $('subtitle-input').addEventListener('input', function (ev) {
    state.subtitle = ev.target.value;
    render();
  });

  // ---------------------------------------------------------------- crop sliders

  $('zoom').addEventListener('input', function (ev) {
    ensurePanelState();
    state.crops[state.selectedPanel].zoom = parseFloat(ev.target.value);
    render();
  });

  $('pan-x').addEventListener('input', function (ev) {
    ensurePanelState();
    state.crops[state.selectedPanel].fx = parseFloat(ev.target.value);
    render();
  });

  $('pan-y').addEventListener('input', function (ev) {
    ensurePanelState();
    state.crops[state.selectedPanel].fy = parseFloat(ev.target.value);
    render();
  });

  // ---------------------------------------------------------------- canvas interaction

  function canvasPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function hitPanel(pt) {
    if (!layoutCache) return -1;
    for (var i = layoutCache.panels.length - 1; i >= 0; i--) {
      var p = layoutCache.panels[i];
      if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) return i;
    }
    return -1;
  }

  var drag = null;

  canvas.addEventListener('pointerdown', function (ev) {
    var pt = canvasPoint(ev);
    var idx = hitPanel(pt);
    if (idx < 0) return;
    state.selectedPanel = idx;
    ensurePanelState();
    var p = layoutCache.panels[idx];
    var img = state.photos[state.assign[idx]];
    var scale = 1;
    if (img) {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      scale = Math.max(p.w / iw, p.h / ih) * (state.crops[idx].zoom || 1);
    }
    drag = { panel: idx, startX: pt.x, startY: pt.y, scale: scale, img: img || null, moved: false };
    canvas.setPointerCapture(ev.pointerId);
    render();
  });

  canvas.addEventListener('pointermove', function (ev) {
    if (!drag || !drag.img) return;
    var pt = canvasPoint(ev);
    var dx = pt.x - drag.startX;
    var dy = pt.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    var img = drag.img;
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var crop = state.crops[drag.panel];
    var sw = (layoutCache.panels[drag.panel].w / drag.scale) / iw;
    var sh = (layoutCache.panels[drag.panel].h / drag.scale) / ih;
    crop.fx = clamp(crop.fx - dx / (drag.scale * iw), sw / 2, 1 - sw / 2);
    crop.fy = clamp(crop.fy - dy / (drag.scale * ih), sh / 2, 1 - sh / 2);
    drag.startX = pt.x;
    drag.startY = pt.y;
    render();
  });

  canvas.addEventListener('pointerup', function () {
    drag = null;
  });

  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var pt = canvasPoint(ev);
    var idx = hitPanel(pt);
    if (idx < 0) return;
    state.selectedPanel = idx;
    ensurePanelState();
    var crop = state.crops[idx];
    crop.zoom = clamp(crop.zoom * Math.exp(-ev.deltaY * 0.0012), 1, 3);
    render();
  }, { passive: false });

  // ---------------------------------------------------------------- export

  function renderToCanvas(sizeId) {
    var size = Cover.sizeById(sizeId);
    var out = document.createElement('canvas');
    out.width = size.w;
    out.height = size.h;
    Cover.drawCover(out.getContext('2d'), size.w, size.h, state);
    return out;
  }

  function exportPNG(sizeId) {
    return new Promise(function (resolve) {
      var out = renderToCanvas(sizeId);
      out.toBlob(function (blob) {
        var size = Cover.sizeById(sizeId);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cover-' + size.w + 'x' + size.h + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        exportedOnce = true;
        $('export-status').textContent =
          'Exported ' + size.w + ' x ' + size.h + ' PNG — check your downloads.';
        render();
        resolve(blob);
      }, 'image/png');
    });
  }

  $('export-btn').addEventListener('click', function () {
    exportPNG(state.sizeId);
  });

  $('export-all-btn').addEventListener('click', function () {
    var sizes = Cover.SIZES.map(function (s) { return s.id; });
    var chain = Promise.resolve();
    sizes.forEach(function (id) {
      chain = chain.then(function () {
        return new Promise(function (res) {
          setTimeout(function () { exportPNG(id).then(res); }, 250);
        });
      });
    });
    chain.then(function () {
      $('export-status').textContent = 'Exported all three sizes as PNGs.';
    });
  });

  // ---------------------------------------------------------------- boot

  function applyParams() {
    var q = new URLSearchParams(window.location.search);
    var layout = q.get('layout');
    var grade = q.get('grade');
    var size = q.get('size');
    if (layout && Cover.layoutById(layout)) state.layoutId = layout;
    if (grade && Cover.gradeById(grade)) state.gradeId = grade;
    if (size && Cover.sizeById(size)) state.sizeId = size;
    if (q.get('title') != null) {
      state.title = q.get('title');
      $('title-input').value = state.title;
    }
    if (q.get('subtitle') != null) {
      state.subtitle = q.get('subtitle');
      $('subtitle-input').value = state.subtitle;
    }
    // ?shot=cover renders the cover alone, full frame, for screenshots.
    if (q.get('shot') === 'cover') {
      document.querySelector('.topbar').style.display = 'none';
      document.querySelector('.controls').style.display = 'none';
      document.querySelector('.foot').style.display = 'none';
      document.querySelector('.preview-head').style.display = 'none';
      document.querySelector('.preview-tip').style.display = 'none';
      document.querySelector('.offline-note').style.display = 'none';
      document.querySelector('.workspace').style.display = 'block';
      document.querySelector('.workspace').style.padding = '0';
      document.querySelector('.workspace').style.maxWidth = 'none';
      document.querySelector('.canvas-wrap').style.padding = '0';
      document.querySelector('.canvas-wrap').style.border = '0';
      document.querySelector('.canvas-wrap').style.background = 'none';
    }
  }

  function boot() {
    applyParams();
    buildLayoutPicker();
    buildGradePicker();
    buildSizePicker();
    loadSamples();
    // Fonts first, then the first render, so the lettering is real.
    var fontsReady = Promise.resolve();
    if (document.fonts && document.fonts.load) {
      fontsReady = Promise.all([
        document.fonts.load('40px Anton'),
        document.fonts.load('20px Pacifico'),
      ]).catch(function () { /* fall back to system fonts */ });
    }
    fontsReady.then(function () { render(); });
    render();
  }

  // For scripted use (screenshots, finalist review): the same export the
  // button runs, callable from the page.
  window.NeonCoverApp = {
    state: state,
    render: render,
    exportPNG: exportPNG,
    renderToCanvas: renderToCanvas,
    photosReady: function () { return state.photos.length; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
