/**
 * Kalapati mascot: draggable, flying, minimizable chat launcher.
 * Plain TypeScript-friendly JavaScript with no dependencies. It draws only the mascot
 * (plus feathers, shadow, speech bubble and minimize button). It has NO chat UI, so you
 * connect it to your own chat panel with onStateChange and setState.
 *
 *   const kal = createKalapati({
 *     getPanelRect: () => chatEl.getBoundingClientRect(),   // where he perches while chat is open
 *     onStateChange: (s) => setChatOpen(s === 'chat'),       // 'docked' | 'min' | 'chat'
 *   });
 *   kal.setState('docked');   // call this when your chat closes
 *   kal.setPose('thinking');  // 'idle' | 'thinking' | 'talking' | 'happy' | 'waving'
 *   kal.destroy();
 */
export function createKalapati(opts) {
  opts = opts || {};
  var doc = document, win = window;
  /* ---------- mascot drawing ---------- */
  var Kalapati = (function () {
  var INK = '#0F172A', BODY = '#F8FAFC', SHADE = '#E2E8F0', GOLD = '#F59E0B', BLUE = '#2563EB';
  var SIL = 'M120 46 C150 46 168 68 168 94 C168 104 166 110 172 120 C184 140 182 176 160 192 C146 202 132 205 120 205 C108 205 94 202 80 192 C58 176 56 140 68 120 C74 110 72 104 72 94 C72 68 90 46 120 46 Z';
  var WING = '<path d="M4 -4 C-14 -2 -32 16 -32 40 C-32 56 -22 66 -10 62 C0 58 8 40 8 18 C8 8 6 0 4 -4 Z" fill="' + BODY + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M-24 48 Q-16 52 -7 46 M-27 34 Q-17 38 -5 32" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>';
  var EYE = function (x) {
    return '<g data-part="eye" data-cx="' + x + '"><ellipse cx="' + x + '" cy="96" rx="7.5" ry="9.5" fill="' + INK + '"/>' +
      '<circle cx="' + (x + 2.6) + '" cy="92.5" r="2.7" fill="#FFFFFF"/><circle cx="' + (x - 2.2) + '" cy="99.5" r="1.2" fill="#FFFFFF"/></g>';
  };
  var STAR = function (x, y, s) {
    return '<path data-part="star" transform="translate(' + x + ' ' + y + ')" d="M0 -' + s + ' Q1.5 -1.5 ' + s + ' 0 Q1.5 1.5 0 ' + s + ' Q-1.5 1.5 -' + s + ' 0 Q-1.5 -1.5 0 -' + s + ' Z" fill="' + GOLD + '"/>';
  };
  var n = 0;
  function markup(p) {
    return '<svg viewBox="0 0 240 240" role="img" aria-label="Kalapati, the Parish Assistant dove" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="' + p + '-clip"><path d="' + SIL + '"/></clipPath>' +
      '<filter id="' + p + '-glow" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
      '<g data-layer="sparkles" opacity="0">' + STAR(46, 70, 8) + STAR(196, 92, 6) + STAR(56, 168, 5) + STAR(190, 160, 7) + '</g>' +
      '<g data-layer="thought" opacity="0">' +
        '<circle data-part="dot" cx="172" cy="66" r="4" fill="' + BLUE + '" opacity=".35"/>' +
        '<circle data-part="dot" cx="186" cy="50" r="6" fill="' + BLUE + '" opacity=".5"/>' +
        '<circle data-part="dot" cx="204" cy="30" r="8.5" fill="' + BLUE + '" opacity=".7"/></g>' +
      '<g data-part="root">' +
        '<g data-layer="halo"><g data-part="halo-move">' +
          '<ellipse data-part="halo-glow" cx="120" cy="28" rx="28" ry="7" fill="none" stroke="' + GOLD + '" stroke-width="7" filter="url(#' + p + '-glow)"/>' +
          '<ellipse cx="120" cy="28" rx="28" ry="7" fill="none" stroke="' + GOLD + '" stroke-width="4.5"/></g></g>' +
        '<g data-layer="tail"><path d="M150 184 L184 200 Q190 190 181 181 L189 175 Q182 164 166 168 Z" fill="' + SHADE + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/></g>' +
        '<g data-layer="feet"><g data-part="feet"><ellipse cx="106" cy="206" rx="8" ry="3.6" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2.4"/><ellipse cx="134" cy="206" rx="8" ry="3.6" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2.4"/></g></g>' +
        '<g data-layer="body"><path d="' + SIL + '" fill="' + BODY + '"/>' +
          '<g clip-path="url(#' + p + '-clip)"><ellipse cx="146" cy="178" rx="54" ry="42" fill="' + SHADE + '"/><ellipse cx="160" cy="92" rx="14" ry="30" fill="' + SHADE + '" opacity=".7"/></g>' +
          '<path d="' + SIL + '" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round"/>' +
          '<path d="M113 49 Q114 38 124 39 Q119 43 121 48" fill="' + BODY + '" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g>' +
        '<g data-layer="cheeks"><ellipse cx="91" cy="111" rx="7" ry="4" fill="' + GOLD + '" opacity=".28"/><ellipse cx="149" cy="111" rx="7" ry="4" fill="' + GOLD + '" opacity=".28"/></g>' +
        '<g data-layer="eyes"><g data-part="eyes-open">' + EYE(103) + EYE(137) + '</g>' +
          '<g data-part="eyes-closed" opacity="0"><path d="M95 99 Q103 89 111 99 M129 99 Q137 89 145 99" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/></g></g>' +
        '<g data-layer="beak"><ellipse data-part="mouth" cx="120" cy="115" rx="4.6" ry="0.01" fill="' + INK + '"/>' +
          '<g data-part="beak-lower"><path d="M114.5 113 Q120 120 125.5 113 Q120 116 114.5 113 Z" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/></g>' +
          '<path d="M112.5 108 Q120 102.5 127.5 108 Q124.5 113.5 120 115.5 Q115.5 113.5 112.5 108 Z" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/></g>' +
        '<g data-layer="scarf"><g data-part="scarf-tail"><path d="M131 145 Q126 166 134 182 L148 177 Q141 162 143 145 Z" fill="' + BLUE + '" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"/>' +
            '<path d="M134 174 L146 170" stroke="#FFFFFF" stroke-width="2" opacity=".55" stroke-linecap="round"/></g>' +
          '<path d="M73 124 Q120 148 167 124 L169 136 Q120 162 71 136 Z" fill="' + BLUE + '" stroke="' + INK + '" stroke-width="2.8" stroke-linejoin="round"/>' +
          '<circle cx="137" cy="143" r="7.5" fill="' + BLUE + '" stroke="' + INK + '" stroke-width="2.6"/></g>' +
        '<g data-layer="wings"><g transform="translate(80 134)"><g data-part="wing-l">' + WING + '</g></g>' +
          '<g transform="translate(160 134) scale(-1 1)"><g data-part="wing-r">' + WING + '</g></g></g>' +
      '</g></svg>';
  }

  var BASE = { wingL: 6, wingR: 6, wingSL: 1, wingSR: 1, lookX: 0, lookY: 0, closed: 0, mouth: 0, tilt: 0, think: 0, glow: .4, sparkle: 0, bobAmp: 2, bobHz: 2.1, hop: 0, scarf: 0, tuck: 0, haloX: 0, squash: 0 };
  var FAST = { wingL: 1, wingR: 1, wingSL: 1, wingSR: 1 };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var POSES = {
    idle: function (t) { return { scarf: 3 * Math.sin(t * 1.6) }; },
    waving: function (t) { return { wingR: 122 + 18 * Math.sin(t * 7.5), tilt: -4, lookX: -1.5, glow: .55, scarf: 5 * Math.sin(t * 3.7) }; },
    thinking: function (t) { return { wingL: -116, wingSL: .64, lookX: 3, lookY: -4.5, tilt: 5, think: 1, glow: .45, bobAmp: 1, scarf: 2 * Math.sin(t) }; },
    talking: function (t) { return { mouth: .2 + .8 * Math.abs(Math.sin(t * 8.5) * Math.sin(t * 3.3 + 1)), wingL: 14 + 8 * Math.sin(t * 4), wingR: 14 + 8 * Math.sin(t * 4 + 1.6), glow: .65, tilt: 2 * Math.sin(t * 2), scarf: 3 * Math.sin(t * 2.4) }; },
    happy: function (t) { return { closed: 1, wingL: 44 + 10 * Math.sin(t * 8.4), wingR: 44 + 10 * Math.sin(t * 8.4), sparkle: 1, glow: 1, hop: 1, scarf: 7 * Math.sin(t * 8.4) }; },
    /* flying: driven by the live velocity in c (vx, vy, speed, phase, power 0..1) */
    flying: function (t, c) {
      var s = Math.sin(c.phase), pw = c.power;
      var down = Math.max(0, -s);
      return {
        wingL: 70 + (46 + 18 * pw) * s, wingR: 70 + (46 + 18 * pw) * s,
        wingSL: 1 - .16 * Math.max(0, s), wingSR: 1 - .16 * Math.max(0, s),
        tilt: clamp(c.vx * .045, -17, 17), lookX: clamp(c.vx * .03, -4.5, 4.5), lookY: clamp(c.vy * .03, -4, 3),
        mouth: .18 + .14 * pw, glow: 1, tuck: 1, bobAmp: 5 + 3 * pw, bobHz: 0, hop: 0,
        scarf: clamp(-c.vx * .05, -34, 34) + 6 * Math.sin(t * 13), haloX: clamp(-c.vx * .012, -8, 8), squash: -.05 * down
      };
    }
  };
  var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instances = [];

  function mount(el) {
    var id = 'kalapati' + (++n);
    el.innerHTML = markup(id);
    var svg = el.querySelector('svg');
    var q = function (s) { return svg.querySelector('[data-part="' + s + '"]'); };
    var layer = function (s) { return svg.querySelector('[data-layer="' + s + '"]'); };
    var parts = {
      root: q('root'), halo: q('halo-move'), glow: q('halo-glow'), open: q('eyes-open'), closed: q('eyes-closed'),
      eyes: svg.querySelectorAll('[data-part="eye"]'), mouth: q('mouth'), lower: q('beak-lower'), feet: q('feet'),
      wingL: q('wing-l'), wingR: q('wing-r'), scarf: q('scarf-tail'),
      thought: layer('thought'), dots: svg.querySelectorAll('[data-part="dot"]'),
      sparkles: layer('sparkles'), stars: svg.querySelectorAll('[data-part="star"]')
    };
    var cur = Object.assign({}, BASE), inst = { pose: 'idle', svg: svg, ctx: { vx: 0, vy: 0, power: 0, phase: 0, flapHz: 0 } };
    var nextBlink = 2 + Math.random() * 3, blinkEnd = 0, last = performance.now(), clock = Math.random() * 10; var bobPh = 0;
    inst.setPose = function (name) { if (POSES[name]) inst.pose = name; return inst; };
    inst.frame = function (now) {
      var dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
      var c = inst.ctx; c.phase += dt * c.flapHz * 6.2832;
      var t = reduce ? 0.6 : clock;
      var target = Object.assign({}, BASE, POSES[inst.pose](t, c));
      var k = reduce ? 1 : 1 - Math.exp(-dt * 9), kf = reduce ? 1 : 1 - Math.exp(-dt * 48);
      for (var key in BASE) cur[key] += (target[key] - cur[key]) * (FAST[key] && inst.pose === 'flying' ? kf : k);

      bobPh += dt * (cur.bobHz + c.flapHz * 6.2832);
      var bob = reduce ? 0 : -cur.bobAmp * Math.sin(bobPh) - cur.hop * Math.abs(Math.sin(t * 4.2)) * 10;
      var sy = reduce ? 1 : 1 + 0.012 * Math.sin(t * 2.1) + cur.squash;
      parts.root.setAttribute('transform', 'translate(0 ' + bob.toFixed(2) + ') rotate(' + cur.tilt.toFixed(2) + ' 120 206) translate(120 206) scale(' + (2 - sy).toFixed(4) + ' ' + sy.toFixed(4) + ') translate(-120 -206)');
      parts.halo.setAttribute('transform', 'translate(' + cur.haloX.toFixed(2) + ' ' + (reduce ? 0 : 2.2 * Math.sin(t * 1.7 + 1)).toFixed(2) + ')');
      parts.glow.setAttribute('opacity', (cur.glow * (reduce ? 1 : .85 + .15 * Math.sin(t * 3))).toFixed(3));
      parts.feet.setAttribute('transform', 'translate(120 206) scale(1 ' + (1 - .55 * cur.tuck).toFixed(3) + ') translate(0 ' + (-7 * cur.tuck).toFixed(2) + ') translate(-120 -206)');

      if (clock > nextBlink) { blinkEnd = clock + .14; nextBlink = clock + 2.5 + Math.random() * 3.5; }
      var lid = clock < blinkEnd ? .12 : 1;
      parts.open.setAttribute('transform', 'translate(' + cur.lookX.toFixed(2) + ' ' + cur.lookY.toFixed(2) + ')');
      parts.open.setAttribute('opacity', (1 - cur.closed).toFixed(3));
      parts.closed.setAttribute('opacity', cur.closed.toFixed(3));
      parts.eyes.forEach(function (e) { var cx = e.getAttribute('data-cx'); e.setAttribute('transform', 'translate(' + cx + ' 96) scale(1 ' + lid + ') translate(-' + cx + ' -96)'); });
      parts.mouth.setAttribute('ry', Math.max(.01, cur.mouth * 3.8).toFixed(2));
      parts.lower.setAttribute('transform', 'translate(0 ' + (cur.mouth * 4.2).toFixed(2) + ')');
      parts.wingL.setAttribute('transform', 'rotate(' + cur.wingL.toFixed(2) + ') scale(' + cur.wingSL.toFixed(3) + ')');
      parts.wingR.setAttribute('transform', 'rotate(' + cur.wingR.toFixed(2) + ') scale(' + cur.wingSR.toFixed(3) + ')');
      parts.scarf.setAttribute('transform', 'rotate(' + cur.scarf.toFixed(2) + ' 137 146)');
      parts.thought.setAttribute('opacity', cur.think.toFixed(3));
      parts.dots.forEach(function (d, i) { var s = reduce ? 1 : 1 + .15 * Math.sin(t * 3 - i * .9); var cx = d.getAttribute('cx'), cy = d.getAttribute('cy'); d.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + s.toFixed(3) + ') translate(-' + cx + ' -' + cy + ')'); });
      parts.sparkles.setAttribute('opacity', cur.sparkle.toFixed(3));
      parts.stars.forEach(function (s, i) {
        var base = s.getAttribute('transform').replace(/ scale\([^)]*\) rotate\([^)]*\)$/, '');
        var sc = reduce ? 1 : .6 + .4 * Math.abs(Math.sin(t * 2.6 + i * 1.3));
        s.setAttribute('transform', base + ' scale(' + sc.toFixed(3) + ') rotate(' + (reduce ? 0 : (t * 40 + i * 30) % 360).toFixed(1) + ')');
      });
    };
    instances.push(inst);
    inst.frame(performance.now());
    return inst;
  }    return { mount: mount, reduce: reduce, tick: function (now) { instances.forEach(function (i) { if (i.svg.isConnected) i.frame(now); }); } };
  })();

  /* ---------- styles (scoped with the kal- prefix, colours can be overridden with CSS variables) ---------- */
  var CSS = [
    '.kal-fx{position:fixed;left:0;top:0;right:0;bottom:var(--kal-bottom,0px);overflow:hidden;pointer-events:none;z-index:var(--kal-z,50)}',
    '.kal-fx canvas{position:absolute;inset:0;width:100%;height:100%}',
    '.kal-shadow{position:absolute;left:0;top:0;width:70px;height:14px;border-radius:50%;background:radial-gradient(closest-side,rgba(15,23,42,.35),rgba(15,23,42,0));will-change:transform,opacity}',
    '.kal-dove{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;cursor:grab;will-change:transform;transform-origin:0 0;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;border-radius:40%}',
    '.kal-dove.kal-drag{cursor:grabbing}',
    '.kal-dove svg{width:100%;height:100%;display:block;overflow:visible;pointer-events:none}',
    '.kal-tip{position:absolute;right:74%;top:6%;white-space:nowrap;background:var(--kal-surface,#fff);color:var(--kal-ink,#0F172A);border:1px solid var(--kal-line,#E2E8F0);border-radius:16px 16px 4px 16px;padding:10px 14px;font:700 14.5px/1.35 system-ui,sans-serif;box-shadow:0 10px 30px -12px rgba(15,23,42,.35);cursor:pointer;opacity:0;transform:translateY(6px) scale(.96);transform-origin:100% 100%;transition:opacity .25s,transform .25s;pointer-events:none}',
    '.kal-tip.kal-r{right:auto;left:74%;border-radius:16px 16px 16px 4px;transform-origin:0 100%}',
    '.kal-tip.kal-show{opacity:1;transform:none;pointer-events:auto}',
    '.kal-tip small{display:block;font-weight:500;color:var(--kal-muted,#64748B);font-size:12.5px}',
    '.kal-hide{position:absolute;left:4%;top:2%;width:34px;height:34px;border-radius:50%;border:1px solid var(--kal-line,#E2E8F0);background:var(--kal-surface,#fff);color:var(--kal-muted,#64748B);display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .2s;box-shadow:0 6px 16px -8px rgba(15,23,42,.4);padding:0}',
    '.kal-hide svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}',
    '.kal-dove:hover .kal-hide,.kal-dove:focus-within .kal-hide{opacity:1}',
    '@media(hover:none){.kal-hide{opacity:.85}}',
    '.kal-dove[hidden],.kal-hide[hidden]{display:none}'
  ].join('\n');
  if (!doc.getElementById('kal-style')) { var st = doc.createElement('style'); st.id = 'kal-style'; st.textContent = CSS; doc.head.appendChild(st); }

  /* ---------- DOM ---------- */
  var o = {
    container: opts.container || doc.body,
    label: opts.label || 'Kalapati, your assistant. Press Enter to chat, or drag to move him.',
    tipTitle: opts.tipTitle || 'Need a hand?', tipText: opts.tipText || 'Tap to ask Kalapati',
    mobileBreakpoint: opts.mobileBreakpoint || 700,
    dock: opts.dockSize || { desktop: 150, mobile: 138 },
    perch: opts.perchSize || { desktop: 120, mobile: 108 },
    tipEveryMs: opts.tipEveryMs == null ? 15000 : opts.tipEveryMs,
    bottomInset: opts.bottomInset || 0,
    getPanelRect: opts.getPanelRect, onStateChange: opts.onStateChange
  };
  var fx = doc.createElement('div'); fx.className = 'kal-fx'; fx.style.setProperty('--kal-bottom', o.bottomInset + 'px');
  fx.style.setProperty('--kal-z', String(opts.zIndex != null ? opts.zIndex : 50));
  fx.innerHTML = '<canvas aria-hidden="true"></canvas><div class="kal-shadow" aria-hidden="true"></div>' +
    '<div class="kal-dove" data-testid="parish-assistant-button" role="button" tabindex="0" aria-label="' + o.label.replace(/"/g, '&quot;') + '"><div class="kal-svg" style="width:100%;height:100%"></div>' +
    '<button class="kal-hide" type="button" aria-label="Minimize Kalapati to the edge" title="Send to the edge"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>' +
    '<div class="kal-tip" role="button" tabindex="-1">' + o.tipTitle + '<small>' + o.tipText + '</small></div></div>';
  o.container.appendChild(fx);
  var cv = fx.querySelector('canvas'), ctx = cv.getContext('2d'), shadow = fx.querySelector('.kal-shadow'),
      dove = fx.querySelector('.kal-dove'), tip = fx.querySelector('.kal-tip'), hideBtn = fx.querySelector('.kal-hide');
  var inst = Kalapati.mount(fx.querySelector('.kal-svg'));
  var reduce = Kalapati.reduce;
  var timers = [], alive = true, raf = 0;
  function later(fn, ms) { var t = setTimeout(function () { if (alive) fn(); }, ms); timers.push(t); return t; }

  /* ---------- behaviour: position, drag, flight ---------- */
  var S = { state: 'docked', W: 800, H: 600, m: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, sc: 1, tsc: 1, home: null,
            dragging: false, air: false, slowFor: 0, hover: false, base: 'idle', landT: 0, ox: 0, oy: 0, down: null, moved: false,
            flapHz: 0, power: 0, sinceFeather: 0, tipUntil: 0, tipAt: 0, psz: 120, panel: null };
  var P = [];
  var dockSz = function () { return S.m ? o.dock.mobile : o.dock.desktop; };

  function size() {
    S.W = fx.clientWidth; S.H = fx.clientHeight; S.m = win.innerWidth < o.mobileBreakpoint;
    var d = win.devicePixelRatio || 1;
    cv.width = Math.round(S.W * d); cv.height = Math.round(S.H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    dove.style.width = dove.style.height = dockSz() + 'px';
    S.psz = S.m ? o.perch.mobile : o.perch.desktop;
    if (!S.home) S.home = { x: S.W - dockSz() - 18, y: S.H - dockSz() - 14 };
    S.home = clampPos(S.home, 1);
    retarget(true);
  }
  function clampPos(p, sc) { var z = dockSz() * sc; return { x: Math.max(4, Math.min(S.W - z - 4, p.x)), y: Math.max(4, Math.min(S.H - z - 4, p.y)) }; }
  function panelRect() {
    var r = o.getPanelRect && o.getPanelRect();
    if (r) return { l: r.left != null ? r.left : r.x, t: r.top != null ? r.top : r.y, w: r.width, h: r.height };
    var w = S.m ? S.W : Math.min(420, S.W - 32), h = Math.min(600, S.H - 160);
    return { l: S.m ? 0 : S.W - 20 - w, t: S.H - (S.m ? 0 : 20) - h, w: w, h: h };
  }
  function retarget(snap) {
    var z = dockSz();
    if (S.state === 'chat') {
      var pr = panelRect(), vis = S.psz; S.tsc = vis / z;
      var targetX = S.m
        ? Math.min(pr.w - vis - 52, Math.max(130, pr.w * 0.40))
        : Math.min(260, pr.w * 0.45);
      S.tx = Math.max(4, Math.min(S.W - vis - 4, pr.l + targetX));
      S.ty = Math.max(4, Math.round(pr.t - vis * 0.82));
    } else if (S.state === 'min') {
      S.tsc = .8; var v = z * .8; S.tx = S.W - v - 20; S.ty = S.H - v * .5 - (S.hover ? 14 : 0);
    } else { S.tsc = 1; S.tx = S.home.x; S.ty = S.home.y; }
    if (snap) { S.x = S.tx; S.y = S.ty; S.sc = S.tsc; S.vx = S.vy = 0; }
  }
  function setState(st, fromUser) {
    if (S.state === st) return;
    var prev = S.state; S.state = st;
    hideBtn.hidden = st !== 'docked'; tip.classList.remove('kal-show');
    if (st === 'chat') {
      dove.style.pointerEvents = 'none';
      S.base = 'waving';
      later(function () { if (S.base === 'waving' && S.state === 'chat') S.base = 'idle'; }, 2200);
    } else {
      dove.style.pointerEvents = 'auto';
      if (prev === 'chat') S.base = 'idle';
    }
    retarget(false);
    if (o.onStateChange) o.onStateChange(st, !!fromUser);
  }

  /* ---------- animation loop ---------- */
  var last = performance.now();
  function frame(now) {
    if (!alive) return;
    var dt = Math.min(.033, (now - last) / 1000); last = now;
    /* chat panel can resize or move (for example the keyboard on a phone), so follow it */
    if (S.state === 'chat') retarget(false);
    var k = S.dragging ? 150 : 85, zeta = S.dragging ? .72 : .95, c = 2 * zeta * Math.sqrt(k);
    if (reduce) { S.x = S.tx; S.y = S.ty; S.sc = S.tsc; S.vx = S.vy = 0; }
    else {
      var ax = (S.tx - S.x) * k - S.vx * c, ay = (S.ty - S.y) * k - S.vy * c;
      S.vx += ax * dt; S.vy += ay * dt; S.x += S.vx * dt; S.y += S.vy * dt;
      if (Math.abs(S.tx - S.x) + Math.abs(S.ty - S.y) < .6 && Math.hypot(S.vx, S.vy) < 14) { S.x = S.tx; S.y = S.ty; S.vx = S.vy = 0; }
      S.sc += (S.tsc - S.sc) * (1 - Math.exp(-dt * 8));
    }
    var speed = Math.hypot(S.vx, S.vy), was = S.air;
    if (!S.air && (speed > 150 || S.dragging && speed > 90)) S.air = true;
    if (S.air) { if (speed < (S.dragging ? 30 : 60)) { S.slowFor += dt; if (S.slowFor > (S.dragging ? .3 : .12)) { S.air = false; S.slowFor = 0; } } else S.slowFor = 0; }
    if (was && !S.air) { S.landT = .45; burst(5, .6); }
    S.landT = Math.max(0, S.landT - dt);

    var pw = Math.min(1, speed / 700), hzT = S.air ? 6.2 + 5.5 * pw : 0;
    S.flapHz += (hzT - S.flapHz) * (1 - Math.exp(-dt * 10)); S.power += (pw - S.power) * (1 - Math.exp(-dt * 8));
    var cx = inst.ctx; cx.vx = S.vx; cx.vy = S.vy; cx.power = S.power; cx.flapHz = S.flapHz;
    inst.setPose(S.air && !reduce ? 'flying' : (S.hover && S.state !== 'chat' && !S.dragging && S.base === 'idle' ? 'waving' : S.base));

    var z = dockSz(), vis = z * S.sc;
    var squash = S.landT > 0 ? 1 - .06 * Math.sin((S.landT / .45) * Math.PI) : 1;
    dove.style.transform = 'translate3d(' + S.x.toFixed(1) + 'px,' + S.y.toFixed(1) + 'px,0) scale(' + (S.sc * (2 - squash)).toFixed(4) + ',' + (S.sc * squash).toFixed(4) + ')';
    tip.classList.toggle('kal-r', S.x + vis / 2 < S.W / 2);

    var lift = Math.min(1, speed / 500) * (S.air ? 1 : 0);
    var sw = vis * .55 * (1 - .35 * lift), sx = S.x + vis / 2 - sw / 2, sy = S.y + vis * .93 + 8 + lift * 22;
    shadow.style.width = sw + 'px'; shadow.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
    shadow.style.opacity = (S.state === 'chat' || S.state === 'min' ? 0 : .9 - .6 * lift).toFixed(2);

    if (S.air && !reduce) { S.sinceFeather += dt; if (S.sinceFeather > .085 - .04 * pw) { S.sinceFeather = 0; burst(1, 0); } }
    draw(dt, vis);
    Kalapati.tick(now);

    if (o.tipEveryMs && S.state !== 'chat' && !S.air && !S.dragging && now > S.tipAt) {
      S.tipAt = now + o.tipEveryMs;
      if (S.state === 'docked') { tip.classList.add('kal-show'); S.tipUntil = now + 4600; }
      S.base = 'waving'; later(function () { if (S.base === 'waving' && S.state !== 'chat') S.base = 'idle'; }, 1900);
    }
    if (S.tipUntil && now > S.tipUntil) { tip.classList.remove('kal-show'); S.tipUntil = 0; }
    raf = requestAnimationFrame(frame);
  }
  S.tipAt = performance.now() + 2200;

  function burst(count, calm) {
    if (reduce) return;
    var z = dockSz() * S.sc;
    for (var i = 0; i < count; i++) {
      var spread = calm ? 1.2 : 1;
      P.push({ k: 'f', x: S.x + z * (.3 + Math.random() * .4), y: S.y + z * (.45 + Math.random() * .3), vx: -S.vx * .12 + (Math.random() - .5) * 60 * spread, vy: -S.vy * .12 + 10 + Math.random() * 30,
               r: Math.random() * 6.28, vr: (Math.random() - .5) * 5, life: 1.1 + Math.random() * .6, age: 0, s: 7 + Math.random() * 6 });
    }
  }
  function draw(dt, vis) {
    ctx.clearRect(0, 0, S.W, S.H);
    var speed = Math.hypot(S.vx, S.vy);
    if (S.air && speed > 140 && !reduce) {
      var nx = -S.vx / speed, ny = -S.vy / speed, px = -ny, py = nx, cxm = S.x + vis / 2, cym = S.y + vis * .52;
      var len = Math.min(110, speed * .12), a = Math.min(.5, speed / 900);
      ctx.lineCap = 'round'; ctx.lineWidth = 3;
      for (var i = -1; i <= 1; i++) {
        var off = i * vis * .2, sx = cxm + px * off + nx * vis * .22, sy = cym + py * off + ny * vis * .22;
        ctx.strokeStyle = 'rgba(99,130,246,' + (a * (i === 0 ? 1 : .6)).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + nx * len * (i === 0 ? 1 : .7), sy + ny * len * (i === 0 ? 1 : .7)); ctx.stroke();
      }
    }
    for (var j = P.length - 1; j >= 0; j--) {
      var p = P[j]; p.age += dt;
      if (p.age > p.life) { P.splice(j, 1); continue; }
      p.vy += 70 * dt; p.vx *= (1 - dt * .9); p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.age * 5 + p.r) * .4; p.r += p.vr * dt;
      var al = 1 - p.age / p.life;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, al * 1.6);
      ctx.fillStyle = '#F8FAFC'; ctx.strokeStyle = 'rgba(15,23,42,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * .32, p.s, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s * 1.15); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- pointer: tap to chat, drag to fly ---------- */
  dove.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.kal-hide') || e.target.closest('.kal-tip')) return;
    if (S.state === 'chat') {
      inst.setPose('waving');
      later(function () { if (S.base === 'waving' && S.state === 'chat') S.base = 'idle'; }, 1800);
      return;
    }
    S.down = { id: e.pointerId, sx: e.clientX, sy: e.clientY }; S.moved = false;
    var r = fx.getBoundingClientRect(); S.ox = e.clientX - r.left - S.x; S.oy = e.clientY - r.top - S.y;
    try { dove.setPointerCapture(e.pointerId); } catch (x) {}
  });
  dove.addEventListener('pointermove', function (e) {
    if (!S.down || e.pointerId !== S.down.id) return;
    if (!S.moved && Math.hypot(e.clientX - S.down.sx, e.clientY - S.down.sy) > 6) {
      S.moved = true; S.dragging = true; dove.classList.add('kal-drag'); tip.classList.remove('kal-show');
      if (S.state === 'min') { S.state = 'docked'; hideBtn.hidden = false; S.tsc = 1; if (o.onStateChange) o.onStateChange('docked', true); }
      burst(6, 0); S.air = true;
    }
    if (S.dragging) {
      var r = fx.getBoundingClientRect();
      var p = clampPos({ x: e.clientX - r.left - S.ox, y: e.clientY - r.top - S.oy }, S.tsc);
      S.tx = p.x; S.ty = p.y; S.home = clampPos({ x: p.x, y: p.y }, 1);
    }
  });
  function up(e) {
    if (!S.down || e.pointerId !== S.down.id) return;
    var wasDrag = S.dragging; S.down = null; S.dragging = false; dove.classList.remove('kal-drag');
    try { dove.releasePointerCapture(e.pointerId); } catch (x) {}
    if (!wasDrag) setState(S.state === 'min' ? 'docked' : 'chat', true); else retarget(false);
  }
  dove.addEventListener('pointerup', up); dove.addEventListener('pointercancel', up);
  dove.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { S.hover = true; retarget(false); } });
  dove.addEventListener('pointerleave', function () { S.hover = false; retarget(false); });
  dove.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setState(S.state === 'min' ? 'docked' : 'chat', true); } });
  dove.addEventListener('click', function (e) {
    if (e.target.closest('.kal-hide') || e.target.closest('.kal-tip')) return;
    if (S.state !== 'chat' && !S.moved) {
      setState(S.state === 'min' ? 'docked' : 'chat', true);
    }
  });
  hideBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  hideBtn.addEventListener('click', function (e) { e.stopPropagation(); setState('min', true); });
  tip.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  tip.addEventListener('click', function (e) { e.stopPropagation(); setState('chat', true); });

  /* ---------- boot ---------- */
  var onResize = function () { size(); };
  win.addEventListener('resize', onResize);
  var ro = win.ResizeObserver ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(o.container);
  size(); hideBtn.hidden = false;
  raf = requestAnimationFrame(frame);

  return {
    /** 'docked' | 'min' | 'chat'. Call setState('docked') when your chat closes. */
    setState: function (st) { setState(st, false); },
    getState: function () { return S.state; },
    /** 'idle' | 'thinking' | 'talking' | 'happy' | 'waving' */
    setPose: function (name) { S.base = name || 'idle'; if (name === 'happy') later(function () { if (S.base === 'happy') S.base = 'idle'; }, 2600); },
    /** call after your chat panel moves or resizes so he stays on its edge */
    relayout: function () { retarget(false); },
    /** hide or show him entirely, for example on pages where he should not appear */
    setVisible: function (v) { fx.style.display = v ? '' : 'none'; },
    destroy: function () { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); win.removeEventListener('resize', onResize); if (ro) ro.disconnect(); fx.remove(); }
  };
}
