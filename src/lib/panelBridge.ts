// Scripts injected into the website panels the app shows in a WebView
// (super-admin /dashboard/s-admin, developer /dashboard/developer, the map
// editor and the projects intake). The panels themselves are the website's own
// pages — every option and every server rule is the same — this file only:
//   1. signs the WebView in with the app's session (bootHtml),
//   2. restyles the page so it feels like an app (the website header, tab row
//      and account menu are replaced by the app's own bars), and
//   3. bridges browser-only features to the phone: file downloads/exports,
//      copy to clipboard, share, new-window links.
//
// Messages to the app are JSON strings: { type: 'shell' | 'download' | 'open' |
// 'clipboard' | 'share' | 'boot' | 'error', ... } — see PanelWebView.tsx.

import { SESSION_COOKIE } from './session';

export type PanelMode = 'shell' | 'frame';

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

/**
 * First page loaded in every panel WebView (served as if from the website's
 * origin). It stores the session cookie, makes sure the WebView's cookie jar
 * belongs to THIS account (an older account's cookie is signed out), then
 * opens the panel.
 */
export function bootHtml(opts: { token: string; email: string; target: string; secure: boolean }): string {
  const cfg = {
    cookie: `${SESSION_COOKIE}=${opts.token}; Path=/; Max-Age=5184000; SameSite=Lax${opts.secure ? '; Secure' : ''}`,
    consent: `mg_cookie_consent=essential; Path=/; Max-Age=31536000; SameSite=Lax${opts.secure ? '; Secure' : ''}`,
    email: opts.email.trim().toLowerCase(),
    target: opts.target,
  };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#f4f6f4;font-family:-apple-system,Roboto,sans-serif}
.w{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;color:#5f6964;font-size:14px}
.s{width:30px;height:30px;border:3px solid #e6f0ec;border-top-color:#0f5c47;border-radius:50%;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div class="w"><div class="s"></div><div>Opening…</div></div>
<script>
(function(){
  var C = ${js(cfg)};
  function post(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  function set(){ document.cookie = C.cookie; document.cookie = C.consent; }
  function who(){
    return fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){ return (j && j.session && j.session.user && String(j.session.user.email || '').toLowerCase()) || ''; });
  }
  function go(){ location.replace(C.target); }
  set();
  who().then(function(email){
    if (email === C.email) return go();
    // Another account's (or an expired) cookie is still in the WebView: end it, then retry once.
    return fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function(){})
      .then(function(){ set(); return who(); })
      .then(function(again){
        if (again === C.email) go();
        else post({ type: 'boot', ok: false });
      });
  }).catch(function(){ post({ type: 'error', message: 'offline' }); });
})();
</script></body></html>`;
}

// ---------------------------------------------------------------------------
// App look for the website's panel shell (admin.css: .adm2 / .adm2-top / .adm2-tabs).
const SHELL_CSS = `
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{overscroll-behavior-y:none;-webkit-tap-highlight-color:transparent}
.adm2-tabs{display:none!important}
.adm2-brand,.adm2-top-right>a.adm-chip,.adm2-top-right>button.adm-chip:not(.nb-bell),.adm2-menu{display:none!important}
.adm2-top{height:56px!important;padding:0 10px 0 16px!important;box-shadow:0 1px 0 rgba(0,0,0,.04)}
#mg-title{flex:1;min-width:0;font:700 18px/1.2 Inter,system-ui,sans-serif;color:#1d2b26;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.2px}
.adm-frame{height:calc(100vh - 56px)!important;height:calc(100dvh - 56px)!important}
.adm-content{padding-bottom:28px!important}
button[aria-label="Install Mappingg app"],.mg-cookie{display:none!important}
`;

// The legacy map editor / intake pages: only hide website-only extras.
const FRAME_CSS = `
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{-webkit-tap-highlight-color:transparent}
button[aria-label="Install Mappingg app"],.mg-cookie{display:none!important}
`;

/** Runs at the start of every page in a panel WebView. */
export function bridgeScript(mode: PanelMode): string {
  const css = mode === 'shell' ? SHELL_CSS : FRAME_CSS;
  return `(function(){
if (window.__mgApp) return; window.__mgApp = true;
var MODE = ${js(mode)};
function post(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }

// ---- app styles ---------------------------------------------------------
function addCss(){
  if (document.getElementById('mg-app-css')) return;
  var st = document.createElement('style'); st.id = 'mg-app-css'; st.textContent = ${js(css)};
  (document.head || document.documentElement).appendChild(st);
}
addCss(); document.addEventListener('DOMContentLoaded', addCss);

// ---- downloads (CSV exports, backups, map image) ------------------------
function sendBlob(blob, name){
  var r = new FileReader();
  r.onload = function(){
    var s = String(r.result || ''); var i = s.indexOf(',');
    post({ type: 'download', name: name || 'download', mime: blob.type || 'application/octet-stream', base64: i >= 0 ? s.slice(i + 1) : '' });
  };
  r.onerror = function(){ post({ type: 'error', message: 'download' }); };
  r.readAsDataURL(blob);
}
function nameFrom(res, url, fallback){
  var cd = res.headers.get('content-disposition') || '';
  var m = /filename\\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd);
  if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
  if (fallback) return fallback;
  try { return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || 'download'); } catch (e) { return 'download'; }
}
function download(url, name){
  post({ type: 'downloading' });
  fetch(url, { credentials: 'same-origin' })
    .then(function(res){ if (!res.ok) throw new Error(String(res.status)); return res.blob().then(function(b){ sendBlob(b, nameFrom(res, url, name)); }); })
    .catch(function(){ post({ type: 'error', message: 'download' }); });
}
function isDownload(a){
  if (!a || !a.href) return false;
  if (a.hasAttribute('download')) return true;
  return /^(blob|data):/i.test(a.href) || /[?&]download=/.test(a.href);
}
var realClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function(){
  if (isDownload(this)) { download(this.href, this.getAttribute('download') || ''); return; }
  if (this.target === '_blank' && this.href) { post({ type: 'open', url: this.href }); return; }
  return realClick.apply(this, arguments);
};
document.addEventListener('click', function(e){
  var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  if (isDownload(a)) { e.preventDefault(); e.stopPropagation(); download(a.href, a.getAttribute('download') || ''); return; }
  if (a.target === '_blank') { e.preventDefault(); e.stopPropagation(); post({ type: 'open', url: a.href }); }
}, true);
window.open = function(url){ if (url) post({ type: 'open', url: new URL(String(url), location.href).href }); return null; };

// ---- clipboard & share --------------------------------------------------
try {
  var clip = { writeText: function(t){ post({ type: 'clipboard', text: String(t) }); return Promise.resolve(); } };
  Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true });
} catch (e) {}
try {
  navigator.share = function(d){ post({ type: 'share', text: (d && (d.text || '')) + (d && d.url ? ' ' + d.url : ''), title: d && d.title }); return Promise.resolve(); };
} catch (e) {}

if (MODE !== 'shell') return;

// ---- panel tabs: reported to the app, driven by the app's bottom bar -----
function label(btn){
  var t = '';
  for (var i = 0; i < btn.childNodes.length; i++) {
    var n = btn.childNodes[i];
    if (n.nodeType === 3) t += n.textContent;
    else if (n.nodeType === 1 && !/tab-badge/.test(n.className || '') && n.tagName !== 'I') t += n.textContent;
  }
  return t.replace(/\\s+/g, ' ').trim();
}
function tabs(){ return Array.prototype.slice.call(document.querySelectorAll('.adm2-tabs .adm2-tab')); }
var menuItems = null;
function probeMenu(){
  if (menuItems) return;
  var chip = document.querySelector('.adm2-top-right > button.adm-chip:not(.nb-bell)');
  if (!chip) return;
  chip.click();
  setTimeout(function(){
    var items = Array.prototype.slice.call(document.querySelectorAll('.adm2-menu button'));
    menuItems = items.map(function(b){ return b.textContent.replace(/\\s+/g, ' ').trim(); })
      .filter(function(t){ return t && !/^(sign out|lock|unlock)/i.test(t); });
    if (document.querySelector('.adm2-menu')) chip.click();
    report(true);
  }, 60);
}
var activeMenu = '';
var last = '';
function report(force){
  var top = document.querySelector('.adm2-top');
  if (!top) return;
  var list = tabs().map(function(b){
    var badge = b.querySelector('.tab-badge');
    return { label: label(b), badge: badge ? badge.textContent.trim() : '', active: b.classList.contains('active') };
  });
  var on = list.filter(function(t){ return t.active; })[0];
  if (on) activeMenu = '';
  var title = on ? on.label : (activeMenu || 'Profile');
  var tEl = document.getElementById('mg-title');
  if (!tEl) { tEl = document.createElement('div'); tEl.id = 'mg-title'; top.insertBefore(tEl, top.firstChild); }
  if (tEl.textContent !== title) tEl.textContent = title;
  var who = document.querySelector('.adm2-top-right .who');
  var img = who && who.querySelector('img');
  var nameEl = document.querySelector('.adm2-top-right .who-meta b');
  var msg = { type: 'shell', tabs: list, menu: menuItems || [], active: on ? on.label : activeMenu,
    name: nameEl ? nameEl.textContent.trim() : '', avatar: img ? img.src : '' };
  var s = JSON.stringify(msg);
  if (force || s !== last) { last = s; post(msg); }
}
// Called by the app: open a tab (or a menu page such as Profile / Settings).
window.__mgGo = function(name){
  var b = tabs().filter(function(x){ return label(x) === name; })[0];
  if (b) { b.click(); window.scrollTo(0, 0); return true; }
  var chip = document.querySelector('.adm2-top-right > button.adm-chip:not(.nb-bell)');
  if (!chip) return false;
  if (!document.querySelector('.adm2-menu')) chip.click();
  setTimeout(function(){
    var item = Array.prototype.slice.call(document.querySelectorAll('.adm2-menu button'))
      .filter(function(x){ return x.textContent.replace(/\\s+/g, ' ').trim() === name; })[0];
    if (item) { item.click(); activeMenu = name; window.scrollTo(0, 0); }
    else if (document.querySelector('.adm2-menu')) chip.click();
    setTimeout(function(){ report(true); }, 30);
  }, 40);
  return true;
};
var queued = false;
function schedule(){ if (queued) return; queued = true; setTimeout(function(){ queued = false; report(false); probeMenu(); }, 150); }
function watch(){
  try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] }); } catch (e) {}
  schedule();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})(); true;`;
}

/** JS the app runs to switch the panel to a tab / menu page by its label. */
export const goToTab = (name: string) => `window.__mgGo && window.__mgGo(${js(name)}); true;`;
