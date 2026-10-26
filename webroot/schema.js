/*
 * schema.js - control definitions + compiler for ViPER4Android RE WebUI.
 *
 * compile(state) -> text of /data/adb/v4a_re/viper.cmd, read by the driver shim.
 * Parameter ids / scalings were verified against the shipped libv4a_re binary
 * (ViPER::DispatchCommand jump table) and by processing audio through it.
 *
 * Headphone surround (VHE), convolver, DDC, the FET compressor and AGC are
 * empty stubs in the ViPERFX_RE core; the shim implements them itself and they
 * are driven by the "x ..." lines of the command file.
 */
(function (root) {
  'use strict';

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var round = Math.round;
  var dbToPct = function (db) { return round(100 * Math.pow(10, db / 20)); };
  var gainDb = function (i) { return (20 * Math.log10(1 + i * 0.5)); };
  var fixed = function (n, d) { return Number(n).toFixed(d); };
  var t = function (k, v) { return (typeof window !== 'undefined' && window.V4A_T) ? window.V4A_T(k, v) : k; };

  /* ---- presets from the original ViPER4Android app ---- */
  var EQ_FREQS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  var EQ_PRESETS = [
    ['Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ['Acoustic', [4.5, 4.5, 3.5, 1.2, 1.0, 0.5, 1.4, 1.75, 3.5, 2.5]],
    ['Bass Booster', [10, 6.5, 4, 0, 0, 0, 0, 0, 0, 0]],
    ['Bass Reducer', [-10.5, -6.5, -4, 0, 0, 0, 0, 0, 0, 0]],
    ['Classical', [4, 4, 3.25, 1, 0, 0, -1, -0.5, 2, 3.5]],
    ['Deep', [4, 4, 0.5, 0, 0, 0, 0, 1.5, -4, -4.5]],
    ['R&B', [5.5, 5.5, 3.5, 0, 0, 0, 0, -1.75, 1.5, 2.5]],
    ['Rock', [4.5, 4.5, 2.75, 0, 0, 0, 0, -0.5, 2.75, 4]],
    ['Small Speakers', [6.5, 6.5, 4, 0, 0, 0, 0, 0, -6.5, -4]],
    ['Treble Booster', [0, 0, 0, 0, 0, 0, 0, 0, 4, 6.5]],
    ['Treble Reducer', [0, 0, 0, 0, 0, 0, 0, 0, -6.5, -4]],
    ['Vocal Booster', [-2.5, -2.5, 0, 0, 0, 0, 0.6, 3.5, 1.5, -2]],
    /* KZ EDX Pro X matched to the CVJ Kira curve (measured difference, fitted through the real core) */
    ['KZ EDX Pro X \u2192 CVJ Kira', [-3.5, -1, 1, 1, 0, -2.5, -2.5, 0.5, -9, 0.5]]
  ];

  /* x low;x high;y low;y high;side x;side y */
  var DS_DEVICES = [
    ['Extreme Headphone (v2)', [140, 6200, 40, 60, 10, 80]],
    ['High-end Headphone (v2)', [180, 5800, 55, 80, 10, 70]],
    ['Common Headphone (v2)', [300, 5600, 60, 105, 10, 50]],
    ['Low-end Headphone (v2)', [600, 5400, 60, 105, 10, 20]],
    ['Common Earphone (v2)', [100, 5600, 40, 80, 50, 50]],
    ['Extreme Headphone (v1)', [1200, 6200, 40, 80, 0, 20]],
    ['High-end Headphone (v1)', [1000, 6200, 40, 80, 0, 10]],
    ['Common Headphone (v1)', [800, 6200, 40, 80, 10, 0]],
    ['Common Earphone (v1)', [400, 6200, 40, 80, 10, 0]],
    ['Apple Earphone', [1200, 6200, 50, 90, 15, 10]],
    ['Monster Earphone', [1000, 6200, 50, 90, 30, 10]],
    ['Moto Earphone', [1100, 6200, 60, 100, 20, 0]],
    ['Philips Earphone', [1200, 6200, 50, 100, 10, 50]],
    ['SHP2000', [1200, 6200, 60, 100, 0, 30]],
    ['SHP9000', [1200, 6200, 40, 80, 0, 30]],
    ['Unknown Type I', [1000, 6200, 60, 100, 0, 0]],
    ['Unknown Type II', [1000, 6200, 60, 120, 0, 0]],
    ['Unknown Type III', [1000, 6200, 80, 140, 0, 0]],
    ['Unknown Type IV', [800, 6200, 80, 140, 0, 0]]
  ];

  /* widening;depth pairs (field surround) */
  var FS_LEVELS = [[120, 200], [130, 275], [140, 350], [150, 425], [160, 500], [170, 575], [180, 650], [190, 725], [200, 800]];
  var fsName = function (i) { return i === 0 ? t('v.subtle') : i === 8 ? t('v.extreme') : t('v.level', { n: i }); };

  var opts = function (list) { return list.map(function (n, i) { return [i, n]; }); };

  /* ---- UI definition ---- */
  var GROUPS = [
    {
      id: 'out', title: 'Output', hint: 'g.out.hint',
      controls: [
        { k: 'out_vol', t: 'range', min: -20, max: 6, step: 0.5, def: 0, label: 'c.out_vol', fmt: function (v) { return (v > 0 ? '+' : '') + fixed(v, 1) + ' dB'; } },
        { k: 'out_pan', t: 'range', min: -100, max: 100, step: 5, def: 0, label: 'c.out_pan', fmt: function (v) { return v === 0 ? t('v.center') : (v < 0 ? t('v.left', { n: -v }) : t('v.right', { n: v })); } },
        { k: 'out_lim', t: 'range', min: -10.5, max: 0, step: 0.5, def: 0, label: 'c.out_lim', fmt: function (v) { return fixed(v, 1) + ' dB'; } }
      ]
    },
    {
      id: 'eq', title: 'Equalizer', hint: 'g.eq.hint', enable: 'eq_on',
      controls: [
        { k: 'eq_preset', t: 'select', label: 'c.eq_preset', def: 0, opts: EQ_PRESETS.map(function (p, i) { return [i, p[0]]; }).concat([[99, 'o.custom']]) },
        { k: 'eq_bands', t: 'eq', label: 'c.eq_bands', def: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], min: -12, max: 12, step: 0.5 }
      ]
    },
    {
      id: 'bass', title: 'Bass', hint: 'g.bass.hint', enable: 'bass_on',
      controls: [
        { k: 'bass_mode', t: 'select', label: 'c.bass_mode', def: 0, opts: [[0, 'Natural Bass'], [1, 'Pure Bass+'], [2, 'Subwoofer']] },
        { k: 'bass_freq', t: 'range', min: 30, max: 100, step: 1, def: 80, label: 'c.bass_freq', fmt: function (v) { return v + ' Hz'; } },
        { k: 'bass_gain', t: 'range', min: 1, max: 12, step: 1, def: 6, label: 'c.bass_gain', fmt: function (v) { return '+' + fixed(gainDb(v), 1) + ' dB'; } }
      ]
    },
    {
      id: 'clar', title: 'Clarity', hint: 'g.clar.hint', enable: 'clar_on',
      controls: [
        { k: 'clar_mode', t: 'select', label: 'c.clar_mode', def: 0, opts: [[0, 'Natural'], [1, 'OZone+'], [2, 'XHiFi']] },
        { k: 'clar_gain', t: 'range', min: 0, max: 9, step: 1, def: 3, label: 'c.clar_gain', fmt: function (v) { return v === 0 ? t('v.default') : '+' + fixed(gainDb(v), 1) + ' dB'; } }
      ]
    },
    {
      id: 'dyn', title: 'Dynamic System', hint: 'g.dyn.hint', enable: 'dyn_on',
      controls: [
        { k: 'dyn_dev', t: 'select', label: 'c.dyn_dev', def: 2, opts: opts(DS_DEVICES.map(function (d) { return d[0]; })) },
        { k: 'dyn_str', t: 'range', min: 0, max: 100, step: 5, def: 50, label: 'c.dyn_str', fmt: function (v) { return v + '%'; } }
      ]
    },
    {
      id: 'vhe', title: 'Headphone Surround', hint: 'g.vhe.hint', enable: 'vhe_on',
      controls: [
        { k: 'vhe_lvl', t: 'select', label: 'c.vhe_lvl', def: 0, opts: [[0, 'Level 1'], [1, 'Level 2'], [2, 'Level 3'], [3, 'Level 4'], [4, 'Level 5']] }
      ]
    },
    {
      id: 'fs', title: 'Field Surround', hint: 'g.fs.hint', enable: 'fs_on',
      controls: [
        { k: 'fs_wide', t: 'range', min: 0, max: 8, step: 1, def: 3, label: 'c.fs_wide', fmt: function (v) { return fsName(v); } },
        { k: 'fs_mid', t: 'range', min: 0, max: 10, step: 1, def: 5, label: 'c.fs_mid', fmt: function (v) { return t('v.level', { n: v }); } }
      ]
    },
    {
      id: 'ds', title: 'Differential Surround', hint: 'g.ds.hint', enable: 'ds_on',
      controls: [
        { k: 'ds_delay', t: 'range', min: 2, max: 20, step: 1, def: 5, label: 'c.ds_delay', fmt: function (v) { return v + ' ms'; } }
      ]
    },
    {
      id: 'cure', title: 'Crossfeed', hint: 'g.cure.hint', enable: 'cure_on',
      controls: [
        { k: 'cure_lvl', t: 'select', label: 'c.cure_lvl', def: 0, opts: [[0, 'o.light'], [1, 'o.medium'], [2, 'o.strong']] }
      ]
    },
    {
      id: 'rev', title: 'Reverb', hint: 'g.rev.hint', enable: 'rev_on',
      controls: [
        { k: 'rev_size', t: 'range', min: 0, max: 100, step: 5, def: 50, label: 'c.rev_size', fmt: function (v) { return v + '%'; } },
        { k: 'rev_width', t: 'range', min: 0, max: 100, step: 5, def: 70, label: 'c.rev_width', fmt: function (v) { return v + '%'; } },
        { k: 'rev_damp', t: 'range', min: 0, max: 100, step: 5, def: 30, label: 'c.rev_damp', fmt: function (v) { return v + '%'; } },
        { k: 'rev_wet', t: 'range', min: 0, max: 100, step: 5, def: 40, label: 'c.rev_wet', fmt: function (v) { return v + '%'; } },
        { k: 'rev_dry', t: 'range', min: 0, max: 100, step: 5, def: 50, label: 'c.rev_dry', fmt: function (v) { return v + '%'; } }
      ]
    },
    {
      id: 'conv', title: 'Convolver', hint: 'g.conv.hint', enable: 'conv_on',
      controls: [
        { k: 'conv_file', t: 'file', kind: 'ir', tok: 'conv_tok', label: 'c.conv_file', def: '' },
        { k: 'conv_gain', t: 'range', min: -20, max: 20, step: 1, def: 0, label: 'c.conv_gain', fmt: function (v) { return (v > 0 ? '+' : '') + v + ' dB'; } }
      ]
    },
    {
      id: 'ddc', title: 'ViPER-DDC', hint: 'g.ddc.hint', enable: 'ddc_on',
      controls: [
        { k: 'ddc_file', t: 'file', kind: 'ddc', tok: 'ddc_tok', label: 'c.ddc_file', def: '' }
      ]
    },
    {
      id: 'fet', title: 'Compressor', hint: 'g.fet.hint', enable: 'fet_on',
      controls: [
        { k: 'fet_thr', t: 'range', min: -60, max: 0, step: 1, def: -24, label: 'c.fet_thr', fmt: function (v) { return v + ' dB'; } },
        { k: 'fet_ratio', t: 'range', min: 1, max: 20, step: 0.5, def: 4, label: 'c.fet_ratio', fmt: function (v) { return fixed(v, 1) + ' : 1'; } },
        { k: 'fet_knee', t: 'range', min: 0, max: 24, step: 1, def: 6, label: 'c.fet_knee', fmt: function (v) { return v + ' dB'; } },
        { k: 'fet_att', t: 'range', min: 1, max: 100, step: 1, def: 10, label: 'c.fet_att', fmt: function (v) { return v + ' ms'; } },
        { k: 'fet_rel', t: 'range', min: 20, max: 1000, step: 10, def: 200, label: 'c.fet_rel', fmt: function (v) { return v + ' ms'; } },
        { k: 'fet_auto', t: 'check', def: true, label: 'c.fet_auto' },
        { k: 'fet_makeup', t: 'range', min: 0, max: 24, step: 0.5, def: 0, label: 'c.fet_makeup', fmt: function (v) { return '+' + fixed(v, 1) + ' dB'; }, off: 'fet_auto' }
      ]
    },
    {
      id: 'agc', title: 'Auto Gain', hint: 'g.agc.hint', enable: 'agc_on',
      controls: [
        { k: 'agc_str', t: 'range', min: 0, max: 100, step: 5, def: 50, label: 'c.agc_str', fmt: function (v) { return v + '%'; } },
        { k: 'agc_target', t: 'range', min: -30, max: -10, step: 1, def: -18, label: 'c.agc_target', fmt: function (v) { return v + ' dB'; } },
        { k: 'agc_max', t: 'range', min: 0, max: 18, step: 1, def: 9, label: 'c.agc_max', fmt: function (v) { return '+' + v + ' dB'; } }
      ]
    },
    {
      id: 'vse', title: 'Spectrum Extension', hint: 'g.vse.hint', enable: 'vse_on',
      controls: [
        { k: 'vse_str', t: 'range', min: 1, max: 10, step: 1, def: 6, label: 'c.vse_str', fmt: function (v) { return v * 10 + '%'; } }
      ]
    },
    { id: 'tube', title: 'Tube Simulator', hint: 'g.tube.hint', enable: 'tube_on', controls: [] },
    {
      id: 'ax', title: 'AnalogX', hint: 'g.ax.hint', enable: 'ax_on',
      controls: [
        { k: 'ax_mode', t: 'select', label: 'c.ax_mode', def: 0, opts: [[0, 'o.light'], [1, 'o.medium'], [2, 'o.strong']] }
      ]
    },
    { id: 'spk', title: 'Speaker Optimization', hint: 'g.spk.hint', enable: 'spk_on', controls: [] }
  ];

  /* ---- defaults ---- */
  var DEFAULTS = { v: 2, master: false, lang: null };
  /* defaults of state v1: values still equal to these were never touched, so they move to the new defaults */
  var OLD_DEF = { bass_freq: 60, bass_gain: 2, clar_gain: 1, dyn_str: 0, fs_wide: 0, rev_size: 40, rev_width: 60, rev_wet: 15, vse_str: 1 };
  GROUPS.forEach(function (g) {
    if (g.enable) DEFAULTS[g.enable] = false;
    g.controls.forEach(function (c) { DEFAULTS[c.k] = Array.isArray(c.def) ? c.def.slice() : c.def; if (c.tok) DEFAULTS[c.tok] = 0; });
  });

  /* ---- sanitise state loaded from disk ---- */
  function normalize(src) {
    var s = {};
    src = src && typeof src === 'object' ? src : {};
    if ((Number(src.v) || 1) < 2) { var o = {}; Object.keys(src).forEach(function (k) { if (!(k in OLD_DEF) || Number(src[k]) !== OLD_DEF[k]) o[k] = src[k]; }); src = o; }
    Object.keys(DEFAULTS).forEach(function (k) { s[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k]; });
    s.master = src.master === true;
    s.lang = src.lang === 'id' || src.lang === 'en' ? src.lang : null;
    GROUPS.forEach(function (g) {
      if (g.enable) s[g.enable] = src[g.enable] === true;
      g.controls.forEach(function (c) {
        var v = src[c.k];
        if (c.t === 'range') {
          v = Number(v);
          if (isFinite(v)) { v = clamp(v, c.min, c.max); s[c.k] = round(v / c.step) * c.step; }
        } else if (c.t === 'select') {
          v = Number(v);
          if (c.opts.some(function (o) { return o[0] === v; })) s[c.k] = v;
        } else if (c.t === 'check') {
          if (typeof v === 'boolean') s[c.k] = v;
        } else if (c.t === 'file') {
          if (typeof v === 'string' && v.length <= 160 && !/[\/\n\r\0]/.test(v) && v.indexOf('..') < 0) s[c.k] = v;
          var tk = Number(src[c.tok]);
          if (isFinite(tk) && tk >= 0 && tk < 2147483000) s[c.tok] = Math.floor(tk);
        } else if (c.t === 'eq') {
          if (Array.isArray(v) && v.length === 10) {
            s[c.k] = v.map(function (x) { x = Number(x); return isFinite(x) ? clamp(round(x / c.step) * c.step, c.min, c.max) : 0; });
          }
        }
      });
    });
    return s;
  }

  /* ---- compile to the shim's command file ---- */
  var ID = {
    EQ_ON: 0x1000F, EQ_BAND: 0x10010,
    FS_ON: 0x10011, FS_WIDE: 0x10012, FS_MID: 0x10013, FS_DEPTH: 0x10014,
    DS_ON: 0x10015, DS_DELAY: 0x10016,
    REV_ON: 0x10017, REV_SIZE: 0x10018, REV_WIDTH: 0x10019, REV_DAMP: 0x1001A, REV_WET: 0x1001B, REV_DRY: 0x1001C,
    DYN_ON: 0x10021, DYN_X: 0x10022, DYN_Y: 0x10023, DYN_SIDE: 0x10024, DYN_STR: 0x10025,
    BASS_ON: 0x10026, BASS_MODE: 0x10027, BASS_FREQ: 0x10028, BASS_GAIN: 0x10029,
    CLAR_ON: 0x1002A, CLAR_MODE: 0x1002B, CLAR_GAIN: 0x1002C,
    CURE_ON: 0x1002D, CURE_LVL: 0x1002E, TUBE_ON: 0x1002F, AX_ON: 0x10030, AX_MODE: 0x10031,
    OUT_VOL: 0x10032, OUT_PAN: 0x10033, OUT_LIM: 0x10034,
    VSE_ON: 0x1000C, VSE_BARK: 0x1000D, VSE_EXC: 0x1000E,
    SPK_ON: 0x10043,
    /* unsupported in this core build: always forced off */
    VHE_ON: 0x10008, DDC_ON: 0x1000A, AGC_ON: 0x1001D
  };

  function commands(s) {
    var out = [];
    var P = function (id) { out.push([id].concat([].slice.call(arguments, 1))); };
    var b = function (x) { return x ? 1 : 0; };

    P(ID.OUT_VOL, clamp(dbToPct(s.out_vol), 1, 200));
    P(ID.OUT_PAN, round(s.out_pan));
    P(ID.OUT_LIM, clamp(dbToPct(s.out_lim), 30, 100));

    s.eq_bands.forEach(function (db, i) { P(ID.EQ_BAND, i, round(db * 100)); });
    P(ID.EQ_ON, b(s.eq_on));

    P(ID.BASS_MODE, s.bass_mode);
    P(ID.BASS_FREQ, round(s.bass_freq));
    P(ID.BASS_GAIN, round(s.bass_gain * 50));
    P(ID.BASS_ON, b(s.bass_on));

    P(ID.CLAR_MODE, s.clar_mode);
    P(ID.CLAR_GAIN, round(s.clar_gain * 50));
    P(ID.CLAR_ON, b(s.clar_on));

    var d = DS_DEVICES[s.dyn_dev][1];
    P(ID.DYN_X, d[0], d[1]);
    P(ID.DYN_Y, d[2], d[3]);
    P(ID.DYN_SIDE, d[4], d[5]);
    P(ID.DYN_STR, round(s.dyn_str) * 20 + 100);
    P(ID.DYN_ON, b(s.dyn_on));

    var fs = FS_LEVELS[s.fs_wide];
    P(ID.FS_WIDE, fs[0]);
    P(ID.FS_DEPTH, fs[1]);
    P(ID.FS_MID, 100 + round(s.fs_mid) * 10);
    P(ID.FS_ON, b(s.fs_on));

    P(ID.DS_DELAY, round(s.ds_delay) * 100);
    P(ID.DS_ON, b(s.ds_on));

    P(ID.CURE_LVL, s.cure_lvl);
    P(ID.CURE_ON, b(s.cure_on));

    P(ID.REV_SIZE, round(s.rev_size));
    P(ID.REV_WIDTH, round(s.rev_width));
    P(ID.REV_DAMP, round(s.rev_damp));
    P(ID.REV_WET, round(s.rev_wet));
    P(ID.REV_DRY, round(s.rev_dry));
    P(ID.REV_ON, b(s.rev_on));

    P(ID.VSE_BARK, 7600);
    P(ID.VSE_EXC, round(s.vse_str * 56));
    P(ID.VSE_ON, b(s.vse_on));

    P(ID.TUBE_ON, b(s.tube_on));
    P(ID.AX_MODE, s.ax_mode);
    P(ID.AX_ON, b(s.ax_on));
    P(ID.SPK_ON, b(s.spk_on));

    P(ID.VHE_ON, 0);
    P(ID.DDC_ON, 0);
    P(ID.AGC_ON, 0);
    return out;
  }

  function compile(state) {
    var s = normalize(state);
    var lines = ['# ViPER4Android RE WebUI - generated, do not edit', 'format 1', 'master ' + (s.master ? 1 : 0)];
    commands(s).forEach(function (c) {
      lines.push('s 0x' + c[0].toString(16).toUpperCase() + ' ' + c.slice(1).join(' '));
    });
    var b1 = function (x) { return x ? 1 : 0; };
    lines.push('x vhe ' + b1(s.vhe_on) + ' ' + s.vhe_lvl);
    lines.push('x conv ' + b1(s.conv_on && s.conv_file) + ' ' + s.conv_tok + ' ' + round(s.conv_gain * 10));
    lines.push('x ddc ' + b1(s.ddc_on && s.ddc_file) + ' ' + s.ddc_tok);
    lines.push('x fet ' + [b1(s.fet_on), round(s.fet_thr * 10), round(s.fet_ratio * 10), round(s.fet_knee * 10), round(s.fet_att * 10),
      round(s.fet_rel), round(s.fet_makeup * 10), b1(s.fet_auto)].join(' '));
    lines.push('x agc ' + [b1(s.agc_on), round(s.agc_str), round(s.agc_target * 10), round(s.agc_max * 10)].join(' '));
    return lines.join('\n') + '\n';
  }

  var api = {
    GROUPS: GROUPS, DEFAULTS: DEFAULTS, EQ_FREQS: EQ_FREQS, EQ_PRESETS: EQ_PRESETS,
    DS_DEVICES: DS_DEVICES, normalize: normalize, compile: compile, commands: commands
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.V4A = api;
})(typeof window !== 'undefined' ? window : this);
