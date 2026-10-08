/*
 * Tissuelock hero — "closing the gap" (realistic cutaway).
 * Skin, fat, fascia and muscle in cross-section. A seroma-filled dead space opens under the
 * flap, the three-layer TissueTape slides in, the flap settles onto it, and the seam bonds.
 * Usage: TLHero.mount(element)
 */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // Story: intact tissue -> scalpel dissects the plane -> flap lifts, seroma fills the dead space
  // -> TissueTape slides in -> flap closes onto it -> bond glows -> hold -> fade and repeat.
  var T = { intact: .9, cut: 2.3, exit: .6, lift: 1.5, pool: .7, slide: 1.9, close: 1.8, glow: 1.1, hold: 2.6, fade: .9 };
  var LOOP = 0; for (var k in T) LOOP += T[k];
  function phase(t) {
    var P = { gap: 0, tape: 0, glow: 0, tapeA: 1, cut: 0, knife: 0, knifeA: 0, alpha: 1, step: 0 };
    var acc = 0;
    function seg(n) { var s0 = acc; acc += T[n]; return t < acc ? (t - s0) / T[n] : -1; }
    var u;
    P.alpha = smooth(t / .5);
    if ((u = seg('intact')) >= 0) { P.knifeA = smooth(u * 2); P.knife = 0; P.step = 1; return P; }
    if ((u = seg('cut')) >= 0) { P.knifeA = 1; P.knife = ease(u); P.cut = P.knife; P.step = 1; return P; }
    P.cut = 1;
    if ((u = seg('exit')) >= 0) { P.knife = 1 - ease(u) * .25; P.knifeA = 1 - smooth(u); P.gap = .08 * u; P.step = 1; return P; }
    if ((u = seg('lift')) >= 0) { P.gap = .08 + .92 * ease(u); P.step = 1; return P; }
    P.gap = 1;
    if ((u = seg('pool')) >= 0) { P.step = 1; return P; }
    if ((u = seg('slide')) >= 0) { P.tape = ease(u); P.step = 2; return P; }
    P.tape = 1;
    if ((u = seg('close')) >= 0) { P.gap = 1 - ease(u); P.step = 3; return P; }
    P.gap = 0; P.step = 3;
    if ((u = seg('glow')) >= 0) { P.glow = Math.sin(Math.PI * u); return P; }
    if ((u = seg('hold')) >= 0) return P;
    u = seg('fade'); P.alpha = 1 - smooth(u < 0 ? 1 : u); return P;
  }

  // Scalpel, tip at the origin pointing +x
  function drawScalpel(g, L, b) {
    // handle
    var hg = g.createLinearGradient(0, -b * .2, 0, b * .2);
    hg.addColorStop(0, '#dfe5ea'); hg.addColorStop(.45, '#9aa4ad'); hg.addColorStop(1, '#5d6670');
    g.fillStyle = hg;
    g.beginPath();
    g.moveTo(-L * .36, -b * .16); g.lineTo(-L * .97, -b * .2);
    g.quadraticCurveTo(-L * 1.02, 0, -L * .97, b * .2); g.lineTo(-L * .36, b * .16); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,48,56,.35)'; g.lineWidth = .8;
    for (var i = 0; i < 9; i++) { var gx = -L * (.55 + i * .035); g.beginPath(); g.moveTo(gx, -b * .17); g.lineTo(gx, b * .17); g.stroke(); }
    // blade (#10 style: straight spine, curved belly)
    var bg = g.createLinearGradient(0, -b * .5, 0, b * .5);
    bg.addColorStop(0, '#f4f7f9'); bg.addColorStop(.5, '#c4ccd3'); bg.addColorStop(1, '#8c959e');
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-L * .2, -b * .42);
    g.lineTo(-L * .36, -b * .3);
    g.lineTo(-L * .36, b * .3);
    g.quadraticCurveTo(-L * .16, b * .62, 0, 0);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = .9;
    g.beginPath(); g.moveTo(-1, .5); g.quadraticCurveTo(-L * .16, b * .58, -L * .34, b * .3); g.stroke();
    g.strokeStyle = 'rgba(60,70,80,.5)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(-L * .3, -b * .12); g.lineTo(-L * .22, -b * .06); g.stroke();
  }

  /* ---------- textures (built once per size) ---------- */

  function canvas(w, h, dpr) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, x: x };
  }

  // Flap = epidermis + dermis + subcutaneous fat, drawn flat (deformed later column by column)
  function buildFlap(w, epi, derm, fat, dpr) {
    var H = epi + derm + fat, o = canvas(w, H, dpr), g = o.x, R = rng(11), i, x;

    var ge = g.createLinearGradient(0, 0, 0, epi);
    ge.addColorStop(0, '#f3d2b6'); ge.addColorStop(1, '#e3ac8e');
    g.fillStyle = ge; g.fillRect(0, 0, w, epi + derm * .5);
    g.fillStyle = 'rgba(255,240,228,.55)'; g.fillRect(0, 0, w, Math.max(1, epi * .18));

    var gd = g.createLinearGradient(0, epi, 0, epi + derm);
    gd.addColorStop(0, '#dd9283'); gd.addColorStop(.6, '#cf7f72'); gd.addColorStop(1, '#c47467');
    g.fillStyle = gd;
    g.beginPath(); g.moveTo(0, epi + derm);
    for (x = 0; x <= w; x += 3) g.lineTo(x, epi + Math.sin(x / 7) * epi * .22 + Math.sin(x / 23) * epi * .12);
    g.lineTo(w, epi + derm); g.closePath(); g.fill();
    g.lineCap = 'round';
    for (i = 0; i < w / 5; i++) {
      var cx = R() * w, cy = epi + derm * (.2 + R() * .75), len = 6 + R() * 16, ang = (R() - .5) * .9;
      g.strokeStyle = 'rgba(255,214,204,' + (.18 + R() * .22) + ')'; g.lineWidth = .7 + R() * .8;
      g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + len * .5, cy + (R() - .5) * 4, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len); g.stroke();
    }
    for (i = 0; i < w / 120; i++) {
      var fx = R() * w, depth = derm * (.6 + R() * .5);
      g.strokeStyle = 'rgba(120,60,50,.18)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(fx, epi * .4); g.quadraticCurveTo(fx + 3, epi + depth * .5, fx + 5, epi + depth); g.stroke();
      g.fillStyle = 'rgba(214,150,135,.8)'; g.beginPath(); g.ellipse(fx + 5, epi + depth, 2.6, 2, 0, 0, 6.283); g.fill();
    }

    var f0 = epi + derm;
    var gs = g.createLinearGradient(0, f0, 0, H); gs.addColorStop(0, '#b98a3a'); gs.addColorStop(1, '#9e7330');
    g.fillStyle = gs; g.fillRect(0, f0, w, fat);
    var s = Math.max(6, fat / 5.2), cells = [];
    for (var yy = f0 + s * .45; yy < H + s * .3; yy += s * .82) {
      for (var xx = -s; xx < w + s; xx += s * .9) cells.push({ x: xx + (R() - .5) * s * .55, y: yy + (R() - .5) * s * .45, r: s * (.5 + R() * .16), q: R(), a: R() });
    }
    cells.sort(function (a, b) { return a.q - b.q; });
    g.save(); g.beginPath(); g.rect(0, f0, w, fat); g.clip();
    cells.forEach(function (c) {
      var rg = g.createRadialGradient(c.x - c.r * .3, c.y - c.r * .35, c.r * .1, c.x, c.y, c.r);
      rg.addColorStop(0, '#fff2b8'); rg.addColorStop(.45, '#f6d475'); rg.addColorStop(1, '#d9a944');
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(c.x, c.y, c.r, c.r * (.82 + c.a * .2), (c.a - .5) * .8, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(150,98,36,.45)'; g.lineWidth = .8; g.stroke();
    });
    for (i = 0; i < w / 160; i++) {
      var vx = R() * w, vy = f0 + fat * (.2 + R() * .6), col = R() > .5 ? '178,44,52' : '86,72,150';
      g.strokeStyle = 'rgba(' + col + ',.55)'; g.lineWidth = 1 + R() * .8;
      g.beginPath(); g.moveTo(vx, vy);
      for (var k = 0; k < 6; k++) { vx += 10 + R() * 18; vy += (R() - .5) * 12; g.lineTo(vx, clamp(vy, f0 + 3, H - 3)); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(232,205,170,.35)'; g.lineWidth = 1;
    for (i = 0; i < w / 70; i++) { var sx = R() * w; g.beginPath(); g.moveTo(sx, f0); g.bezierCurveTo(sx + 6, f0 + fat * .3, sx - 6, f0 + fat * .6, sx + 3, H); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(245,232,210,.55)'; g.fillRect(0, H - 2.2, w, 2.2);
    var bs = g.createLinearGradient(0, f0, 0, f0 + 6); bs.addColorStop(0, 'rgba(90,40,30,.35)'); bs.addColorStop(1, 'rgba(90,40,30,0)');
    g.fillStyle = bs; g.fillRect(0, f0, w, 6);
    return { c: o.c, h: H };
  }

  // Deep fascia + muscle (static)
  function buildBase(w, fascia, muscle, dpr) {
    var H = fascia + muscle, o = canvas(w, H, dpr), g = o.x, R = rng(23), i;
    var gf = g.createLinearGradient(0, 0, 0, fascia);
    gf.addColorStop(0, '#f6f2ea'); gf.addColorStop(.5, '#e2dbcf'); gf.addColorStop(1, '#c9bfb0');
    g.fillStyle = gf; g.fillRect(0, 0, w, fascia);
    g.save(); g.beginPath(); g.rect(0, 0, w, fascia); g.clip();
    for (i = 0; i < w / 3; i++) {
      var x = R() * w; g.strokeStyle = 'rgba(255,255,255,' + (.25 + R() * .35) + ')'; g.lineWidth = .6;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + fascia * 2.2, fascia); g.stroke();
      if (i % 3 === 0) { g.strokeStyle = 'rgba(160,145,125,.25)'; g.beginPath(); g.moveTo(x + 2, 0); g.lineTo(x + 2 + fascia * 2.2, fascia); g.stroke(); }
    }
    g.restore();
    var gm = g.createLinearGradient(0, fascia, 0, H);
    gm.addColorStop(0, '#a63a3a'); gm.addColorStop(.5, '#8a2b2d'); gm.addColorStop(1, '#5e1c22');
    g.fillStyle = gm; g.fillRect(0, fascia, w, muscle);
    var rows = 5, rh = muscle / rows;
    for (var r = 0; r < rows; r++) {
      var y = fascia + r * rh, x2 = -R() * 40;
      while (x2 < w) {
        var len = 50 + R() * 90;
        g.fillStyle = 'rgba(' + (150 + R() * 30 | 0) + ',' + (45 + R() * 15 | 0) + ',' + (48 + R() * 10 | 0) + ',.55)';
        g.beginPath(); g.ellipse(x2 + len / 2, y + rh / 2, len / 2, rh * .44, 0, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(240,190,180,.18)'; g.lineWidth = .7;
        for (var l = 1; l < 4; l++) { g.beginPath(); g.moveTo(x2 + 4, y + rh * l / 4); g.lineTo(x2 + len - 4, y + rh * l / 4 + (R() - .5) * 2); g.stroke(); }
        x2 += len + 2;
      }
    }
    var sh = g.createLinearGradient(0, fascia, 0, fascia + 8); sh.addColorStop(0, 'rgba(40,10,10,.45)'); sh.addColorStop(1, 'rgba(40,10,10,0)');
    g.fillStyle = sh; g.fillRect(0, fascia, w, 8);
    return { c: o.c, h: H };
  }

  /* ---------- mount ---------- */

  function mount(host) {
    if (!host || host.__tlHero) return;
    host.__tlHero = true;
    var cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Animation: TissueTape closes the dead space between tissue layers');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, dpr = 1, G = null, i;
    var R = rng(5), fluid = [];
    for (i = 0; i < 40; i++) fluid.push({ u: R(), v: R(), r: .8 + R() * 2.4, sp: .15 + R() * .5, ph: R() * 6.28 });

    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    addEventListener('pointermove', function (e) { ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5; }, { passive: true });

    function layout() {
      var compact = W < 560;
      var x0 = W * (compact ? .02 : .03), x1 = W * (compact ? .98 : .97), span = x1 - x0;
      var unit = Math.min(H * 1.05, W * (compact ? .9 : .56));
      return {
        compact: compact, x0: x0, x1: x1, span: span, unit: unit,
        epi: unit * .022, derm: unit * .06, fat: unit * .2, fascia: unit * .03, muscle: unit * .13,
        tapeT: unit * .02, lift: unit * .17, fasciaTop: H * .66
      };
    }

    function resize() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(10, r.width); H = Math.max(10, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      G = layout();
      G.flap = buildFlap(G.span, G.epi, G.derm, G.fat, dpr);
      G.base = buildBase(G.span, G.fascia, G.muscle, dpr);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    resize();

    function draw(t) {
      if (!G) return;
      var P = reduced ? { gap: 0, tape: 1, glow: 0, tapeA: 1, cut: 1, knife: 0, knifeA: 0, alpha: 1, step: 3 } : phase(t % LOOP);
      ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;
      ctx.clearRect(0, 0, W, H);
      var x0 = G.x0, span = G.span, unit = G.unit, x, y;
      var fTop = G.fasciaTop + ptr.y * 6;
      var cx = x0 + span * .54, lift = G.lift * P.gap;
      var tx0 = x0 + span * .2, tapeLen = span * .66;

      function bump(x) { var u = (x - cx) / (span * .36); if (Math.abs(u) >= 1) return 0; var c = Math.cos(u * Math.PI / 2); return c * c * (1 + .12 * u); }
      function tapeAt(x) {
        var end = tx0 + tapeLen * P.tape; if (x < tx0 || x > end) return 0;
        return smooth(Math.min(x - tx0, end - x) / (unit * .16)) * P.tapeA;
      }
      function flapBottom(x) { return fTop - G.tapeT * tapeAt(x) * (1 - P.gap) - lift * bump(x) + ptr.x * 3 * bump(x); }
      var FH = G.flap.h;

      // fascia + muscle
      ctx.drawImage(G.base.c, x0, fTop, span, G.base.h);

      // seroma in the dead space
      if (P.gap > .01) {
        ctx.save();
        ctx.beginPath();
        var N = Math.round(span / 4);
        for (i = 0; i <= N; i++) { x = x0 + span * i / N; i ? ctx.lineTo(x, flapBottom(x)) : ctx.moveTo(x, flapBottom(x)); }
        ctx.lineTo(x0 + span, fTop); ctx.lineTo(x0, fTop); ctx.closePath(); ctx.clip();
        var top = fTop - lift - 2;
        var sg = ctx.createLinearGradient(0, top, 0, fTop);
        sg.addColorStop(0, '#6b4524');
        sg.addColorStop(.14, '#d9ad62');
        sg.addColorStop(.6, '#ecca84');
        sg.addColorStop(1, '#f4dca0');
        ctx.globalAlpha = Math.min(1, P.gap * 1.6);
        ctx.fillStyle = sg; ctx.fillRect(x0, top, span, fTop - top);
        ctx.globalAlpha = 1;
        fluid.forEach(function (p) {
          var fx = cx + (p.u - .5) * span * .56 + Math.sin(t * p.sp + p.ph) * 5;
          var ft = flapBottom(fx); if (fTop - ft < 6) return;
          var fy = ft + (fTop - ft) * (.2 + .7 * p.v) + Math.cos(t * p.sp * 1.3 + p.ph) * 2.5;
          var b = ctx.createRadialGradient(fx - p.r * .3, fy - p.r * .3, 0, fx, fy, p.r);
          b.addColorStop(0, 'rgba(255,250,235,' + .9 * P.gap + ')'); b.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = b; ctx.beginPath(); ctx.arc(fx, fy, p.r, 0, 6.283); ctx.fill();
        });
        ctx.fillStyle = 'rgba(255,245,220,' + .35 * P.gap + ')'; ctx.fillRect(x0, fTop - 1.5, span, 1.5);
        ctx.restore();
      }

      // TissueTape: three translucent offset films
      if (P.tape > 0 && P.tapeA > 0) {
        var films = [['176,208,232', .78], ['120,170,220', .72], ['210,232,246', .82]], lt = G.tapeT / 3;
        for (var L = 0; L < 3; L++) {
          var off = (L - 1) * unit * .018, s0 = tx0 + off, len = tapeLen * P.tape, yb = fTop - L * lt, y0 = yb - lt * .95;
          var tg = ctx.createLinearGradient(0, y0, 0, yb);
          tg.addColorStop(0, 'rgba(255,255,255,' + .9 * P.tapeA + ')');
          tg.addColorStop(.35, 'rgba(' + films[L][0] + ',' + films[L][1] * P.tapeA + ')');
          tg.addColorStop(1, 'rgba(' + films[L][0] + ',' + films[L][1] * .8 * P.tapeA + ')');
          ctx.fillStyle = tg;
          ctx.beginPath(); ctx.moveTo(s0, yb); ctx.lineTo(s0 + len, yb); ctx.lineTo(s0 + len - lt * .6, y0); ctx.lineTo(s0 + lt * .6, y0); ctx.closePath(); ctx.fill();
        }
      }

      // flap, deformed column by column
      var col = 2;
      for (var xx = 0; xx < span; xx += col) {
        var X = x0 + xx, yTop = flapBottom(X + col / 2) - FH;
        ctx.drawImage(G.flap.c, xx * dpr, 0, (col + .6) * dpr, FH * dpr, X, yTop, col + .6, FH);
      }
      // skin surface seen slightly from above, for depth
      ctx.save();
      ctx.beginPath();
      var M = Math.round(span / 4), depthPx = unit * .028;
      for (i = 0; i <= M; i++) { x = x0 + span * i / M; y = flapBottom(x) - FH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      for (i = M; i >= 0; i--) { x = x0 + span * i / M; ctx.lineTo(x + depthPx * .35, flapBottom(x) - FH - depthPx); }
      ctx.closePath();
      var top2 = fTop - FH - lift - depthPx;
      var surf = ctx.createLinearGradient(0, top2, 0, top2 + depthPx + lift);
      surf.addColorStop(0, 'rgba(226,182,156,.85)'); surf.addColorStop(1, 'rgba(250,224,204,.95)');
      ctx.fillStyle = surf; ctx.fill();
      ctx.restore();
      if (P.gap > .02) {
        ctx.save(); ctx.globalAlpha = .45 * P.gap;
        var sh = ctx.createLinearGradient(0, fTop - 10, 0, fTop + 6);
        sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(30,15,10,.6)');
        ctx.fillStyle = sh; ctx.fillRect(cx - span * .3, fTop - 10, span * .6, 16); ctx.restore();
      }

      // dissection line opened by the scalpel
      var cutStart = cx - span * .36, cutEnd = cx + span * .36;
      var tipX = cutStart - span * .03 + (cutEnd - cutStart + span * .03) * P.knife;
      if (P.cut > 0 && P.gap < .6) {
        var ce = Math.min(tipX, cutEnd), ca = 1 - P.gap / .6;
        if (ce > cutStart) {
          ctx.save(); ctx.globalAlpha = ca;
          ctx.strokeStyle = 'rgba(110,16,22,.95)'; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(cutStart, flapBottom(cutStart) + .5);
          for (x = cutStart; x <= ce; x += 4) ctx.lineTo(x, flapBottom(x) + .5);
          ctx.stroke();
          ctx.fillStyle = 'rgba(150,20,28,.85)';
          for (i = 0; i < 14; i++) {
            var bx = cutStart + (ce - cutStart) * ((i * 0.618) % 1);
            ctx.beginPath(); ctx.arc(bx, flapBottom(bx) + 1.5, 1 + (i % 3) * .5, 0, 6.283); ctx.fill();
          }
          ctx.restore();
        }
      }

      // bond line
      if (P.gap === 0 && P.tapeA === 1) {
        var gA = .25 + .75 * P.glow;
        ctx.save(); ctx.shadowColor = 'rgba(127,196,232,' + gA + ')'; ctx.shadowBlur = 16 * gA + 3;
        ctx.strokeStyle = 'rgba(214,236,250,' + (.35 + .6 * P.glow) + ')'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        var Q = Math.round(tapeLen / 4);
        for (i = 0; i <= Q; i++) { x = tx0 + tapeLen * i / Q; i ? ctx.lineTo(x, flapBottom(x)) : ctx.moveTo(x, flapBottom(x)); }
        ctx.stroke(); ctx.restore();
      }

      // fade the cut edges into the page
      ctx.save(); ctx.globalCompositeOperation = 'destination-in';
      var fxg = ctx.createLinearGradient(x0, 0, x0 + span, 0);
      fxg.addColorStop(0, 'rgba(0,0,0,0)'); fxg.addColorStop(.14, 'rgba(0,0,0,1)'); fxg.addColorStop(.86, 'rgba(0,0,0,1)'); fxg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fxg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      var fyg = ctx.createLinearGradient(0, fTop + G.fascia, 0, fTop + G.base.h);
      fyg.addColorStop(0, 'rgba(0,0,0,0)'); fyg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = fyg; ctx.fillRect(0, fTop + G.fascia, W, G.base.h);
      ctx.fillStyle = '#000'; ctx.fillRect(0, fTop + G.base.h, W, H);
      ctx.restore();

      // labels
      var fs = clamp(W * .0105, 9.5, 12);
      ctx.font = '600 ' + fs + 'px "Schibsted Grotesk", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      function label(text, lx, ly, a, align) {
        if (a <= .01) return;
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = align || 'left';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.16em';
        ctx.shadowColor = 'rgba(5,12,20,.9)'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, lx, ly); ctx.restore();
      }
      var lx = x0 + span * .12, fb = flapBottom(lx);
      if (!G.compact) {
        label('SKIN', lx, fb - FH + (G.epi + G.derm) / 2, .95);
        label('FAT', lx, fb - G.fat / 2, .95);
        label('FASCIA', lx, fTop + G.fascia / 2, .95);
        label('MUSCLE', lx, fTop + G.fascia + G.muscle * .35, .8);
      }
      label('DEAD SPACE', cx, (flapBottom(cx) + fTop) / 2, smooth((P.gap - .35) / .5) * (1 - P.tape * .4), 'center');
      // TissueTape callout: leader line from the tape up above the skin
      var la = P.gap < .05 ? smooth((P.tape - .8) / .2) * P.tapeA : 0;
      if (la > .01) {
        var ex = tx0 + tapeLen * .78, ey = fTop - G.tapeT * .5, ty = flapBottom(ex) - FH - unit * .09;
        ctx.save(); ctx.globalAlpha = la;
        ctx.strokeStyle = 'rgba(214,236,250,.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ty); ctx.lineTo(ex + unit * .05, ty); ctx.stroke();
        ctx.fillStyle = '#D6ECFA'; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, 6.283); ctx.fill();
        ctx.restore();
        label('TISSUETAPE', ex + unit * .06, ty, la);
      }

      // scalpel
      if (P.knifeA > .01) {
        ctx.save(); ctx.globalAlpha = P.knifeA;
        ctx.translate(tipX, fTop - 1.5); ctx.rotate(.085);
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
        drawScalpel(ctx, unit * .62, unit * .075);
        ctx.restore();
      }

      // step caption
      var nowS = performance.now() / 1000;
      if (P.step !== capStep) { capPrev = capStep; capStep = P.step; capT = nowS; }
      var capA = smooth((nowS - capT) / .5);
      var caps = { 1: 'Surgery creates dead space', 2: 'TissueTape is placed', 3: 'Tissue planes bond. No drain.' };
      var cy = fTop - FH - unit * .075, capX = x0 + span * .12;
      if (caps[capStep] && !reduced) {
        ctx.save(); ctx.globalAlpha = capA;
        ctx.font = '600 ' + clamp(W * .012, 11, 14) + 'px "Schibsted Grotesk", system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.02em';
        ctx.fillStyle = '#7FC4E8'; ctx.fillText('0' + capStep, capX, cy);
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(caps[capStep], capX + clamp(W * .012, 11, 14) * 2.2, cy);
        ctx.restore();
      }

      if (P.alpha < 1) {
        ctx.save(); ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = 'rgba(0,0,0,' + P.alpha + ')'; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    }

    var capStep = 0, capPrev = 0, capT = 0;
    var start = performance.now(), visible = true, raf = 0;
    function frame(now) { raf = 0; draw(window.__tlHeroT != null ? window.__tlHeroT : (now - start) / 1000); if (visible && !reduced) raf = requestAnimationFrame(frame); }
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf && !reduced) raf = requestAnimationFrame(frame); }).observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw((performance.now() - start) / 1000); });
    raf = requestAnimationFrame(frame);
  }

  window.TLHero = { mount: mount };
})();
