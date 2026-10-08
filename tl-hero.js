/*
 * Tissuelock hero — "closing the gap".
 * A cutaway of skin, fat and fascia. Dead space opens beneath the flap, the three-layer
 * TissueTape slides in, the flap settles onto it, and the seam glows where it bonds.
 * Usage: TLHero.mount(element)  — fills the element with a canvas and runs.
 */
(function () {
  'use strict';

  var C = {
    line: '127,196,232',      // #7FC4E8
    mid: '94,143,184',        // #5E8FB8
    deep: '42,127,219',       // #2A7FDB
    pale: '233,244,251',
    label: '159,198,226'
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // Timeline (seconds)
  var T = { open: 1.4, slide: 1.9, close: 1.7, glow: 1.1, hold: 3.2, reopen: 1.8 };
  var LOOP = T.open + T.slide + T.close + T.glow + T.hold + T.reopen;

  function phase(t) {
    var a = T.open, b = a + T.slide, c = b + T.close, d = c + T.glow, e = d + T.hold;
    var gap, tape, glow, tapeAlpha = 1;
    if (t < a) { gap = 1; tape = 0; glow = 0; }
    else if (t < b) { gap = 1; tape = ease((t - a) / T.slide); glow = 0; }
    else if (t < c) { gap = 1 - ease((t - b) / T.close); tape = 1; glow = 0; }
    else if (t < d) { gap = 0; tape = 1; glow = Math.sin(Math.PI * (t - c) / T.glow); }
    else if (t < e) { gap = 0; tape = 1; glow = 0; }
    else { var r = ease((t - e) / T.reopen); gap = r; tape = 1; tapeAlpha = 1 - r; glow = 0; }
    return { gap: gap, tape: tape, glow: glow, tapeAlpha: tapeAlpha };
  }

  function mount(host) {
    if (!host || host.__tlHero) return;
    host.__tlHero = true;
    var cv = document.createElement('canvas');
    cv.setAttribute('aria-label', 'Animation: TissueTape closes the dead space between tissue layers');
    cv.setAttribute('role', 'img');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Static scatter, generated once in normalised coords
    var R = rnd(7), lobules = [], fibres = [], fluid = [];
    for (var i = 0; i < 70; i++) lobules.push({ u: R(), v: .12 + R() * .76, s: .55 + R() * .6, k: R() });
    for (i = 0; i < 26; i++) fibres.push({ u: R(), o: R() });
    for (i = 0; i < 46; i++) fluid.push({ u: R(), v: R(), r: .6 + R() * 1.6, sp: .2 + R() * .6, ph: R() * 6.28 });

    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', function (e) {
      ptr.tx = (e.clientX / innerWidth - .5); ptr.ty = (e.clientY / innerHeight - .5);
    }, { passive: true });

    function resize() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(10, r.width); H = Math.max(10, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    resize();

    function draw(t) {
      var P = reduced ? { gap: 0, tape: 1, glow: 0, tapeAlpha: 1 } : phase(t % LOOP);
      ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;
      ctx.clearRect(0, 0, W, H);

      // Layout
      var compact = W < 560;
      var x0 = W * (compact ? .04 : .03), x1 = W * (compact ? .96 : .97), span = x1 - x0;
      var unit = Math.min(H * 1.1, W * (compact ? .85 : .55));
      var fasciaTop = H * .7 + ptr.y * 6;
      var fasciaT = unit * .035, skinT = unit * .05, fatT = unit * .2;
      var tapeT = unit * .02;
      var lift = unit * .17 * P.gap;
      var cx = x0 + span * .54;

      function bump(x) { // dead-space profile, 0..1
        var u = (x - cx) / (span * .36);
        if (Math.abs(u) >= 1) return 0;
        var c = Math.cos(u * Math.PI / 2); return c * c * (1 + .12 * u);
      }
      // tape occupies [tx0, tx0 + tapeLen*tape]
      var tx0 = x0 + span * .2, tapeLen = span * .66;
      function tapeAt(x) {
        var end = tx0 + tapeLen * P.tape;
        if (x < tx0 || x > end) return 0;
        var e = Math.min(x - tx0, end - x) / (unit * .16);
        return smooth(e) * P.tapeAlpha;
      }
      function flapBottom(x) { return fasciaTop - tapeT * tapeAt(x) * (1 - P.gap) - lift * bump(x) + ptr.x * 3 * bump(x); }

      var N = Math.max(80, Math.round(span / 6));
      function path(fn, close2) {
        ctx.beginPath();
        for (var i = 0; i <= N; i++) { var x = x0 + span * i / N; var y = fn(x); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        if (close2) for (i = N; i >= 0; i--) { x = x0 + span * i / N; ctx.lineTo(x, close2(x)); }
      }
      var fadeX = ctx.createLinearGradient(x0, 0, x1, 0);
      function edgeFade(rgb, a) {
        var g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(.08, 'rgba(' + rgb + ',' + a + ')');
        g.addColorStop(.92, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        return g;
      }

      // ---- Muscle (below fascia): faint striations
      for (i = 0; i < 6; i++) {
        var dy = fasciaT + unit * (.03 + i * .028);
        ctx.strokeStyle = edgeFade(C.mid, .22 * (1 - i / 7)); ctx.lineWidth = 1;
        path(function (x) { return fasciaTop + dy + Math.sin(x / 38 + i) * 1.4; }); ctx.stroke();
      }

      // ---- Fascia band
      ctx.fillStyle = edgeFade(C.mid, .14);
      path(function () { return fasciaTop; }, function () { return fasciaTop + fasciaT; }); ctx.fill();
      ctx.strokeStyle = edgeFade(C.line, .75); ctx.lineWidth = 1.4;
      path(function () { return fasciaTop; }); ctx.stroke();
      ctx.strokeStyle = edgeFade(C.mid, .45); ctx.lineWidth = 1;
      path(function () { return fasciaTop + fasciaT; }); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x0, fasciaTop, span, fasciaT); ctx.clip();
      ctx.strokeStyle = 'rgba(' + C.mid + ',.28)'; ctx.lineWidth = .8;
      fibres.forEach(function (f) {
        var x = x0 + span * f.u; ctx.beginPath(); ctx.moveTo(x, fasciaTop); ctx.lineTo(x + fasciaT * (1.8 + f.o), fasciaTop + fasciaT); ctx.stroke();
      });
      ctx.restore();

      // ---- Dead space: fluid + outline
      if (P.gap > .02) {
        ctx.save();
        path(function (x) { return flapBottom(x); }, function () { return fasciaTop; });
        ctx.clip();
        var gg = ctx.createLinearGradient(0, fasciaTop - lift, 0, fasciaTop);
        gg.addColorStop(0, 'rgba(' + C.deep + ',' + .05 * P.gap + ')'); gg.addColorStop(1, 'rgba(' + C.deep + ',' + .16 * P.gap + ')');
        ctx.fillStyle = gg; ctx.fillRect(x0, fasciaTop - lift - 4, span, lift + 4);
        fluid.forEach(function (p) {
          var x = cx + (p.u - .5) * span * .58 + Math.sin(t * p.sp + p.ph) * 6;
          var top = flapBottom(x), y = top + (fasciaTop - top) * (.15 + .75 * p.v) + Math.cos(t * p.sp * 1.3 + p.ph) * 3;
          ctx.fillStyle = 'rgba(' + C.line + ',' + (.55 * P.gap) + ')';
          ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        });
        ctx.restore();
      }

      // ---- TissueTape: three offset layers
      if (P.tape > 0 && P.tapeAlpha > 0) {
        var cols = [C.mid, C.deep, C.line], lt = tapeT / 3;
        for (var L = 0; L < 3; L++) {
          var off = (L - 1) * unit * .018, s0 = tx0 + off, len = tapeLen * P.tape;
          ctx.fillStyle = 'rgba(' + cols[L] + ',' + (.55 + .15 * L) * P.tapeAlpha + ')';
          var yb = fasciaTop - L * lt, y0 = yb - lt * .92;
          ctx.beginPath(); ctx.moveTo(s0, yb);
          ctx.lineTo(s0 + len, yb); ctx.lineTo(s0 + len - lt * .6, y0); ctx.lineTo(s0 + lt * .6, y0); ctx.closePath(); ctx.fill();
        }
      }

      // ---- Flap: fat + skin
      var fatTop = function (x) { return flapBottom(x) - fatT; };
      var skinTop = function (x) { return fatTop(x) - skinT; };
      ctx.fillStyle = edgeFade(C.mid, .07);
      path(fatTop, flapBottom); ctx.fill();
      ctx.fillStyle = edgeFade(C.mid, .12);
      path(skinTop, fatTop); ctx.fill();
      // lobules
      ctx.save(); path(fatTop, flapBottom); ctx.clip();
      lobules.forEach(function (l) {
        var x = x0 + span * l.u, yb = flapBottom(x), y = yb - fatT * l.v;
        var rx = fatT * .2 * l.s, ry = fatT * .13 * l.s;
        ctx.strokeStyle = 'rgba(' + C.mid + ',' + (.22 + .18 * l.k) + ')'; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, (l.k - .5) * .5, 0, 6.283); ctx.stroke();
      });
      ctx.restore();
      // boundaries
      ctx.lineWidth = 1.5; ctx.strokeStyle = edgeFade(C.line, .85); path(flapBottom); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = edgeFade(C.mid, .55); path(fatTop); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = edgeFade(C.pale, .8); path(skinTop); ctx.stroke();
      ctx.lineWidth = .8; ctx.strokeStyle = edgeFade(C.mid, .35);
      path(function (x) { return skinTop(x) + skinT * .45 + Math.sin(x / 9) * 1.1; }); ctx.stroke();

      // ---- Bond glow along the seam
      if (P.glow > 0 || (P.gap === 0 && P.tapeAlpha === 1)) {
        var gA = .15 + .85 * P.glow;
        ctx.save(); ctx.shadowColor = 'rgba(' + C.line + ',' + gA + ')'; ctx.shadowBlur = 18 * gA + 4;
        ctx.strokeStyle = 'rgba(' + C.pale + ',' + (.35 + .6 * P.glow) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (i = 0; i <= N; i++) {
          var x = tx0 + tapeLen * i / N; var y = flapBottom(x);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.restore();
      }

      // ---- Labels
      var fs = clamp(W * .011, 9.5, 12);
      ctx.font = '600 ' + fs + 'px "Schibsted Grotesk", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      function label(text, x, y, a, align) {
        if (a <= .01) return;
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = align || 'left';
        ctx.fillStyle = 'rgb(' + C.label + ')';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.16em';
        ctx.fillText(text, x, y); ctx.restore();
      }
      var lx = x0 + span * .025;
      if (!compact) {
        label('SKIN', lx, skinTop(lx) + skinT / 2, .9);
        label('FAT', lx, fatTop(lx) + fatT / 2, .9);
        label('FASCIA', lx, fasciaTop + fasciaT / 2 + 1, .9);
      }
      var gy = (flapBottom(cx) + fasciaTop) / 2;
      label('DEAD SPACE', cx, gy, smooth((P.gap - .35) / .5) * (1 - P.tape * .4), 'center');
      var tapeLabelA = P.gap < .05 ? smooth((P.tape - .8) / .2) * P.tapeAlpha : 0;
      var tlx = tx0 + tapeLen + unit * .03;
      label('TISSUETAPE', Math.min(tlx, x1 - 4), fasciaTop - tapeT * .5, tapeLabelA, tlx > x1 - 90 ? 'right' : 'left');
    }

    var start = performance.now(), visible = true, raf = 0;
    function frame(now) { raf = 0; draw(window.__tlHeroT != null ? window.__tlHeroT : (now - start) / 1000); if (visible && !reduced) raf = requestAnimationFrame(frame); }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting; if (visible && !raf && !reduced) raf = requestAnimationFrame(frame);
      }).observe(host);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw((performance.now() - start) / 1000); });
    raf = requestAnimationFrame(frame);
  }

  window.TLHero = { mount: mount };
})();
