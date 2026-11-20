/* Neon Sunset Cover Studio — editor.
 * Wires the cover engine to the page: photo uploads (read on this
 * machine, never sent anywhere), per-panel crop and position, layout
 * and grade pickers, caption editing, a live preview painted by the
 * very same drawCover the export uses, and PNG export at the three
 * common post sizes. Also drives the ?shot=cover staging mode the
 * screenshots are taken from.
 */
'use strict';

(function (global) {
  var CoverArt = global.CoverArt;
  var $ = function (id) { return document.getElementById(id); };

  var state = CoverArt.defaultState();
  var sizeKey = 'landscape';
  var assignMode = 'mix';
  var selectedPanel = 0;
  var panelsByLayout = { 'vice-grid': state.panels };
  var photos = [];
  var fontsReady = false;

  /* --------------------------------------------------------- photos */

  function labelFromName(name) {
    var base = (name || 'photo').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    base = base.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return base.slice(0, 24) || 'Photo';
  }

  function addPhoto(img, label) {
    photos.push({ img: img, label: label });
    state.photos = photos;
    applyAssignment();
    refreshPanelPhotoOptions();
    render();
  }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadSample(name, label) {
    return fetch('samples/' + name)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = reject;
            img.src = reader.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .then(function (img) { addPhoto(img, label); });
  }

  function loadSamples() {
    return loadSample('boulevard.jpg', 'Boulevard')
      .then(function () { return loadSample('pier.jpg', 'Pier'); });
  }

  /* --------------------------------------------------------- panels */

  function ensurePanels(layoutId) {
    var n = CoverArt.panelCount(layoutId);
    var list = panelsByLayout[layoutId];
    if (!list) {
      list = CoverArt.defaultPanels(layoutId, photos.length);
      panelsByLayout[layoutId] = list;
    }
    while (list.length < n) list.push({ photo: 0, zoom: 1, ox: 0, oy: 0 });
    if (list.length > n) list.length = n;
    return list;
  }

  /** One photo everywhere, or a mix cycled across the panels. */
  function applyAssignment() {
    var list = ensurePanels(state.layout);
    if (assignMode === 'one') {
      list.forEach(function (p) { p.photo = 0; });
    } else {
      list.forEach(function (p, i) {
        if (photos.length > 0) p.photo = i % photos.length;
      });
    }
    state.panels = list;
  }

  function currentPanel() {
    var list = ensurePanels(state.layout);
    if (selectedPanel >= list.length) selectedPanel = 0;
    return list[selectedPanel];
  }

  /* --------------------------------------------------------- render */

  function previewSize() {
    var s = CoverArt.SIZES[sizeKey];
    var scale = 960 / Math.max(s.w, s.h);
    return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
  }

  function render() {
    var canvas = $('preview');
    if (!canvas) return;
    var size = previewSize();
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    var ctx = canvas.getContext('2d');
    CoverArt.drawCover(ctx, size.w, size.h, state);
    syncPanelControls();
  }

  /** Export the cover at an exact post size; returns a PNG data URL. */
  function exportPng(key) {
    var s = CoverArt.SIZES[key || sizeKey];
    var canvas = document.createElement('canvas');
    canvas.width = s.w;
    canvas.height = s.h;
    var ctx = canvas.getContext('2d');
    CoverArt.drawCover(ctx, s.w, s.h, state);
    return canvas.toDataURL('image/png');
  }

  function downloadExport() {
    var s = CoverArt.SIZES[sizeKey];
    var url = exportPng(sizeKey);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'neon-sunset-cover-' + s.w + 'x' + s.h + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus('Exported ' + s.w + ' x ' + s.h + ' PNG — check your downloads.');
  }

  /* ------------------------------------------------------ UI sync */

  function setStatus(msg) {
    var el = $('status');
    if (el) el.textContent = msg;
  }

  function refreshPanelPhotoOptions() {
    var sel = $('panelPhoto');
    if (!sel) return;
    sel.innerHTML = '';
    if (photos.length === 0) {
      var opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'No photos yet';
      sel.appendChild(opt);
      return;
    }
    photos.forEach(function (p, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = (i + 1) + ' — ' + p.label;
      sel.appendChild(o);
    });
    sel.value = String(currentPanel().photo);
  }

  function syncPanelControls() {
    var geo = CoverArt.layoutGeometry(state.layout, 100, 100);
    var sel = $('panelSelect');
    if (sel && sel.options.length !== geo.panels.length) {
      sel.innerHTML = '';
      geo.panels.forEach(function (_r, i) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = 'Panel ' + (i + 1);
        sel.appendChild(o);
      });
    }
    if (sel) sel.value = String(selectedPanel);
    var pan = currentPanel();
    var z = $('zoomSlider');
    if (z) z.value = String(pan.zoom);
    var px = $('panXSlider');
    if (px) px.value = String(pan.ox);
    var py = $('panYSlider');
    if (py) py.value = String(pan.oy);
    var ph = $('panelPhoto');
    if (ph) ph.value = String(pan.photo);
    var zv = $('zoomValue');
    if (zv) zv.textContent = pan.zoom.toFixed(2) + 'x';
  }

  function markActive(rowId, value) {
    var row = $(rowId);
    if (!row) return;
    Array.prototype.forEach.call(row.children, function (btn) {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function buildButtons(rowId, items, onPick) {
    var row = $(rowId);
    if (!row) return;
    row.innerHTML = '';
    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.value = item.id;
      b.textContent = item.name;
      if (item.blurb) b.title = item.blurb;
      b.addEventListener('click', function () { onPick(item.id); });
      row.appendChild(b);
    });
  }

  function setLayout(id) {
    state.layout = id;
    selectedPanel = 0;
    state.panels = ensurePanels(id);
    applyAssignment();
    markActive('layoutRow', id);
    render();
  }

  function setGrade(id) {
    state.grade = id;
    markActive('gradeRow', id);
    render();
  }

  function setSizeKey(key) {
    sizeKey = key;
    markActive('sizeRow', key);
    render();
  }

  /* -------------------------------------------------- canvas input */

  function panelAtPoint(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var px = ((clientX - rect.left) / rect.width) * canvas.width;
    var py = ((clientY - rect.top) / rect.height) * canvas.height;
    var geo = CoverArt.layoutGeometry(state.layout, canvas.width, canvas.height);
    for (var i = geo.panels.length - 1; i >= 0; i--) {
      var r = geo.panels[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return { index: i, rect: r, x: px, y: py };
      }
    }
    return null;
  }

  function bindCanvas() {
    var canvas = $('preview');
    if (!canvas) return;
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      var hit = panelAtPoint(canvas, e.clientX, e.clientY);
      if (!hit) return;
      selectedPanel = hit.index;
      drag = { x: hit.x, y: hit.y, ox: currentPanel().ox, oy: currentPanel().oy, rect: hit.rect };
      canvas.setPointerCapture(e.pointerId);
      render();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var rect = canvas.getBoundingClientRect();
      var px = ((e.clientX - rect.left) / rect.width) * canvas.width;
      var py = ((e.clientY - rect.top) / rect.height) * canvas.height;
      var pan = currentPanel();
      pan.ox = Math.max(-0.6, Math.min(0.6, drag.ox + (px - drag.x) / drag.rect.w));
      pan.oy = Math.max(-0.6, Math.min(0.6, drag.oy + (py - drag.y) / drag.rect.h));
      render();
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var hit = panelAtPoint(canvas, e.clientX, e.clientY);
      if (!hit) return;
      selectedPanel = hit.index;
      var pan = currentPanel();
      pan.zoom = Math.max(1, Math.min(3, pan.zoom * Math.exp(-e.deltaY * 0.0012)));
      render();
    }, { passive: false });
  }

  /* ------------------------------------------------------ shot mode */

  /** Apply a staging preset (used by ?shot=cover / ?shot=editor). */
  function applyShotParams(params) {
    if (params.get('layout')) state.layout = params.get('layout');
    if (params.get('grade')) state.grade = params.get('grade');
    if (params.get('title')) state.title = params.get('title');
    if (params.get('subtitle')) state.subtitle = params.get('subtitle');
    if (params.get('heat')) state.heat = Math.max(0, Math.min(5, parseInt(params.get('heat'), 10) || 4));
    if (params.get('size') && CoverArt.SIZES[params.get('size')]) sizeKey = params.get('size');
    state.panels = ensurePanels(state.layout);
    applyAssignment();
    markActive('layoutRow', state.layout);
    markActive('gradeRow', state.grade);
    markActive('sizeRow', sizeKey);
    var titleInput = $('titleInput');
    if (titleInput) titleInput.value = state.title;
    var subInput = $('subtitleInput');
    if (subInput) subInput.value = state.subtitle;
    var heatInput = $('heatInput');
    if (heatInput) heatInput.value = String(state.heat);
  }

  /* ---------------------------------------------------------- boot */

  function init() {
    buildButtons('layoutRow', CoverArt.LAYOUTS, setLayout);
    buildButtons('gradeRow', CoverArt.GRADE_IDS.map(function (id) {
      return { id: id, name: CoverArt.GRADES[id].name };
    }), setGrade);
    buildButtons('sizeRow', Object.keys(CoverArt.SIZES).map(function (id) {
      return { id: id, name: CoverArt.SIZES[id].label };
    }), setSizeKey);
    markActive('layoutRow', state.layout);
    markActive('gradeRow', state.grade);
    markActive('sizeRow', sizeKey);

    var fileInput = $('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files || []);
        var chain = Promise.resolve();
        files.forEach(function (f) {
          chain = chain.then(function () {
            return loadImageFile(f).then(function (img) { addPhoto(img, labelFromName(f.name)); });
          });
        });
        chain.then(function () {
          setStatus(files.length + (files.length === 1 ? ' photo' : ' photos') + ' loaded — drag any panel to reposition it.');
        });
      });
    }

    var samplesBtn = $('loadSamples');
    if (samplesBtn) {
      samplesBtn.addEventListener('click', function () {
        loadSamples().then(function () {
          setStatus('Sample photos loaded. Pick a layout, tweak the caption, export.');
        });
      });
    }

    var titleInput = $('titleInput');
    if (titleInput) {
      titleInput.value = state.title;
      titleInput.addEventListener('input', function () {
        state.title = titleInput.value || 'NEON SHORE';
        render();
      });
    }
    var subInput = $('subtitleInput');
    if (subInput) {
      subInput.value = state.subtitle;
      subInput.addEventListener('input', function () {
        state.subtitle = subInput.value;
        render();
      });
    }
    var heatInput = $('heatInput');
    if (heatInput) {
      heatInput.value = String(state.heat);
      heatInput.addEventListener('input', function () {
        state.heat = parseInt(heatInput.value, 10) || 0;
        var hv = $('heatValue');
        if (hv) hv.textContent = String(state.heat) + ' / 5';
        render();
      });
    }

    var modeOne = $('modeOne');
    if (modeOne) modeOne.addEventListener('click', function () { assignMode = 'one'; applyAssignment(); render(); });
    var modeMix = $('modeMix');
    if (modeMix) modeMix.addEventListener('click', function () { assignMode = 'mix'; applyAssignment(); render(); });

    var panelSelect = $('panelSelect');
    if (panelSelect) {
      panelSelect.addEventListener('change', function () {
        selectedPanel = parseInt(panelSelect.value, 10) || 0;
        render();
      });
    }
    var panelPhoto = $('panelPhoto');
    if (panelPhoto) {
      panelPhoto.addEventListener('change', function () {
        currentPanel().photo = parseInt(panelPhoto.value, 10) || 0;
        render();
      });
    }
    var zoomSlider = $('zoomSlider');
    if (zoomSlider) {
      zoomSlider.addEventListener('input', function () {
        currentPanel().zoom = parseFloat(zoomSlider.value) || 1;
        render();
      });
    }
    var panXSlider = $('panXSlider');
    if (panXSlider) {
      panXSlider.addEventListener('input', function () {
        currentPanel().ox = parseFloat(panXSlider.value) || 0;
        render();
      });
    }
    var panYSlider = $('panYSlider');
    if (panYSlider) {
      panYSlider.addEventListener('input', function () {
        currentPanel().oy = parseFloat(panYSlider.value) || 0;
        render();
      });
    }

    var exportBtn = $('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', downloadExport);

    bindCanvas();

    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    var staged = Promise.resolve();
    if (shot === 'cover' || shot === 'editor') {
      applyShotParams(params);
      staged = loadSamples();
    }
    var fonts = Promise.all([
      document.fonts.load('400 64px Anton'),
      document.fonts.load('400 48px Pacifico'),
      document.fonts.ready,
    ]).then(function () { fontsReady = true; }).catch(function () {});

    Promise.all([staged, fonts]).then(function () {
      render();
      if (shot) window.__shotReady = true;
    });
    render();
  }

  global.CoverStudio = {
    state: state,
    photos: photos,
    render: render,
    exportPng: exportPng,
    loadSamples: loadSamples,
    setLayout: setLayout,
    setGrade: setGrade,
    setSize: setSizeKey,
    get fontsReady() { return fontsReady; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
