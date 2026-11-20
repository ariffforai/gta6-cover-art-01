'use strict';
/*
 * Neon Sunset Cover Studio — editor.
 *
 * Wires the page to the render engine (cover.js): photo upload and sample
 * loading, per-panel crop controls (drag to pan, wheel to zoom, sliders),
 * one-photo / mix assignment, live preview, PNG export at the three post
 * sizes, and the ?shot= staging mode the screenshots are taken in.
 *
 * Photos never leave the machine: uploads are read with FileReader into
 * data URIs, samples are files under app/samples/.
 */

(function () {
  var studio = window.CoverStudio;
  var state = studio.defaultState();
  var photos = []; // { img: HTMLImageElement, label: string }
  var selectedPanel = 0;
  var selectedSize = '1920x1080';
  var preview = null;
  var renderQueued = false;

  // ------------------------------------------------------------ utilities

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function queryParams() {
    var out = {};
    var q = new URLSearchParams(window.location.search);
    q.forEach(function (value, key) {
      out[key] = value;
    });
    return out;
  }

  // ------------------------------------------------------------ fonts

  // The two vendored display faces must be in hand before the first draw,
  // or the title falls back to a system font and the export changes.
  function ensureFonts() {
    var loads = [];
    try {
      loads.push(document.fonts.load('100px "Bebas Neue"'));
      loads.push(document.fonts.load('700 40px "Caveat"'));
      loads.push(document.fonts.ready);
    } catch (err) {
      return Promise.resolve();
    }
    return Promise.all(loads).catch(function () {});
  }

  // ------------------------------------------------------------ photos

  function addPhoto(img, label) {
    photos.push({ img: img, label: label || ('Photo ' + photos.length) });
    if (state.assign === 'mix') mixPhotosAcrossPanels();
    rebuildPanelControls();
    rebuildPhotoSelects();
    requestRender();
  }

  function loadImageFile(src, label) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve({ img: img, label: label }); };
      img.onerror = function () { reject(new Error('could not load ' + label)); };
      img.src = src;
    });
  }

  function loadSamples() {
    var jobs = [
      loadImageFile('samples/boulevard.jpg', 'Boulevard'),
      loadImageFile('samples/pier.jpg', 'Pier')
    ];
    return Promise.all(jobs).then(function (loaded) {
      for (var i = 0; i < loaded.length; i++) addPhoto(loaded[i].img, loaded[i].label);
    });
  }

  // New photos spread across the panels in rotation (mix mode).
  function mixPhotosAcrossPanels() {
    if (!photos.length) return;
    var layout = studio.layoutFor(state.layout);
    for (var i = 0; i < layout.panels.length; i++) {
      if (!state.panels[i]) state.panels[i] = { photo: 0, fx: 0.5, fy: studio.FACE_FY, zoom: 1, touched: false };
      state.panels[i].photo = i % photos.length;
    }
  }

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    list.forEach(function (file) {
      if (!file.type || file.type.indexOf('image/') !== 0) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Uploaded';
          addPhoto(img, label);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------ rendering

  function previewSizeFor(sizeName) {
    var dims = studio.SIZES[sizeName] || studio.SIZES['1920x1080'];
    var scale = Math.min(1, 960 / dims[0], 760 / dims[1]);
    return {
      w: Math.max(320, Math.round(dims[0] * scale)),
      h: Math.max(320, Math.round(dims[1] * scale))
    };
  }

  function renderPreview() {
    if (!preview) return;
    var size = previewSizeFor(selectedSize);
    if (preview.width !== size.w || preview.height !== size.h) {
      preview.width = size.w;
      preview.height = size.h;
    }
    studio.drawCover(preview, state, photos);
    highlightSelectedPanel();
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      renderPreview();
    });
  }

  // Draw a thin selection outline around the selected panel on the preview.
  function highlightSelectedPanel() {
    var ctx = preview.getContext('2d');
    var layout = studio.layoutFor(state.layout);
    var def = layout.panels[selectedPanel];
    if (!def) return;
    var bandH = preview.height * studio.BAND_FRACTION;
    var px = def.x * preview.width;
    var py = bandH + def.y * (preview.height - bandH);
    var pw = def.w * preview.width;
    var ph = def.h * (preview.height - bandH);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
    ctx.restore();
  }

  // ------------------------------------------------------------ export

  // Render the cover at an exact post size and return the canvas.
  function renderExport(sizeName) {
    var dims = studio.SIZES[sizeName] || studio.SIZES['1920x1080'];
    var canvas = document.createElement('canvas');
    canvas.width = dims[0];
    canvas.height = dims[1];
    studio.drawCover(canvas, state, photos);
    return canvas;
  }

  function exportPNG(sizeName) {
    var canvas = renderExport(sizeName);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('export produced no image'));
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cover-' + sizeName + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve(blob);
      }, 'image/png');
    });
  }

  // Data-URL export for the screenshot staging hook (same render path).
  function exportDataURL(sizeName) {
    return new Promise(function (resolve) {
      var canvas = renderExport(sizeName);
      resolve(canvas.toDataURL('image/png'));
    });
  }

  // ------------------------------------------------------------ panel controls

  function panelRect(i) {
    var layout = studio.layoutFor(state.layout);
    var def = layout.panels[i];
    if (!def) return null;
    var bandH = preview.height * studio.BAND_FRACTION;
    return {
      x: def.x * preview.width,
      y: bandH + def.y * (preview.height - bandH),
      w: def.w * preview.width,
      h: def.h * (preview.height - bandH)
    };
  }

  function panelAtPoint(x, y) {
    var layout = studio.layoutFor(state.layout);
    for (var i = layout.panels.length - 1; i >= 0; i--) {
      var r = panelRect(i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  function ensurePanel(i) {
    if (!state.panels[i]) {
      state.panels[i] = { photo: i % Math.max(1, photos.length), fx: 0.5, fy: studio.FACE_FY, zoom: 1, touched: false };
    }
    return state.panels[i];
  }

  function syncPanelSliders() {
    var p = ensurePanel(selectedPanel);
    var zoom = $('panel-zoom');
    var panX = $('panel-panx');
    var panY = $('panel-pany');
    if (zoom) zoom.value = String(p.zoom || 1);
    if (panX) panX.value = String(p.fx == null ? 0.5 : p.fx);
    if (panY) panY.value = String(p.fy == null ? studio.FACE_FY : p.fy);
    var label = $('panel-label');
    if (label) label.textContent = 'Panel ' + (selectedPanel + 1) + ' of ' + studio.layoutFor(state.layout).panels.length;
  }

  function rebuildPanelControls() {
    var host = $('panel-list');
    if (!host) return;
    host.innerHTML = '';
    var layout = studio.layoutFor(state.layout);
    for (var i = 0; i < layout.panels.length; i++) {
      (function (index) {
        var btn = el('button', 'Panel ' + (index + 1), 'panel-btn' + (index === selectedPanel ? ' active' : ''));
        btn.type = 'button';
        btn.addEventListener('click', function () {
          selectedPanel = index;
          syncPanelSliders();
          rebuildPanelControls();
          requestRender();
        });
        host.appendChild(btn);
      })(i);
    }
    syncPanelSliders();
  }

  function rebuildPhotoSelects() {
    var host = $('photo-selects');
    if (!host) return;
    host.innerHTML = '';
    var layout = studio.layoutFor(state.layout);
    for (var i = 0; i < layout.panels.length; i++) {
      (function (index) {
        var row = el('div', null, 'photo-row');
        row.appendChild(el('label', 'Panel ' + (index + 1) + ' photo'));
        var sel = document.createElement('select');
        sel.setAttribute('data-panel', String(index));
        for (var j = 0; j < photos.length; j++) {
          var opt = document.createElement('option');
          opt.value = String(j);
          opt.textContent = photos[j].label;
          sel.appendChild(opt);
        }
        var p = ensurePanel(index);
        sel.value = String(studio.photoIndexFor(state, index));
        sel.addEventListener('change', function () {
          ensurePanel(index).photo = parseInt(sel.value, 10) || 0;
          state.assign = 'mix';
          syncAssignButtons();
          requestRender();
        });
        row.appendChild(sel);
        host.appendChild(row);
      })(i);
    }
  }

  function syncAssignButtons() {
    var one = $('assign-one');
    var mix = $('assign-mix');
    if (one) one.classList.toggle('active', state.assign === 'one');
    if (mix) mix.classList.toggle('active', state.assign === 'mix');
  }

  function applyLayoutChange() {
    // Keep per-panel crop state where it exists; new panels start at faces.
    var layout = studio.layoutFor(state.layout);
    for (var i = 0; i < layout.panels.length; i++) ensurePanel(i);
    selectedPanel = 0;
    rebuildPanelControls();
    rebuildPhotoSelects();
    requestRender();
  }

  // ------------------------------------------------------------ canvas input

  function canvasPoint(evt) {
    var rect = preview.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (preview.width / rect.width),
      y: (evt.clientY - rect.top) * (preview.height / rect.height)
    };
  }

  function bindCanvasInput() {
    var dragging = false;
    var last = null;
    var dragPanel = -1;

    preview.addEventListener('pointerdown', function (evt) {
      var pt = canvasPoint(evt);
      var hit = panelAtPoint(pt.x, pt.y);
      if (hit < 0) return;
      selectedPanel = hit;
      dragPanel = hit;
      dragging = true;
      last = pt;
      preview.setPointerCapture(evt.pointerId);
      syncPanelSliders();
      rebuildPanelControls();
      requestRender();
    });

    preview.addEventListener('pointermove', function (evt) {
      if (!dragging || dragPanel < 0 || !last) return;
      var pt = canvasPoint(evt);
      var p = ensurePanel(dragPanel);
      var r = panelRect(dragPanel);
      if (!r) return;
      // Drag moves the photo under a fixed frame: focal point shifts
      // opposite the drag, scaled by the panel's draw scale.
      var img = photos[studio.photoIndexFor(state, dragPanel)];
      var iw = img && img.img ? (img.img.naturalWidth || img.img.width) : r.w;
      var ih = img && img.img ? (img.img.naturalHeight || img.img.height) : r.h;
      var z = p.zoom || 1;
      var s = Math.max(r.w / iw, r.h / ih) * z;
      p.fx = clamp((p.fx == null ? 0.5 : p.fx) - (pt.x - last.x) / (s * iw), 0, 1);
      p.fy = clamp((p.fy == null ? studio.FACE_FY : p.fy) - (pt.y - last.y) / (s * ih), 0, 1);
      p.touched = true; // hand-panned: the face lift switches off
      last = pt;
      syncPanelSliders();
      requestRender();
    });

    function endDrag() {
      dragging = false;
      dragPanel = -1;
      last = null;
    }
    preview.addEventListener('pointerup', endDrag);
    preview.addEventListener('pointercancel', endDrag);

    preview.addEventListener('wheel', function (evt) {
      evt.preventDefault();
      var pt = canvasPoint(evt);
      var hit = panelAtPoint(pt.x, pt.y);
      if (hit < 0) hit = selectedPanel;
      var p = ensurePanel(hit);
      p.zoom = clamp((p.zoom || 1) * Math.exp(-evt.deltaY * 0.0012), 1, 3);
      p.touched = true; // hand-zoomed: the face lift switches off
      selectedPanel = hit;
      syncPanelSliders();
      requestRender();
    }, { passive: false });
  }

  // ------------------------------------------------------------ toolbar

  function buildOptions(host, items, current, onPick) {
    if (!host) return;
    host.innerHTML = '';
    items.forEach(function (item) {
      var btn = el('button', item.label, 'opt-btn' + (item.value === current ? ' active' : ''));
      btn.type = 'button';
      btn.addEventListener('click', function () {
        onPick(item.value);
        buildOptions(host, items, item.value, onPick);
      });
      host.appendChild(btn);
    });
  }

  function bindToolbar() {
    var layouts = Object.keys(studio.LAYOUTS).map(function (key) {
      return { value: key, label: studio.LAYOUTS[key].label };
    });
    buildOptions($('layout-options'), layouts, state.layout, function (value) {
      state.layout = value;
      applyLayoutChange();
    });

    var grades = Object.keys(studio.GRADES).map(function (key) {
      return { value: key, label: studio.GRADES[key].label };
    });
    buildOptions($('grade-options'), grades, state.grade, function (value) {
      state.grade = value;
      requestRender();
    });

    var sizes = Object.keys(studio.SIZES).map(function (key) {
      return { value: key, label: key.replace('x', ' × ') };
    });
    buildOptions($('size-options'), sizes, selectedSize, function (value) {
      selectedSize = value;
      requestRender();
    });

    var title = $('title-input');
    if (title) {
      title.value = state.title;
      title.addEventListener('input', function () {
        state.title = title.value.toUpperCase() || 'UNTITLED';
        requestRender();
      });
    }
    var subtitle = $('subtitle-input');
    if (subtitle) {
      subtitle.value = state.subtitle;
      subtitle.addEventListener('input', function () {
        state.subtitle = subtitle.value;
        requestRender();
      });
    }
    var badge = $('badge-input');
    if (badge) {
      badge.value = state.badge;
      badge.addEventListener('input', function () {
        state.badge = badge.value.toUpperCase() || 'VICE CITY';
        requestRender();
      });
    }

    // Star heat meter: click a star to set the heat.
    var stars = $('heat-stars');
    if (stars) {
      for (var i = 1; i <= 5; i++) {
        (function (n) {
          var btn = el('button', '★', 'star-btn' + (n <= state.heat ? ' on' : ''));
          btn.type = 'button';
          btn.setAttribute('aria-label', 'Heat ' + n);
          btn.addEventListener('click', function () {
            state.heat = n;
            var kids = stars.children;
            for (var k = 0; k < kids.length; k++) kids[k].classList.toggle('on', k < n);
            requestRender();
          });
          stars.appendChild(btn);
        })(i);
      }
    }

    var assignOne = $('assign-one');
    if (assignOne) {
      assignOne.addEventListener('click', function () {
        state.assign = 'one';
        syncAssignButtons();
        requestRender();
      });
    }
    var assignMix = $('assign-mix');
    if (assignMix) {
      assignMix.addEventListener('click', function () {
        state.assign = 'mix';
        mixPhotosAcrossPanels();
        rebuildPhotoSelects();
        syncAssignButtons();
        requestRender();
      });
    }

    var upload = $('photo-upload');
    if (upload) {
      upload.addEventListener('change', function () {
        handleFiles(upload.files);
        upload.value = '';
      });
    }
    var samples = $('load-samples');
    if (samples) {
      samples.addEventListener('click', function () {
        loadSamples().catch(function () {});
      });
    }

    var drop = $('drop-zone');
    if (drop) {
      drop.addEventListener('dragover', function (evt) { evt.preventDefault(); });
      drop.addEventListener('drop', function (evt) {
        evt.preventDefault();
        handleFiles(evt.dataTransfer.files);
      });
    }

    var zoom = $('panel-zoom');
    if (zoom) {
      zoom.addEventListener('input', function () {
        var p = ensurePanel(selectedPanel);
        p.zoom = parseFloat(zoom.value) || 1;
        p.touched = true;
        requestRender();
      });
    }
    var panX = $('panel-panx');
    if (panX) {
      panX.addEventListener('input', function () {
        var p = ensurePanel(selectedPanel);
        p.fx = parseFloat(panX.value) || 0;
        p.touched = true;
        requestRender();
      });
    }
    var panY = $('panel-pany');
    if (panY) {
      panY.addEventListener('input', function () {
        var p = ensurePanel(selectedPanel);
        p.fy = parseFloat(panY.value) || 0;
        p.touched = true;
        requestRender();
      });
    }

    var exportBtn = $('export-png');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        exportPNG(selectedSize).catch(function () {});
      });
    }
  }

  // ------------------------------------------------------------ staging

  // ?shot=cover renders one staged cover at export size for screenshots;
  // ?shot=editor stages the editor with photos loaded. Both set
  // window.__ready once fonts, photos and the first render are done, and
  // window.__exportPNG exposes the real export path to the screenshot run.
  function stageShot(params) {
    var shot = params.shot || '';
    if (params.layout && studio.LAYOUTS[params.layout]) state.layout = params.layout;
    if (params.grade && studio.GRADES[params.grade]) state.grade = params.grade;
    if (params.title) state.title = params.title.toUpperCase();
    if (params.subtitle) state.subtitle = params.subtitle;
    if (params.badge) state.badge = params.badge.toUpperCase();
    if (params.heat) state.heat = clamp(parseInt(params.heat, 10) || 0, 0, 5);
    if (params.size && studio.SIZES[params.size]) selectedSize = params.size;
    document.title = 'shot:' + shot;
    if (shot === 'cover') document.body.classList.add('shot-cover');
    return loadSamples().catch(function () {}).then(function () {
      return ensureFonts();
    }).then(function () {
      applyLayoutChange();
      if (shot === 'cover') {
        var dims = studio.SIZES[selectedSize] || studio.SIZES['1920x1080'];
        preview.width = dims[0];
        preview.height = dims[1];
        studio.drawCover(preview, state, photos);
      } else {
        renderPreview();
      }
      window.__ready = true;
    });
  }

  // ------------------------------------------------------------ boot

  function init() {
    preview = $('preview');
    bindToolbar();
    bindCanvasInput();
    rebuildPanelControls();
    rebuildPhotoSelects();
    syncAssignButtons();
    var params = queryParams();
    window.__exportPNG = exportDataURL;
    window.__studio = { state: state, photos: photos, render: requestRender, exportPNG: exportDataURL };
    ensureFonts().then(function () {
      if (params.shot) {
        stageShot(params).catch(function () { window.__ready = true; });
      } else {
        loadSamples().catch(function () {}).then(function () {
          renderPreview();
          window.__ready = true;
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
