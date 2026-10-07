/*
 * Tissuelock site — text edit mode.
 * Visit the site with ?edit at the end of the address (e.g. tissuelock.com/?edit),
 * click any text to change it, then press Publish. Publishing saves the new text
 * straight into index.html on GitHub; the live site updates in a minute or two.
 * Does nothing for normal visitors.
 */
(function () {
  'use strict';
  if (!/[?&]edit\b/.test(location.search)) return;

  var REPO = 'tissuelock/tissuelock-site';
  var BRANCH = 'main';
  var FILE = 'index.html';
  var TOKEN_KEY = 'tl-edit-token';

  var originals = {};   // id -> text as first loaded
  var bar, countEl, statusEl;

  // ---------- helpers ----------
  function textOf(el) {
    var s = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeName === 'BR') s += '\n';
      else if (n.nodeName === 'DIV' || n.nodeName === 'P') s += (s ? '\n' : '') + textOf(n);
      else s += textOf(n);
    });
    return s;
  }
  function norm(s) {
    return s.split('\n').map(function (l) {
      return l.replace(/[ \t\r\f\v]+/g, ' ').replace(/^ +| +$/g, '');
    }).join('\n').replace(/^\n+|\n+$/g, '');
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Turn edited text into HTML, keeping deliberate non-breaking spaces (e.g. "St.&nbsp;Louis").
  function toHtml(text, original) {
    var keep = (original.match(/\S+ \S+/g) || []);
    var t = text.replace(/ /g, ' ').replace(/ {2,}/g, ' ');
    keep.forEach(function (pair) {
      t = t.split(pair.replace(/ /g, ' ')).join(pair);
    });
    return esc(t).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
  }
  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  // Replace the inner content of the element carrying data-edit="id" in the page source.
  function replaceInSource(src, id, html) {
    var attr = 'data-edit="' + id + '"';
    var at = src.indexOf(attr);
    if (at < 0 || src.indexOf(attr, at + 1) >= 0) throw new Error('Could not find text block ' + id + ' in the page source.');
    var open = src.lastIndexOf('<', at);
    var tag = /^<([a-zA-Z0-9-]+)/.exec(src.slice(open))[1];
    var i = at, q = null;
    for (; i < src.length; i++) {           // end of the opening tag, skipping quoted attribute values
      var c = src[i];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
    }
    var close = src.indexOf('</' + tag, i);
    if (close < 0) throw new Error('Malformed source around ' + id + '.');
    return src.slice(0, i + 1) + html + src.slice(close);
  }

  // ---------- UI ----------
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '[data-edit][contenteditable]{outline:1px dashed rgba(127,196,232,.55);outline-offset:3px;cursor:text;border-radius:2px}' +
      '[data-edit][contenteditable]:hover{outline-color:#7FC4E8}' +
      '[data-edit][contenteditable]:focus{outline:2px solid #2A7FDB;outline-offset:3px}' +
      '[data-edit].tl-changed{outline:2px solid #E8B44A !important}' +
      '#tl-edit-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;' +
      'max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:14px;background:#0B1B2C;color:#E9ECEF;border:1px solid rgba(127,196,232,.35);' +
      'box-shadow:0 12px 40px rgba(0,0,0,.45);font:500 14px/1.3 "Schibsted Grotesk",system-ui,sans-serif}' +
      '#tl-edit-bar button{font:inherit;border-radius:9px;padding:8px 14px;cursor:pointer;border:1px solid rgba(233,236,239,.25);background:transparent;color:inherit}' +
      '#tl-edit-bar button.primary{background:#2A7FDB;border-color:#2A7FDB;color:#fff}' +
      '#tl-edit-bar button:disabled{opacity:.45;cursor:default}' +
      '#tl-edit-status{color:#9FB4C6;font-weight:400}' +
      '#tl-edit-modal{position:fixed;inset:0;z-index:2147483001;background:rgba(5,15,25,.72);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#tl-edit-modal .box{width:min(520px,100%);background:#0B1B2C;color:#E9ECEF;border:1px solid rgba(127,196,232,.35);border-radius:16px;padding:24px;font:400 15px/1.55 "Schibsted Grotesk",system-ui,sans-serif}' +
      '#tl-edit-modal h3{margin:0 0 10px;font-size:20px;font-weight:600}' +
      '#tl-edit-modal ol{margin:0 0 14px;padding-left:20px;color:#C6D3DE}' +
      '#tl-edit-modal a{color:#7FC4E8}' +
      '#tl-edit-modal input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid rgba(233,236,239,.25);background:#071624;color:#fff;font:inherit;margin:4px 0 10px}' +
      '#tl-edit-modal .row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}' +
      '#tl-edit-modal button{font:inherit;border-radius:9px;padding:8px 14px;cursor:pointer;border:1px solid rgba(233,236,239,.25);background:transparent;color:inherit}' +
      '#tl-edit-modal button.primary{background:#2A7FDB;border-color:#2A7FDB;color:#fff}';
    document.head.appendChild(s);
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.id = 'tl-edit-bar';
    bar.innerHTML =
      '<span>Edit mode — click any text</span>' +
      '<span id="tl-edit-status"></span>' +
      '<button type="button" data-act="discard">Discard</button>' +
      '<button type="button" data-act="publish" class="primary">Publish</button>' +
      '<button type="button" data-act="exit">Exit</button>';
    document.body.appendChild(bar);
    statusEl = bar.querySelector('#tl-edit-status');
    bar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'discard') discard();
      if (act === 'publish') publish();
      if (act === 'exit') {
        if (changedIds().length && !confirm('You have unpublished changes. Leave anyway?')) return;
        location.href = location.pathname;
      }
    });
    refresh();
  }

  function changedIds() {
    return Object.keys(originals).filter(function (id) {
      var el = document.querySelector('[data-edit="' + id + '"]');
      return el && norm(textOf(el)) !== originals[id];
    });
  }

  function refresh() {
    var ids = changedIds();
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      el.classList.toggle('tl-changed', ids.indexOf(el.getAttribute('data-edit')) >= 0);
    });
    if (statusEl && !statusEl.dataset.sticky) {
      statusEl.textContent = ids.length ? '· ' + ids.length + ' unpublished change' + (ids.length > 1 ? 's' : '') : '';
    }
    window.onbeforeunload = ids.length ? function () { return 'unsaved'; } : null;
  }

  function say(msg, sticky) {
    statusEl.textContent = msg;
    if (sticky) statusEl.dataset.sticky = '1'; else delete statusEl.dataset.sticky;
  }

  function discard() {
    changedIds().forEach(function (id) {
      var el = document.querySelector('[data-edit="' + id + '"]');
      el.innerHTML = esc(originals[id]).replace(/\n/g, '<br>');
    });
    refresh();
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function askToken() {
    return new Promise(function (resolve) {
      var m = document.createElement('div');
      m.id = 'tl-edit-modal';
      m.innerHTML =
        '<div class="box"><h3>Connect to GitHub (one time)</h3>' +
        '<p style="margin:0 0 10px;color:#C6D3DE">Publishing saves your text straight to the website files on GitHub. It needs a key that only works on this one repository.</p>' +
        '<ol><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → new fine-grained token</a> (signed in as tissuelock).</li>' +
        '<li>Name it "website editor". Expiration: your choice.</li>' +
        '<li>Repository access: <b>Only select repositories</b> → <b>tissuelock-site</b>.</li>' +
        '<li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>' +
        '<li>Click <b>Generate token</b>, copy it, paste it below.</li></ol>' +
        '<input type="password" placeholder="github_pat_…" autocomplete="off">' +
        '<label style="display:flex;gap:8px;align-items:center;color:#C6D3DE"><input type="checkbox" checked> Remember on this browser</label>' +
        '<div class="row"><button type="button" data-a="cancel">Cancel</button><button type="button" class="primary" data-a="ok">Save &amp; publish</button></div></div>';
      document.body.appendChild(m);
      var input = m.querySelector('input[type=password]');
      var remember = m.querySelector('input[type=checkbox]');
      input.focus();
      m.addEventListener('click', function (e) {
        var a = e.target.getAttribute && e.target.getAttribute('data-a');
        if (a === 'cancel') { m.remove(); resolve(null); }
        if (a === 'ok') {
          var t = input.value.trim();
          if (!t) return;
          try { (remember.checked ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); } catch (err) {}
          m.remove(); resolve(t);
        }
      });
    });
  }

  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function api(token, method, body) {
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + FILE + (method === 'GET' ? '?ref=' + BRANCH + '&t=' + Date.now() : ''), {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  }

  var busy = false;
  async function publish() {
    var ids = changedIds();
    if (!ids.length) { say('Nothing to publish yet.'); return; }
    if (busy) return;
    var token = getToken() || await askToken();
    if (!token) return;
    busy = true;
    bar.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    say('Publishing…', true);
    try {
      for (var attempt = 0; attempt < 2; attempt++) {
        var r = await api(token, 'GET');
        if (r.status === 401 || r.status === 403 || r.status === 404) {
          forgetToken();
          throw new Error('GitHub rejected the key (' + r.status + '). Press Publish again to enter a new one.');
        }
        if (!r.ok) throw new Error('Could not read the site files (' + r.status + ').');
        var file = await r.json();
        var src = b64decode(file.content);
        ids.forEach(function (id) {
          var el = document.querySelector('[data-edit="' + id + '"]');
          src = replaceInSource(src, id, toHtml(norm(textOf(el)), originals[id]));
        });
        var p = await api(token, 'PUT', {
          message: 'Edit website text (' + ids.length + ' change' + (ids.length > 1 ? 's' : '') + ')',
          content: b64encode(src), sha: file.sha, branch: BRANCH
        });
        if (p.status === 409 && attempt === 0) continue;   // file changed meanwhile; retry on fresh copy
        if (p.status === 401 || p.status === 403) {
          forgetToken();
          throw new Error('The key can’t write to the repo (' + p.status + '). Check it has Contents: Read and write, then try again.');
        }
        if (!p.ok) throw new Error('Publishing failed (' + p.status + ').');
        break;
      }
      ids.forEach(function (id) {
        var el = document.querySelector('[data-edit="' + id + '"]');
        originals[id] = norm(textOf(el));
      });
      refresh();
      say('✓ Published. Live in 1–2 minutes (refresh to see it).', true);
    } catch (err) {
      say(err.message, true);
    } finally {
      busy = false;
      bar.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    }
  }

  // ---------- wiring ----------
  function enable(el) {
    if (el.hasAttribute('contenteditable')) return;
    var id = el.getAttribute('data-edit');
    if (!(id in originals)) originals[id] = norm(textOf(el));
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.spellcheck = true;
  }

  function start() {
    css();
    document.querySelectorAll('[data-edit]').forEach(enable);
    buildBar();

    // Re-enable on anything the page re-renders (e.g. opening the menu).
    function sweep() {
      document.querySelectorAll('[data-edit]:not([contenteditable])').forEach(enable);
    }
    new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(sweep, 700);

    document.addEventListener('input', function (e) {
      if (e.target.closest && e.target.closest('[data-edit]')) { delete statusEl.dataset.sticky; refresh(); }
    }, true);

    // Enter finishes editing; Shift+Enter adds a line break.
    document.addEventListener('keydown', function (e) {
      var el = e.target.closest && e.target.closest('[data-edit]');
      if (!el) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') el.blur();
    }, true);

    // Plain-text paste only.
    document.addEventListener('paste', function (e) {
      var el = e.target.closest && e.target.closest('[data-edit]');
      if (!el) return;
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ');
      document.execCommand('insertText', false, t);
    }, true);

    // Links and buttons don't navigate while editing (the menu button still works).
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('#tl-edit-bar,#tl-edit-modal,[data-burger-btn],[aria-label="Close menu"]')) return;
      var link = e.target.closest('a,button');
      if (link) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  // Wait for the page to finish rendering.
  var tries = 0;
  (function wait() {
    if (document.body && document.querySelector('#dc-root [data-edit]')) return start();
    if (++tries > 200) return;
    setTimeout(wait, 100);
  })();
})();
