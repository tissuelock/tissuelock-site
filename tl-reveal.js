/* Scroll-in reveal for [data-photo-reveal] tiles (About page photos). Staggered by data-delay (ms).
   Watches each tile's parent, because a fully clipped tile never registers as visible. */
(function () {
  'use strict';
  function show(group) {
    group.querySelectorAll('[data-photo-reveal]').forEach(function (el) {
      var d = parseInt(el.getAttribute('data-delay') || '0', 10) * 1.6;
      setTimeout(function () { el.setAttribute('data-in', ''); }, d);
    });
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }) : null;
  function scan() {
    document.querySelectorAll('[data-photo-reveal]').forEach(function (el) {
      var g = el.parentElement;
      if (!g || g.hasAttribute('data-photo-group')) return;
      g.setAttribute('data-photo-group', '');
      if (io) io.observe(g); else show(g);
    });
  }
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', scan);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();

/* Technology page SEM photo: play the Tissuelock reveal when it scrolls into view (hover still works too). */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.intersectionRatio >= 0.55) e.target.setAttribute('data-sem-on', '');
      else if (e.intersectionRatio < 0.15) e.target.removeAttribute('data-sem-on');   // reset so it replays next time
    });
  }, { threshold: [0, 0.15, 0.55] });
  function scan() {
    document.querySelectorAll('[data-sem]:not([data-sem-watched])').forEach(function (el) {
      el.setAttribute('data-sem-watched', ''); io.observe(el);
    });
  }
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', scan);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
