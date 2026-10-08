/*
 * Home page video frame.
 * To add the video, set data-video-src on the [data-tl-video] block in index.html to either:
 *   - a file in this repo, e.g. "assets/video/tissuetape.mp4"
 *   - a YouTube link, e.g. "https://www.youtube.com/watch?v=XXXX" or "https://youtu.be/XXXX"
 *   - a Vimeo link, e.g. "https://vimeo.com/123456789"
 * Leave it empty to show the "coming soon" frame.
 */
(function () {
  'use strict';

  function embedUrl(src) {
    var m = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    m = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&title=0&byline=0&portrait=0&color=7FC4E8';
    return null;
  }

  function play(frame) {
    var src = (frame.getAttribute('data-video-src') || '').trim();
    if (!src || frame.hasAttribute('data-playing')) return;
    var mount = frame.querySelector('[data-tl-video-mount]');
    if (!mount) return;
    var url = embedUrl(src), el;
    if (url) {
      el = document.createElement('iframe');
      el.src = url;
      el.allow = 'autoplay; fullscreen; picture-in-picture';
      el.allowFullscreen = true;
      el.title = 'Tissuelock technology video';
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block';
    } else {
      el = document.createElement('video');
      el.src = src;
      el.controls = true;
      el.playsInline = true;
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#071624;display:block';
    }
    mount.appendChild(el);
    frame.setAttribute('data-playing', '');
    if (el.tagName === 'VIDEO') { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
  }

  // Hide the "coming soon" note once a video is set.
  function sync() {
    document.querySelectorAll('[data-tl-video]').forEach(function (frame) {
      var has = !!(frame.getAttribute('data-video-src') || '').trim();
      var note = frame.querySelector('[data-edit]');
      if (note && has && !/[?&]edit\b/.test(location.search)) note.style.display = 'none';
    });
  }
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-tl-video-play]');
    if (!btn || /[?&]edit\b/.test(location.search)) return;
    var frame = btn.closest('[data-tl-video]');
    if (frame) play(frame);
  });
})();
