(function () {
  'use strict';

  var MODID = 'ViPER4Android-RE-Fork';
  var MODDIR = '/data/adb/modules/' + MODID;
  var CFGDIR = '/data/adb/v4a_re';
  var LS_STATE = 'v4a_re_state', LS_OPEN = 'v4a_re_open', LS_LANG = 'v4a_re_lang';
  var t = window.V4A_T, I18N = window.V4A_I18N;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  var hasKsu = typeof window.ksu !== 'undefined' && typeof window.ksu.exec === 'function';
  var state = V4A.normalize(null);
  var openSet = {};
  var refs = {};   /* key -> {input, val} for refresh */

  /* ------------------------------------------------------------ storage */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ------------------------------------------------------------ shell */
  function exec(cmd) {
    return new Promise(function (resolve, reject) {
      if (!hasKsu) { reject(new Error('no-ksu')); return; }
      var cb = 'v4a_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      window[cb] = function (errno, out, err) { delete window[cb]; resolve({ errno: errno, stdout: out || '', stderr: err || '' }); };
      try { window.ksu.exec(cmd, '{}', cb); } catch (e) { delete window[cb]; reject(e); }
    });
  }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

  /* ------------------------------------------------------------ persist */
  var saveTimer = 0, saving = false, dirty = false;
  function scheduleSave() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, 350); }

  function save() {
    if (saving) { saveTimer = setTimeout(save, 200); return; }
    dirty = false;
    var json = JSON.stringify(state), cmd = V4A.compile(state);
    lsSet(LS_STATE, json);
    if (!hasKsu) return;
    saving = true;
    exec('sh ' + MODDIR + '/scripts/apply.sh ' + b64(json) + ' ' + b64(cmd))
      .then(function () { saving = false; })
      .catch(function () { saving = false; });
  }

  function load() {
    var fromLs = function () { try { return JSON.parse(lsGet(LS_STATE) || 'null'); } catch (e) { return null; } };
    if (!hasKsu) return Promise.resolve(fromLs());
    return exec('cat ' + CFGDIR + '/state.json 2>/dev/null').then(function (r) {
      try { var o = JSON.parse(r.stdout); if (o && typeof o === 'object') return o; } catch (e) { /* fall through */ }
      return null;
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------ helpers */
  function pct(inp) { var p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p + '%'); }
  function dbText(v) { return (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1); }

  function updateMasterNote() {
    $('#masterNote').textContent = t(state.master ? 'master.on' : 'master.off');
    $('#master').checked = state.master;
    document.body.classList.toggle('is-off', !state.master);
  }
  function updateCardOff(g) {
    var c = $('#card-' + g.id); if (c && g.enable) c.classList.toggle('off', !state[g.enable]);
  }

  /* ------------------------------------------------------------ builders */
  function buildSwitch(key, label, onchange) {
    var w = el('label', 'switch'); var i = el('input'); i.type = 'checkbox'; i.checked = !!state[key]; i.setAttribute('aria-label', label);
    w.appendChild(i); var t = el('span', 'track'); t.appendChild(el('span', 'knob')); w.appendChild(t);
    i.addEventListener('change', function () { state[key] = i.checked; if (onchange) onchange(); scheduleSave(); });
    refs[key] = { input: i };
    return w;
  }

  function buildRange(c) {
    var row = el('div', 'ctl'); row.appendChild(el('span', 'lab', t(c.label)));
    var val = el('span', 'val'); row.appendChild(val);
    var f = el('div', 'field'); var i = el('input'); i.type = 'range'; i.min = c.min; i.max = c.max; i.step = c.step; i.value = state[c.k];
    i.setAttribute('aria-label', t(c.label)); f.appendChild(i); row.appendChild(f);
    var upd = function () { val.textContent = c.fmt(Number(i.value)); pct(i); };
    i.addEventListener('input', function () { state[c.k] = Number(i.value); upd(); scheduleSave(); });
    refs[c.k] = { input: i, upd: upd, row: row }; upd();
    return row;
  }

  function buildSelect(c) {
    var row = el('div', 'ctl'); row.appendChild(el('span', 'lab', t(c.label))); row.appendChild(el('span'));
    var f = el('div', 'field'); var s = el('select'); s.setAttribute('aria-label', t(c.label));
    c.opts.forEach(function (o) { var op = el('option', null, t(o[1])); op.value = o[0]; s.appendChild(op); });
    s.value = state[c.k]; f.appendChild(s); row.appendChild(f);
    s.addEventListener('change', function () {
      state[c.k] = Number(s.value);
      if (c.k === 'eq_preset' && state.eq_preset !== 99) { state.eq_bands = V4A.EQ_PRESETS[state.eq_preset][1].slice(); refreshEq(); }
      scheduleSave();
    });
    refs[c.k] = { input: s };
    return row;
  }

  var eqBands = [];
  function refreshEq() { eqBands.forEach(function (b) { b.set(); }); }

  function buildEq(c) {
    var wrap = el('div', 'eq'); wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', 'Equalizer');
    var range = c.max - c.min;
    V4A.EQ_FREQS.forEach(function (hz, idx) {
      var b = el('div', 'band'); b.tabIndex = 0; b.setAttribute('role', 'slider');
      b.setAttribute('aria-label', hz + ' Hz'); b.setAttribute('aria-valuemin', c.min); b.setAttribute('aria-valuemax', c.max);
      var db = el('div', 'db'), rail = el('div', 'rail'), fill = el('div', 'fill'), dot = el('div', 'dot');
      rail.appendChild(fill); rail.appendChild(dot); b.appendChild(db); b.appendChild(rail); b.appendChild(el('div', 'hz', hz));
      var set = function () {
        var v = state.eq_bands[idx], y = (c.max - v) / range * 100;
        dot.style.top = y + '%'; db.textContent = dbText(v); b.setAttribute('aria-valuenow', v);
        fill.style.top = Math.min(y, 50) + '%'; fill.style.height = Math.abs(y - 50) + '%';
      };
      var apply = function (v) {
        v = Math.max(c.min, Math.min(c.max, Math.round(v / c.step) * c.step));
        if (v === state.eq_bands[idx]) return;
        state.eq_bands[idx] = v; state.eq_preset = 99; if (refs.eq_preset) refs.eq_preset.input.value = 99;
        set(); scheduleSave();
      };
      var fromEvent = function (e) { var r = rail.getBoundingClientRect(); apply(c.max - (e.clientY - r.top) / r.height * range); };
      var drag = false;
      b.addEventListener('pointerdown', function (e) { drag = true; try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } fromEvent(e); e.preventDefault(); });
      b.addEventListener('pointermove', function (e) { if (drag) fromEvent(e); });
      var end = function () { drag = false; };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('dblclick', function () { apply(0); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? c.step : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -c.step : 0;
        if (d) { apply(state.eq_bands[idx] + d); e.preventDefault(); }
      });
      eqBands.push({ set: set }); set(); wrap.appendChild(b);
    });
    return wrap;
  }

  function buildCheck(c) {
    var row = el('div', 'ctl'); row.appendChild(el('span', 'lab', t(c.label)));
    row.appendChild(buildSwitch(c.k, t(c.label), updateDeps));
    return row;
  }

  function buildFile(c) {
    var row = el('div', 'ctl'); row.appendChild(el('span', 'lab', t(c.label)));
    var st = el('span', 'val small'); row.appendChild(st);
    var f = el('div', 'field'), line = el('div', 'filerow'), s = el('select');
    var btn = el('button', 'tonal small', t('btn.refresh')); btn.type = 'button';
    s.setAttribute('aria-label', t(c.label)); line.appendChild(s); line.appendChild(btn); f.appendChild(line);
    f.appendChild(el('p', 'note small', t('file.hint.' + c.kind))); row.appendChild(f);
    var fill = function (names) {
      s.textContent = '';
      var none = el('option', null, t('file.none')); none.value = ''; s.appendChild(none);
      if (state[c.k] && names.indexOf(state[c.k]) < 0) names.unshift(state[c.k]);
      names.forEach(function (n) { var o = el('option', null, n); o.value = n; s.appendChild(o); });
      s.value = state[c.k] || '';
    };
    var refresh = function () {
      if (!hasKsu) { fill([]); return; }
      exec('sh ' + MODDIR + '/scripts/list.sh ' + c.kind).then(function (r) {
        fill(r.stdout.split('\n').map(function (x) { return x.trim(); }).filter(Boolean));
      }).catch(function () { fill([]); });
    };
    s.addEventListener('change', function () {
      var name = s.value;
      if (!name) { state[c.k] = ''; st.textContent = ''; scheduleSave(); return; }
      if (!hasKsu) { state[c.k] = name; state[c.tok] = Date.now() % 2000000000; scheduleSave(); return; }
      st.textContent = t('file.busy');
      exec('sh ' + MODDIR + '/scripts/import.sh ' + c.kind + ' ' + b64(name)).then(function (r) {
        if (r.errno === 0) { state[c.k] = name; state[c.tok] = Date.now() % 2000000000; st.textContent = t('file.ok'); scheduleSave(); }
        else { st.textContent = t('file.fail'); s.value = state[c.k] || ''; }
      }).catch(function () { st.textContent = t('file.fail'); s.value = state[c.k] || ''; });
    });
    btn.addEventListener('click', refresh);
    refs[c.k] = { input: s };
    fill(state[c.k] ? [state[c.k]] : []);
    refresh();
    return row;
  }

  function updateDeps() {
    V4A.GROUPS.forEach(function (g) {
      g.controls.forEach(function (c) {
        if (!c.off || !refs[c.k]) return;
        var dim = !!state[c.off];
        refs[c.k].row.classList.toggle('dim', dim);
        refs[c.k].input.disabled = dim;
      });
    });
  }

  function buildGroup(g) {
    var card = el('section', 'card'); card.id = 'card-' + g.id;
    var head = el('div', 'head');
    var title = el('button', 'title'); title.type = 'button'; title.setAttribute('aria-expanded', 'false');
    title.appendChild(el('span', 'name', t(g.title))); title.appendChild(el('span', 'hint', t(g.hint)));
    head.appendChild(title);
    if (g.enable) head.appendChild(buildSwitch(g.enable, g.title, function () { updateCardOff(g); }));
    var chev = el('span', 'chev'); head.appendChild(chev);
    card.appendChild(head);
    var body = el('div', 'body');
    if (!g.controls.length) body.appendChild(el('p', 'empty', t('empty')));
    g.controls.forEach(function (c) {
      body.appendChild(c.t === 'range' ? buildRange(c) : c.t === 'select' ? buildSelect(c) : c.t === 'check' ? buildCheck(c) : c.t === 'file' ? buildFile(c) : buildEq(c));
    });
    card.appendChild(body);
    var toggle = function () {
      var o = !card.classList.contains('open'); card.classList.toggle('open', o); title.setAttribute('aria-expanded', o);
      openSet[g.id] = o; lsSet(LS_OPEN, JSON.stringify(openSet));
    };
    title.addEventListener('click', toggle); chev.addEventListener('click', toggle);
    if (openSet[g.id]) { card.classList.add('open'); title.setAttribute('aria-expanded', 'true'); }
    updateCardOff(g);
    return card;
  }

  function applyStatic() {
    document.documentElement.lang = I18N.get();
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    var seg = $('#langSeg'); seg.textContent = '';
    I18N.langs.forEach(function (l) {
      var b = el('button', null, l[1]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', I18N.get() === l[0]);
      b.addEventListener('click', function () { setLang(l[0]); });
      seg.appendChild(b);
    });
    updateMasterNote();
  }
  function setLang(l) {
    if (I18N.get() === l) return;
    I18N.set(l); state.lang = l; lsSet(LS_LANG, l);
    applyStatic(); render(); scheduleSave();
  }

  function render() {
    var app = $('#app'); app.textContent = ''; refs = {}; eqBands = [];
    V4A.GROUPS.forEach(function (g) { app.appendChild(buildGroup(g)); });
    updateDeps();
    updateMasterNote();
  }

  /* ------------------------------------------------------------ actions */
  function statusReport() {
    var out = $('#statusOut'); out.hidden = false; out.textContent = t('diag.busy');
    if (!hasKsu) { out.textContent = t('diag.preview'); return; }
    exec('sh ' + MODDIR + '/scripts/status.sh ' + I18N.get()).then(function (r) { out.textContent = (r.stdout || r.stderr || t('diag.none')).trim(); })
      .catch(function () { out.textContent = t('diag.fail'); });
  }

  var resetArmed = 0;
  function resetAll() {
    var b = $('#btnReset');
    if (!resetArmed) {
      b.textContent = t('btn.reset2'); b.classList.add('armed');
      resetArmed = setTimeout(function () { resetArmed = 0; b.textContent = t('btn.reset'); b.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = 0; b.textContent = t('btn.reset'); b.classList.remove('armed');
    var keep = state.lang; state = V4A.normalize(null); state.lang = keep; render(); save();
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    try { openSet = JSON.parse(lsGet(LS_OPEN) || '{}') || {}; } catch (e) { openSet = {}; }
    $('#master').addEventListener('change', function () { state.master = $('#master').checked; updateMasterNote(); scheduleSave(); });
    $('#btnStatus').addEventListener('click', statusReport);
    $('#btnReset').addEventListener('click', resetAll);
    window.addEventListener('pagehide', function () { if (dirty) { clearTimeout(saveTimer); save(); } });
    load().then(function (o) {
      state = V4A.normalize(o);
      var l = state.lang || lsGet(LS_LANG) || I18N.detect();
      I18N.set(l); state.lang = I18N.get();
      applyStatic(); render();
    });
  }
  boot();
})();
