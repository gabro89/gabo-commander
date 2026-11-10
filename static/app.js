/* Gabo Commander – kliens (keretrendszer nélkül) */
'use strict';

const ROW_H = 20;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let collator, nf0, nf1, nf2;
function setupLocale() {
  const loc = LANG === 'hu' ? 'hu-HU' : 'en-US';
  collator = new Intl.Collator(LANG, { numeric: true, sensitivity: 'base' });
  nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  nf1 = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
  nf2 = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
}
setupLocale();
function setLang(l, persist) {
  if (!I18N[l]) return;
  LANG = l;
  if (persist) store.set('lang', l);
  setupLocale();
  applyI18n();
}

let INFO = { sep: '/', home: '/', user: '', host: '', win: false };
let UPDATE = null;
let DRIVES = [];
const panels = {};
let active = null;
let showHidden = false;
let clip = null;
let dragData = null;
const modalStack = [];

const store = {
  get(k, d) { try { const v = localStorage.getItem('gc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gc.' + k, JSON.stringify(v)); } catch (e) { /* privát mód */ } },
};

/* ------------------------------------------------------------ formázás */
function fmtSize(n) {
  if (n == null || n < 0) return '';
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return (n < 10 ? nf2 : n < 100 ? nf1 : nf0).format(n) + ' ' + u[i];
}
const fmtBytes = n => t('bytes', nf0.format(n));
const pad = n => String(n).padStart(2, '0');
function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t * 1000);
  const s = LANG === 'hu' ? '.' : '-';
  return `${d.getFullYear()}${s}${pad(d.getMonth() + 1)}${s}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDur(s) {
  if (s == null || !isFinite(s)) return '–';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}
function fmtClock(ms) { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

/* ------------------------------------------------------------ útvonalak */
function pjoin(dir, name) {
  return /[\\/]$/.test(dir) ? dir + name : dir + INFO.sep + name;
}
function baseName(p) {
  const m = p.replace(/[\\/]+$/, '');
  return m.slice(Math.max(m.lastIndexOf('/'), m.lastIndexOf('\\')) + 1);
}
const isAbs = p => p.startsWith('/') || p.startsWith('~') || /^[a-zA-Z]:[\\/]/.test(p);
const rootOf = p => (INFO.win ? p.slice(0, 3) : '/');
function under(path, root) {
  if (path === root) return true;
  return path.startsWith(/[\\/]$/.test(root) ? root : root + INFO.sep);
}
function driveOf(path, withHome) {
  let best = null;
  for (const d of DRIVES) {
    if (!withHome && d.kind === 'home') continue;
    if (under(path, d.path) && (!best || d.path.length > best.path.length)) best = d;
  }
  return best;
}
const rawUrl = (path, dl) => '/api/raw?' + new URLSearchParams(dl ? { path, dl: '1' } : { path });

/* ------------------------------------------------------------ szerver hívások */
let loginPromise = null;
async function req(method, url, params, body) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const opt = { method, headers: { 'X-GC-Lang': LANG } };
  if (method !== 'GET') {
    opt.headers['X-GC'] = '1';
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body || {});
  }
  let r;
  try { r = await fetch(url + q, opt); } catch (e) { throw new Error(t('server_unreachable')); }
  let j = null;
  try { j = await r.json(); } catch (e) { /* nem JSON */ }
  if (r.status === 401) { if (j && j.lang && store.get('lang', null) == null && j.lang !== LANG) setLang(j.lang); await login(); return req(method, url, params, body); }
  if (!r.ok) throw new Error((j && j.error) || `${r.status} ${r.statusText}`);
  return j;
}
const GET = (u, p) => req('GET', u, p);
const POST = (u, b) => req('POST', u, null, b);

function login() {
  if (!loginPromise) {
    loginPromise = (async () => {
      let msg = '';
      for (;;) {
        const r = await modal({
          title: t('login_title'), cancel: null, ok: t('login_btn'),
          body: `${msg ? `<p class="err">${esc(msg)}</p>` : ''}<label>${t('password')}<input type="password" name="password" autocomplete="current-password"></label>`,
        });
        try { await POST('/api/login', { password: r.password }); break; } catch (e) { msg = e.message; }
      }
      loginPromise = null;
    })();
  }
  return loginPromise;
}

function run(fn) {
  return Promise.resolve().then(fn).catch(e => toast(e.message || String(e), 'err'));
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  const t = type === 'err' ? 6500 : 3200;
  setTimeout(() => el.classList.add('out'), t);
  setTimeout(() => el.remove(), t + 450);
}

/* ------------------------------------------------------------ ikonok */
const EXT = {};
const addExt = (t, list) => list.split(' ').forEach(x => { EXT[x] = t; });
addExt('img', 'jpg jpeg png gif bmp webp svg ico tif tiff heic avif raw cr2 nef psd');
addExt('zip', 'zip rar 7z tar gz tgz bz2 xz zst lz4 deb rpm iso img dmg cab');
addExt('media', 'mp3 wav flac ogg opus m4a aac wma mp4 mkv avi mov webm wmv m4v mpg mpeg ts');
addExt('text', 'txt md log conf cfg ini yml yaml json xml csv tsv sh bash zsh py js mjs ts tsx jsx html htm css scss c h cpp hpp cs go rs java kt php rb pl lua sql env toml service timer properties gradle dockerfile nfo srt');
addExt('doc', 'pdf doc docx odt xls xlsx ods ppt pptx odp rtf epub');

const SVG = {
  root: '<svg viewBox="0 0 16 16"><rect x="1.5" y="4.5" width="13" height="7.5" rx="1.5" fill="#cfd8e3" stroke="#46576b"/><circle cx="12" cy="8.2" r="1" fill="#2a2"/><path d="M3.5 8.2h5" stroke="#6b7c90"/></svg>',
  hdd: '<svg viewBox="0 0 16 16"><rect x="1.5" y="4.5" width="13" height="7.5" rx="1.5" fill="#dcdcdc" stroke="#555"/><circle cx="12" cy="8.2" r="1" fill="#2a2"/><path d="M3.5 8.2h5" stroke="#888"/></svg>',
  usb: '<svg viewBox="0 0 16 16"><rect x="5" y="1.5" width="6" height="4" fill="#ddd" stroke="#555"/><path d="M6.5 3h1M8.5 3h1" stroke="#555"/><rect x="3.5" y="5.5" width="9" height="9" rx="1.2" fill="#3a7bd5" stroke="#1d4f99"/></svg>',
  net: '<svg viewBox="0 0 16 16"><rect x="2.5" y="1.5" width="11" height="7.5" rx="1" fill="#dcdcdc" stroke="#555"/><path d="M8 9v3M1.5 13.5h13" stroke="#555"/><circle cx="8" cy="13.5" r="1.6" fill="#3a7bd5" stroke="#1d4f99"/></svg>',
  home: '<svg viewBox="0 0 16 16"><path d="M1.8 8.2 8 2.5l6.2 5.7" fill="none" stroke="#7a5a00" stroke-width="1.3"/><path d="M3.5 7.3v6.7h3.3v-4h2.4v4h3.3V7.3" fill="#ffd257" stroke="#9a7300"/></svg>',
};

function prep(e) {
  if (e.d) { e.base = e.n; e.ext = ''; }
  else {
    const i = e.n.lastIndexOf('.');
    if (i > 0) { e.base = e.n.slice(0, i); e.ext = e.n.slice(i + 1); } else { e.base = e.n; e.ext = ''; }
  }
  e.ic = e.d ? 'dir' : (EXT[e.ext.toLowerCase()] || (e.p && e.p[3] === 'x' ? 'exe' : 'file'));
  e.lc = e.n.toLowerCase();
  return e;
}
const UP = { n: '..', d: true, up: true, s: 0, m: 0, b: 0, p: '', o: '', g: '', base: '..', ext: '', ic: 'up', lc: '..' };
const COLS = ['n', 'e', 's', 'm', 'b', 'p', 'o'];

/* ------------------------------------------------------------ panel */
class Panel {
  constructor(side, el) {
    Object.assign(this, {
      side, el, path: '', parent: null, entries: [], view: [], cursor: 0, anchor: 0, gen: 0,
      free: 0, total: 0, hist: [], hpos: -1, qs: '', qsT: 0,
      sel: new Set(), sizes: new Map(), pending: new Set(),
      pendingSingle: null, rdrag: false, rsel: true, dropEl: null,
    });
    this.sort = store.get('sort.' + side, { key: 'n', dir: 1 });
    this.build();
  }

  get other() { return this === panels.L ? panels.R : panels.L; }

  build() {
    this.el.innerHTML = `
      <div class="drivebar"></div>
      <div class="diskinfo">
        <button class="dk-btn" title="${t('t_drive')}"></button>
        <div class="meter" title="${t('t_usage')}"><i></i></div>
        <span class="dk-free"></span>
        <span class="grow"></span>
        <button class="mini" data-nav="root" title="${esc(t('t_root'))}">/</button>
        <button class="mini" data-nav="home" title="${t('t_home')}">~</button>
        <button class="mini" data-nav="up" title="${t('t_up')}">..</button>
      </div>
      <div class="pathbar" title="${t('t_path')}"><span class="path-text"></span><input class="path-input" spellcheck="false" hidden></div>
      <div class="cols">${COLS.map(k => `<span class="c-${k}" data-k="${k}">${t('col_' + k)}</span>`).join('')}</div>
      <div class="list"><div class="spacer-v"></div><div class="rows"></div></div>
      <div class="status"></div>`;
    const q = s => this.el.querySelector(s);
    this.driveEl = q('.drivebar');
    this.dkBtn = q('.dk-btn');
    this.meter = q('.meter > i');
    this.dkFree = q('.dk-free');
    this.pathText = q('.path-text');
    this.pathInput = q('.path-input');
    this.colsEl = q('.cols');
    this.list = q('.list');
    this.spacer = q('.spacer-v');
    this.rowsEl = q('.rows');
    this.statusEl = q('.status');
    this.updateCols();

    this.el.addEventListener('mousedown', e => {
      setActive(this);
      if (document.activeElement && document.activeElement !== this.pathInput && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) document.activeElement.blur();
      if (e.target === this.list || e.target === this.spacer) this.pendingSingle = null;
    }, true);
    this.list.addEventListener('scroll', () => this.render(), { passive: true });
    new ResizeObserver(() => this.render()).observe(this.list);
    this.colsEl.addEventListener('click', e => {
      const s = e.target.closest('[data-k]');
      if (s) this.setSort(s.dataset.k);
    });
    q('.diskinfo').addEventListener('click', e => {
      const b = e.target.closest('[data-nav]');
      if (b) run(() => this.nav(b.dataset.nav));
    });
    this.dkBtn.addEventListener('click', () => run(() => driveMenu(this)));
    this.driveEl.addEventListener('click', e => {
      const b = e.target.closest('[data-path]');
      if (b) run(() => this.load(b.dataset.path));
    });
    q('.pathbar').addEventListener('click', () => this.editPath());
    this.pathInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = this.pathInput.value.trim();
        this.endEditPath();
        if (v) run(() => this.load(v));
      } else if (e.key === 'Escape') this.endEditPath();
    });
    this.pathInput.addEventListener('blur', () => this.endEditPath());

    /* --- egér */
    this.rowsEl.addEventListener('mousedown', e => {
      const row = e.target.closest('.row');
      if (!row) return;
      const i = +row.dataset.i, ent = this.view[i];
      if (!ent) return;
      if (e.button === 2) {                      // jobb gomb: kijelölés (TC-stílus, húzva is)
        e.preventDefault();
        this.cursor = i;
        if (!ent.up) { this.rsel = !this.sel.has(ent.n); this.setSel(ent, this.rsel); }
        this.rdrag = true;
        this.render(); this.updateStatus();
        return;
      }
      if (e.button !== 0) return;
      this.pendingSingle = null;
      if (e.ctrlKey || e.metaKey) {
        if (!ent.up) this.setSel(ent, !this.sel.has(ent.n));
        this.anchor = i;
      } else if (e.shiftKey) {
        this.selectRange(this.anchor, i);
      } else {
        if (!this.sel.has(ent.n)) { this.sel.clear(); if (!ent.up) this.sel.add(ent.n); }
        else this.pendingSingle = i;               // kijelöltre kattintás: húzás jöhet
        this.anchor = i;
      }
      this.cursor = i;
      this.render(); this.updateStatus();
    });
    this.rowsEl.addEventListener('mouseover', e => {
      if (!this.rdrag) return;
      if (!(e.buttons & 2)) { this.rdrag = false; return; }
      const row = e.target.closest('.row');
      if (!row) return;
      const i = +row.dataset.i, ent = this.view[i];
      if (!ent) return;
      if (!ent.up) this.setSel(ent, this.rsel);
      this.cursor = i;
      this.render(); this.updateStatus();
    });
    this.rowsEl.addEventListener('click', e => {
      const row = e.target.closest('.row');
      if (!row || this.pendingSingle == null) return;
      const ent = this.view[+row.dataset.i];
      if (+row.dataset.i === this.pendingSingle && ent && !ent.up && !e.ctrlKey && !e.shiftKey) {
        this.sel.clear(); this.sel.add(ent.n);
        this.render(); this.updateStatus();
      }
      this.pendingSingle = null;
    });
    this.rowsEl.addEventListener('dblclick', e => {
      const row = e.target.closest('.row');
      if (row) run(() => this.open(+row.dataset.i));
    });
    this.list.addEventListener('contextmenu', e => e.preventDefault());

    /* --- húzás innen */
    this.rowsEl.addEventListener('dragstart', e => {
      const row = e.target.closest('.row');
      const ent = row && this.view[+row.dataset.i];
      if (!ent || ent.up) { e.preventDefault(); return; }
      this.pendingSingle = null;
      if (!this.sel.has(ent.n)) { this.sel.clear(); this.sel.add(ent.n); this.render(); this.updateStatus(); }
      const items = this.targets();
      dragData = { panel: this, items };
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', items.map(x => pjoin(this.path, x.n)).join('\n'));
      if (items.length === 1 && !ent.d) {   // Chrome: kihúzható az asztalra (letöltés)
        e.dataTransfer.setData('DownloadURL', `application/octet-stream:${ent.n}:${location.origin}${rawUrl(pjoin(this.path, ent.n), true)}`);
      }
      const g = $('#dragghost');
      g.textContent = items.length === 1 ? items[0].n : t('n_items', items.length);
      e.dataTransfer.setDragImage(g, -12, -4);
    });
    this.rowsEl.addEventListener('dragend', () => { dragData = null; clearDrop(); });

    /* --- ejtés ide (másik panelről vagy a számítógépről) */
    this.list.addEventListener('dragover', e => {
      const internal = !!dragData;
      const files = !internal && e.dataTransfer.types.includes('Files');
      if (!internal && !files) return;
      const target = this.dropTarget(e);
      if (internal && dragData.panel === this && !target) { this.setDrop(null); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = files ? 'copy' : (e.shiftKey ? 'move' : 'copy');
      this.setDrop(target || this.list);
    });
    this.list.addEventListener('dragleave', e => {
      if (!this.list.contains(e.relatedTarget)) this.setDrop(null);
    });
    this.list.addEventListener('drop', e => {
      const target = this.dropTarget(e);
      this.setDrop(null);
      let dest = this.path;
      if (target) {
        const ent = this.view[+target.dataset.i];
        dest = ent.up ? this.parent : pjoin(this.path, ent.n);
      }
      if (dragData) {
        e.preventDefault();
        const dd = dragData;
        dragData = null;
        if (dd.panel === this && dest === this.path) return;
        run(() => copyDialog(e.shiftKey, dd.panel, dest, dd.items));
      } else if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        const p = collectDrop(e.dataTransfer);    // szinkron kell elkezdeni!
        run(async () => { const { files, dirs } = await p; await uploadItems(dest, files, dirs); });
      }
    });
  }

  dropTarget(e) {
    const row = e.target.closest && e.target.closest('.row');
    if (!row) return null;
    const ent = this.view[+row.dataset.i];
    if (!ent || !ent.d) return null;
    if (ent.up && !this.parent) return null;
    if (dragData && dragData.panel === this && (ent.up ? false : dragData.items.includes(ent))) return null;
    return row;
  }

  setDrop(el) {
    if (this.dropEl === el) return;
    if (this.dropEl) this.dropEl.classList.remove('drop');
    this.dropEl = el;
    if (el) el.classList.add('drop');
  }

  /* --- betöltés */
  async load(path, focus, push = true) {
    let d;
    try { d = await GET('/api/list', { path }); } catch (e) { toast(e.message, 'err'); return false; }
    const same = d.path === this.path;
    const cur = this.view[this.cursor];
    const keep = focus != null ? focus : (same && cur ? cur.n : null);
    const scroll = same ? this.list.scrollTop : 0;
    this.path = d.path;
    this.parent = d.parent;
    this.free = d.free;
    this.total = d.total;
    this.entries = d.entries.map(prep);
    if (!same) {
      this.cursor = 0;
      this.sel.clear(); this.sizes.clear(); this.pending.clear(); this.quickReset(true);
      if (push) { this.hist = this.hist.slice(0, this.hpos + 1); this.hist.push(d.path); if (this.hist.length > 100) this.hist.shift(); this.hpos = this.hist.length - 1; }
    }
    this.rebuild(keep);
    this.list.scrollTop = scroll;
    this.ensureVisible();
    this.render();
    this.updateHeader();
    store.set('path.' + this.side, this.path);
    return true;
  }

  refresh() { return this.path ? this.load(this.path, null, false) : Promise.resolve(false); }

  rebuild(focusName) {
    const { key, dir } = this.sort;
    const arr = this.entries.filter(e => showHidden || e.n[0] !== '.');
    const val = {
      e: e => e.ext.toLowerCase(),
      s: e => (e.d ? (this.sizes.has(e.n) ? this.sizes.get(e.n) : -1) : e.s),
      m: e => e.m || 0, b: e => e.b || 0, p: e => e.p, o: e => e.o,
    };
    arr.sort((a, b) => {
      if (a.d !== b.d) return a.d ? -1 : 1;
      let r = 0;
      if (key !== 'n') {
        const va = val[key](a), vb = val[key](b);
        r = typeof va === 'string' ? collator.compare(va, vb) : va - vb;
      }
      if (!r) r = collator.compare(a.n, b.n);
      return r * dir;
    });
    if (this.parent != null) arr.unshift(UP);
    this.view = arr;
    this.gen++;
    const names = new Set(arr.map(e => e.n));
    for (const n of this.sel) if (!names.has(n)) this.sel.delete(n);
    const c = focusName != null ? arr.findIndex(e => e.n === focusName) : -1;
    this.cursor = c >= 0 ? c : Math.max(0, Math.min(this.cursor, arr.length - 1));
    this.updateStatus();
  }

  setSort(k) {
    if (this.sort.key === k) this.sort.dir *= -1;
    else this.sort = { key: k, dir: (k === 's' || k === 'm' || k === 'b') ? -1 : 1 };
    store.set('sort.' + this.side, this.sort);
    const cur = this.view[this.cursor];
    this.rebuild(cur && cur.n);
    this.updateCols();
    this.ensureVisible();
    this.render();
  }

  updateCols() {
    for (const s of this.colsEl.children) {
      s.classList.toggle('asc', s.dataset.k === this.sort.key && this.sort.dir > 0);
      s.classList.toggle('desc', s.dataset.k === this.sort.key && this.sort.dir < 0);
    }
  }

  /* --- kirajzolás (csak a látható sorok: gyors nagy mappáknál is) */
  render() {
    const n = this.view.length, list = this.list;
    const h = list.clientHeight || 400;
    this.spacer.style.height = n * ROW_H + 'px';
    const sb = Math.max(0, list.offsetWidth - list.clientWidth - 2) + 'px';   // görgetősáv: a fejléc igazítása
    if (this.colsEl.style.paddingRight !== sb) this.colsEl.style.paddingRight = sb;
    const first = Math.max(0, Math.floor(list.scrollTop / ROW_H) - 4);
    const count = Math.max(0, Math.min(n - first, Math.ceil(h / ROW_H) + 8));
    this.rowsEl.style.transform = `translateY(${first * ROW_H}px)`;
    const kids = this.rowsEl.children;
    while (kids.length < count) this.rowsEl.appendChild(document.createElement('div'));
    while (kids.length > count) this.rowsEl.lastChild.remove();
    for (let k = 0; k < count; k++) {
      const i = first + k, e = this.view[i], el = kids[k];
      const key = i + '|' + this.gen;
      if (el._key !== key) {
        el._key = key;
        el.dataset.i = i;
        el.draggable = !e.up;
        el.innerHTML = this.rowInner(e);
        el.title = e.up ? t('parent_dir') : e.n + (e.t ? '  →  ' + e.t : '') + (e.d ? '' : '\n' + fmtBytes(e.s));
      }
      let cls = 'row';
      if (e.d) cls += ' dir';
      if (e.l) cls += ' lnk';
      if (!e.up && e.n[0] === '.') cls += ' hid';
      if (this.sel.has(e.n)) cls += ' sel';
      if (i === this.cursor) cls += ' cur';
      if (el === this.dropEl) cls += ' drop';
      if (el.className !== cls) el.className = cls;
    }
  }

  rowInner(e) {
    let size;
    if (e.up) size = '';
    else if (e.d) size = this.pending.has(e.n) ? '…' : this.sizes.has(e.n) ? fmtSize(this.sizes.get(e.n)) : '&lt;DIR&gt;';
    else size = fmtSize(e.s);
    return `<span class="c-n"><i class="ic ic-${e.ic}${e.l ? ' lnk' : ''}"></i><span class="nm">${esc(e.up ? '..' : e.d ? e.n : e.base)}</span></span>`
      + `<span class="c-e">${esc(e.ext)}</span><span class="c-s">${size}</span>`
      + `<span class="c-m">${e.up ? '' : fmtDate(e.m)}</span><span class="c-b">${e.up ? '' : fmtDate(e.b)}</span>`
      + `<span class="c-p">${esc(e.p)}</span><span class="c-o">${e.up ? '' : esc(e.o + (e.g ? ':' + e.g : ''))}</span>`;
  }

  updateHeader() {
    this.pathText.innerHTML = `<bdi>${esc(this.path)}</bdi>`;
    const used = this.total ? 1 - this.free / this.total : 0;
    this.meter.style.width = (used * 100).toFixed(1) + '%';
    this.meter.classList.toggle('full', used > 0.9);
    this.dkFree.textContent = this.total ? t('disk_free', fmtSize(this.free), fmtSize(this.total), Math.round(used * 100)) : '';
    const d = driveOf(this.path, false);
    this.dkBtn.innerHTML = `${SVG[d ? d.kind : 'hdd'] || SVG.hdd}<span>${esc(d ? d.path : '?')}</span> ▾`;
    this.updateDrives();
  }

  updateDrives() {
    const cur = driveOf(this.path, true);
    this.driveEl.innerHTML = DRIVES.map(d => `<button class="drv${d === cur ? ' on' : ''}" data-path="${esc(d.path)}" title="${esc(d.path)}${d.dev ? ' – ' + esc(d.dev) : ''}${d.fs ? ' (' + esc(d.fs) + ')' : ''}&#10;${esc(t('free_of', fmtSize(d.free), fmtSize(d.total)))}">${SVG[d.kind] || SVG.hdd}<span>${esc(d.label)}</span></button>`).join('');
  }

  updateStatus() {
    if (this.qs) {
      this.statusEl.innerHTML = `${t('quick_search')}: <span class="qs">${esc(this.qs)}</span>  (${t('quick_esc')})`;
      return;
    }
    let fs = 0, ft = 0, ds = 0, dt = 0, bs = 0, bt = 0;
    for (const e of this.view) {
      if (e.up) continue;
      const sz = e.d ? (this.sizes.get(e.n) || 0) : e.s;
      const s = this.sel.has(e.n);
      if (e.d) { dt++; if (s) ds++; } else { ft++; if (s) fs++; }
      bt += sz;
      if (s) bs += sz;
    }
    this.statusEl.textContent = t('status', fmtSize(bs), fmtSize(bt), fs, ft, ds, dt);
  }

  /* --- kurzor és kijelölés */
  pageSize() { return Math.max(1, Math.floor(this.list.clientHeight / ROW_H) - 1); }

  ensureVisible() {
    const top = this.cursor * ROW_H, l = this.list;
    if (top < l.scrollTop) l.scrollTop = top;
    else if (top + ROW_H > l.scrollTop + l.clientHeight) l.scrollTop = top + ROW_H - l.clientHeight;
  }

  moveTo(c, shift) {
    const n = this.view.length;
    if (!n) return;
    c = Math.max(0, Math.min(n - 1, c));
    if (shift) {   // Shift+mozgás: az átlépett elemek kijelölése (a lista szélén az utolsót is)
      const a = this.cursor, step = c >= a ? 1 : -1;
      const add = i => { const e = this.view[i]; if (e && !e.up) this.sel.add(e.n); };
      for (let i = a; i !== c; i += step) add(i);
      if (c === 0 || c === n - 1) add(c);
    }
    this.cursor = c;
    this.anchor = c;
    this.ensureVisible();
    this.render();
    this.updateStatus();
  }

  move(d, shift) { this.moveTo(this.cursor + d, shift); }

  setSel(e, on) { if (on) this.sel.add(e.n); else this.sel.delete(e.n); }

  toggleCur(calc) {
    const e = this.view[this.cursor];
    if (e && !e.up) {
      const on = !this.sel.has(e.n);
      this.setSel(e, on);
      if (calc && on && e.d && !this.sizes.has(e.n)) this.calcSize(e);
    }
    this.move(1);
  }

  selectRange(a, b) {
    const [x, y] = a < b ? [a, b] : [b, a];
    for (let i = x; i <= y; i++) { const e = this.view[i]; if (e && !e.up) this.sel.add(e.n); }
  }

  selectAll() { for (const e of this.view) if (!e.up) this.sel.add(e.n); this.render(); this.updateStatus(); }
  selectNone() { this.sel.clear(); this.render(); this.updateStatus(); }
  invert() {
    for (const e of this.view) if (!e.up && !e.d) this.setSel(e, !this.sel.has(e.n));
    this.render(); this.updateStatus();
  }

  targets() {
    const s = this.view.filter(e => !e.up && this.sel.has(e.n));
    if (s.length) return s;
    const e = this.view[this.cursor];
    return e && !e.up ? [e] : [];
  }

  /* --- navigáció */
  open(i) {
    const e = this.view[i];
    if (!e) return;
    if (e.up) return this.goUp();
    if (e.d) return this.load(pjoin(this.path, e.n));
    window.open(rawUrl(pjoin(this.path, e.n)), '_blank');
  }
  openCur() { return this.open(this.cursor); }
  goUp() { if (this.parent != null) return this.load(this.parent, baseName(this.path)); }
  nav(n) {
    if (n === 'root') return this.load(rootOf(this.path));
    if (n === 'home') return this.load(INFO.home);
    return this.goUp();
  }
  histGo(d) {
    const i = this.hpos + d;
    if (i < 0 || i >= this.hist.length) return;
    this.hpos = i;
    return this.load(this.hist[i], null, false);
  }
  editPath() {
    if (!this.pathInput.hidden) return;
    this.pathText.hidden = true;
    this.pathInput.hidden = false;
    this.pathInput.value = this.path;
    this.pathInput.focus();
    this.pathInput.select();
  }
  endEditPath() {
    if (this.pathInput.hidden) return;
    this.pathInput.hidden = true;
    this.pathText.hidden = false;
    if (document.activeElement === this.pathInput) this.pathInput.blur();
  }

  /* --- gyorskeresés: gépelés a listában */
  quick(ch) {
    clearTimeout(this.qsT);
    this.qs += ch.toLowerCase();
    let i = this.view.findIndex(e => !e.up && e.lc.startsWith(this.qs));
    if (i < 0) i = this.view.findIndex(e => !e.up && e.lc.includes(this.qs));
    if (i >= 0) { this.cursor = i; this.ensureVisible(); this.render(); }
    this.qsT = setTimeout(() => this.quickReset(), 1500);
    this.updateStatus();
  }
  quickReset(silent) {
    clearTimeout(this.qsT);
    if (!this.qs) return;
    this.qs = '';
    if (!silent) this.updateStatus();
  }

  /* --- mappaméret */
  async calcSize(e) {
    if (this.pending.has(e.n)) return;
    const path = this.path;
    this.pending.add(e.n);
    this.gen++; this.render();
    try {
      const r = await GET('/api/dirsize', { path: pjoin(path, e.n) });
      if (this.path === path) this.sizes.set(e.n, r.size);
    } catch (err) { toast(err.message, 'err'); }
    finally {
      this.pending.delete(e.n);
      this.gen++; this.render(); this.updateStatus();
    }
  }
  async calcAll() {
    const path = this.path;
    for (const e of this.view.filter(x => x.d && !x.up && !this.sizes.has(x.n))) {
      if (this.path !== path) return;
      await this.calcSize(e);
    }
  }
}

function setActive(p) {
  if (!p || active === p) return;
  active = p;
  for (const x of Object.values(panels)) { x.el.classList.toggle('active', x === p); x.render(); }
  store.set('active', p.side);
}

function clearDrop() { for (const p of Object.values(panels)) p.setDrop(null); }

async function loadDrives() {
  try { DRIVES = (await GET('/api/drives')).drives; } catch (e) { return; }
  for (const p of Object.values(panels)) if (p.path) p.updateHeader();
}

function refreshAll() {
  return Promise.all(Object.values(panels).map(p => p.refresh()));
}

/* ------------------------------------------------------------ párbeszédablak */
function modal(o) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<form class="dlg ${o.cls || ''}" autocomplete="off" novalidate><div class="dlg-title"><span>${esc(o.title)}</span>${o.cancel === null ? '' : `<button type="button" class="dlg-x" tabindex="-1" title="${t('close_esc')}">✕</button>`}</div><div class="dlg-body">${o.body || ''}</div><div class="dlg-btns"></div></form>`;
    const form = ov.firstElementChild, btns = form.querySelector('.dlg-btns');
    const list = o.buttons || [{ label: o.ok || t('ok'), value: 'ok', primary: true }].concat(o.cancel === null ? [] : [{ label: o.cancel || t('cancel'), value: null }]);
    const primary = list.find(b => b.primary);
    let done = false;
    const data = () => {
      const r = {};
      for (const el of form.elements) if (el.name) r[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      return r;
    };
    const close = v => {
      if (done) return;
      done = true;
      const r = v == null ? null : Object.assign(data(), { _btn: v });
      ov.remove();
      modalStack.splice(modalStack.indexOf(ov), 1);
      document.removeEventListener('keydown', onKey, true);
      resolve(r);
    };
    for (const b of list) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      if (b.primary) el.classList.add('primary');
      el.addEventListener('click', () => (b.action ? b.action(close, form) : close(b.value)));
      btns.appendChild(el);
    }
    form.addEventListener('submit', ev => { ev.preventDefault(); if (primary) close(primary.value); });
    const x = form.querySelector('.dlg-x');
    if (x) x.addEventListener('click', () => close(null));
    const onKey = ev => {
      if (modalStack[modalStack.length - 1] !== ov) return;
      if (/^F\d+$/.test(ev.key)) ev.preventDefault();
      if (o.onKey && o.onKey(ev, close, form)) return;
      if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation();
        if (o.cancel !== null) close(null);
      } else if (ev.key === 'Enter' && !ev.isComposing && ev.target.tagName !== 'TEXTAREA' && ev.target.tagName !== 'BUTTON' && primary) {
        ev.preventDefault();
        close(primary.value);
      }
    };
    document.addEventListener('keydown', onKey, true);
    modalStack.push(ov);
    document.body.appendChild(ov);
    const f = form.querySelector('[autofocus]') || form.querySelector('input:not([type=checkbox]):not([type=hidden]), select, textarea') || btns.querySelector('.primary') || btns.firstElementChild;
    if (f) { f.focus(); if (f.select && o.select !== false) f.select(); }
    if (o.onOpen) o.onOpen(form, close);
  });
}

/* ------------------------------------------------------------ parancsok */
const POLICIES = ['ask', 'overwrite', 'skip', 'newer', 'rename'];
const policySelect = cur => `<select name="policy">${POLICIES.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(t('pol_' + v))}</option>`).join('')}</select>`;
const icon = e => `<i class="ic ic-${e.ic}"></i>`;

async function copyDialog(move, src = active, dest, items) {
  items = items || src.targets();
  if (!items.length) return;
  dest = dest || src.other.path;
  const what = items.length === 1 ? t('quoted', items[0].n) : t('n_items', items.length);
  const r = await modal({
    title: t(move ? 'move_title' : 'copy_title'),
    ok: t(move ? 'move_btn' : 'copy_btn'),
    body: `<label>${t(move ? 'move_to' : 'copy_to', esc(what))}<input name="dest" value="${esc(dest)}"></label>
           <label>${t('if_exists')}${policySelect(store.get('policy', 'ask'))}</label>
           <p class="hint">${t('copy_hint')}</p>`,
  });
  if (!r) return;
  let d = r.dest.trim();
  if (!d) return;
  if (!isAbs(d)) d = pjoin(src.path, d);
  store.set('policy', r.policy);
  await POST('/api/copy', { sources: items.map(e => pjoin(src.path, e.n)), dest: d, move, policy: r.policy });
  src.selectNone();
  pollSoon();
}

async function cmdDelete() {
  const p = active, items = p.targets();
  if (!items.length) return;
  const names = items.slice(0, 10).map(e => `<li>${icon(e)}${esc(e.n)}</li>`).join('') + (items.length > 10 ? `<li>${t('and_more', items.length - 10)}</li>` : '');
  const r = await modal({
    title: t('del_title'), ok: t('del_btn'), cls: 'danger',
    body: `<p>${items.length === 1 ? t('del_one') : t('del_many', items.length)}</p><ul class="namelist">${names}</ul>`,
  });
  if (!r) return;
  await POST('/api/delete', { paths: items.map(e => pjoin(p.path, e.n)) });
  p.selectNone();
  pollSoon();
}

async function cmdMkdir() {
  const p = active;
  const r = await modal({ title: t('mkdir_title'), ok: t('create_btn'), body: `<label>${t('mkdir_label')}<input name="name"></label>` });
  if (!r || !r.name.trim()) return;
  const name = r.name.trim();
  await POST('/api/mkdir', { path: isAbs(name) ? name : pjoin(p.path, name), parents: true });
  await p.load(p.path, name.split(/[\\/]/)[0], false);
  if (p.other.path === p.path) p.other.refresh();
}

async function cmdNewFile() {
  const p = active;
  const r = await modal({ title: t('newfile_title'), ok: t('newfile_btn'), body: `<label>${t('newfile_label')}<input name="name" value="${t('newfile_default')}"></label>` });
  if (!r || !r.name.trim()) return;
  const name = r.name.trim();
  const path = isAbs(name) ? name : pjoin(p.path, name);
  await POST('/api/mkfile', { path });
  await p.load(p.path, baseName(path), false);
  await cmdEdit(path);
}

async function cmdRename() {
  const p = active, e = p.view[p.cursor];
  if (!e || e.up) return;
  const r = await modal({
    title: t('rename_title'), ok: t('rename_btn'), select: false,
    body: `<label>${t('rename_label')}<input name="name" value="${esc(e.n)}"></label>`,
    onOpen(f) {
      const i = f.elements.name, dot = e.d ? -1 : e.n.lastIndexOf('.');
      i.focus();
      i.setSelectionRange(0, dot > 0 ? dot : e.n.length);
    },
  });
  if (!r) return;
  const name = r.name.trim();
  if (!name || name === e.n) return;
  await POST('/api/rename', { path: pjoin(p.path, e.n), name });
  p.sel.delete(e.n);
  await p.load(p.path, name, false);
  if (p.other.path === p.path) p.other.refresh();
}

function cmdView() {
  const p = active, e = p.view[p.cursor];
  if (!e) return;
  if (e.d) { if (!e.up) p.calcSize(e); return; }
  window.open(rawUrl(pjoin(p.path, e.n)), '_blank');
}

function cmdDownload() {
  const p = active, items = p.targets().filter(e => !e.d);
  if (!items.length) { toast(t('download_nofile'), 'err'); return; }
  items.forEach((e, i) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = rawUrl(pjoin(p.path, e.n), true);
    a.download = e.n;
    document.body.appendChild(a); a.click(); a.remove();
  }, i * 300));
}

async function cmdEdit(path) {
  const p = active;
  if (!path) {
    const e = p.view[p.cursor];
    if (!e || e.d) return;
    path = pjoin(p.path, e.n);
  }
  const tx = await GET('/api/text', { path });
  let dirty = false, ta = null;
  const save = async () => {
    await POST('/api/text', { path, text: ta.value, enc: tx.enc, crlf: tx.crlf });
    dirty = false;
    toast(t('saved', baseName(path)), 'ok');
  };
  const tryClose = close => { if (!dirty || confirm(t('unsaved_confirm'))) close('x'); };
  await modal({
    title: t('edit_title', path), cls: 'editor', select: false,
    body: `<textarea name="text" spellcheck="false"></textarea><div class="ed-info">${esc(tx.enc)} · ${tx.crlf ? 'CRLF' : 'LF'} · ${fmtSize(tx.size)} · ${t('edit_keys')}</div>`,
    buttons: [
      { label: t('save_btn'), action: () => run(save) },
      { label: t('save_close_btn'), primary: true, action: close => run(async () => { await save(); close('x'); }) },
      { label: t('close_esc'), action: tryClose },
    ],
    onOpen(form) {
      ta = form.elements.text;
      ta.value = tx.text;
      ta.focus();
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
      ta.addEventListener('input', () => { dirty = true; });
      ta.addEventListener('keydown', ev => {
        if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); document.execCommand('insertText', false, '\t'); }
      });
    },
    onKey(ev, close) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); run(save); return true; }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); tryClose(close); return true; }
      if (ev.key === 'Enter') return true;   // a szerkesztőben az Enter új sor
      return false;
    },
  });
  p.refresh();
}

function modeOf(perm) {
  let m = 0;
  const s = (perm || '----------').slice(1);
  for (let i = 0; i < 9; i++) if (s[i] && s[i] !== '-' && s[i] !== 'S' && s[i] !== 'T') m |= 1 << (8 - i);
  return m;
}

async function cmdChmod() {
  const p = active, items = p.targets();
  if (!items.length) return;
  const e0 = items[0], mode = modeOf(e0.p);
  const anyDir = items.some(e => e.d);
  const who = [[t('perm_owner'), 6], [t('perm_group'), 3], [t('perm_others'), 0]];
  const rows = who.map(([l, sh]) => `<tr><td>${l}</td>${[4, 2, 1].map(b => `<td><input type="checkbox" data-b="${b << sh}"${mode & (b << sh) ? ' checked' : ''}></td>`).join('')}</tr>`).join('');
  const r = await modal({
    title: t('chmod_title', items.length === 1 ? e0.n : t('n_items', items.length)), ok: t('apply_btn'),
    body: `<table class="perm"><tr><th></th><th>${t('perm_r')}</th><th>${t('perm_w')}</th><th>${t('perm_x')}</th></tr>${rows}</table>
      <div class="row3">
        <label>${t('perm_octal')}<input name="mode" value="${mode.toString(8).padStart(3, '0')}" maxlength="4" inputmode="numeric"></label>
        <label>${t('perm_owner')}<input name="owner" value="${esc(e0.o)}"></label>
        <label>${t('perm_group')}<input name="group" value="${esc(e0.g)}"></label>
      </div>
      ${anyDir ? `<label class="chk"><input type="checkbox" name="recursive"> ${t('chmod_recursive')}</label><p class="hint">${t('chmod_rec_hint')}</p>` : ''}
      <p class="hint">${t('chmod_root_hint')}</p>`,
    onOpen(f) {
      const boxes = [...f.querySelectorAll('[data-b]')], inp = f.elements.mode;
      const fromBoxes = () => { inp.value = boxes.reduce((m, b) => m | (b.checked ? +b.dataset.b : 0), 0).toString(8).padStart(3, '0'); };
      boxes.forEach(b => b.addEventListener('change', fromBoxes));
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value, 8);
        if (!isNaN(v)) boxes.forEach(b => { b.checked = !!(v & +b.dataset.b); });
      });
    },
  });
  if (!r) return;
  if (!/^[0-7]{3,4}$/.test(r.mode)) throw new Error(t('bad_octal', r.mode));
  const res = await POST('/api/chmod', {
    paths: items.map(e => pjoin(p.path, e.n)), mode: r.mode, recursive: !!r.recursive,
    owner: r.owner !== e0.o ? r.owner : '', group: r.group !== e0.g ? r.group : '',
  });
  if (res.error_count) toast(t('n_errors_first', res.error_count, res.errors[0]), 'err');
  else toast(t('chmod_done', res.count), 'ok');
  await p.refresh();
  if (p.other.path === p.path) p.other.refresh();
}

async function selectPattern(on) {
  const p = active, cur = p.view[p.cursor];
  const def = on && cur && !cur.d && cur.ext ? '*.' + cur.ext : '*';
  const r = await modal({
    title: t(on ? 'selpat_title' : 'unselpat_title'), ok: t(on ? 'select_btn' : 'unselect_btn'),
    body: `<label>${t('pattern_label')}<input name="pat" value="${esc(def)}"></label><label class="chk"><input type="checkbox" name="dirs"> ${t('pattern_dirs')}</label>`,
  });
  if (!r || !r.pat.trim()) return;
  const res = r.pat.split(/[;,\s]+/).filter(Boolean).map(g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'));
  for (const e of p.view) {
    if (e.up || (e.d && !r.dirs)) continue;
    if (res.some(x => x.test(e.n))) p.setSel(e, on);
  }
  p.render(); p.updateStatus();
}

function swapPanels() {
  const a = panels.L.path, b = panels.R.path;
  return Promise.all([panels.L.load(b), panels.R.load(a)]);
}

function toggleHidden() {
  showHidden = !showHidden;
  store.set('hidden', showHidden);
  $('[data-cmd=hidden]').classList.toggle('on', showHidden);
  for (const p of Object.values(panels)) {
    const cur = p.view[p.cursor];
    p.rebuild(cur && cur.n);
    p.ensureVisible(); p.render();
  }
}

function clipSet(move) {
  const items = active.targets();
  if (!items.length) return;
  clip = { paths: items.map(e => pjoin(active.path, e.n)), move };
  toast(t(move ? 'clip_cut' : 'clip_copied', items.length));
}

async function clipPaste() {
  if (!clip) return;
  await POST('/api/copy', { sources: clip.paths, dest: active.path, move: clip.move, policy: 'ask' });
  if (clip.move) clip = null;
  pollSoon();
}

async function driveMenu(p) {
  setActive(p);
  const items = DRIVES.map((d, i) => `<button type="button" class="menu-drv" data-i="${i}">${SVG[d.kind] || SVG.hdd}<span>${esc(d.label === '~' ? t('home_drive', d.path) : d.path)}</span><span class="m-free">${esc(t('free_of', fmtSize(d.free), fmtSize(d.total)))}</span></button>`).join('');
  const r = await modal({
    title: t('drive_title_' + p.side), buttons: [{ label: t('cancel'), value: null }],
    body: items,
    onOpen(form, close) {
      const bs = [...form.querySelectorAll('.menu-drv')];
      const cur = driveOf(p.path, true);
      const ci = Math.max(0, DRIVES.indexOf(cur));
      if (bs[ci]) bs[ci].focus();
      bs.forEach(b => b.addEventListener('click', () => close(DRIVES[+b.dataset.i].path)));
    },
    onKey(ev, close, form) {
      const bs = [...form.querySelectorAll('.menu-drv')];
      const i = bs.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const n = (i + (ev.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length;
        if (bs[n]) bs[n].focus();
        return true;
      }
      return false;
    },
  });
  if (r) await p.load(r._btn);
}

function cmdHelp() {
  const K = (k, d) => `<tr><td>${k}</td><td>${d}</td></tr>`;
  modal({
    title: t('help_title'), cls: 'wide', buttons: [{ label: t('close'), value: 'ok', primary: true }],
    body: `<table class="keys">
      ${K('↑ ↓ PgUp PgDn Home End', t('h_move'))}
      ${K(t('h_enter_k'), t('h_enter'))}
      ${K('Backspace, Ctrl+PgUp', t('h_up'))}
      ${K('Tab', t('h_tab'))}
      ${K('Space', t('h_space'))}
      ${K('Insert', t('h_insert'))}
      ${K('Ctrl+A / Esc', t('h_selall'))}
      ${K('Num + / Num − / Num *', t('h_num'))}
      ${K(t('h_mouse_k'), t('h_mouse'))}
      ${K(t('h_type_k'), t('h_type'))}
      ${K('F2 / Shift+F6', t('h_rename'))}
      ${K('F3 / Shift+F3', t('h_view'))}
      ${K('F4 / Shift+F4', t('h_edit'))}
      ${K('F5 / F6', t('h_copy'))}
      ${K('F7 / F8, Delete', t('h_mkdir'))}
      ${K('F9', t('h_chmod'))}
      ${K('Ctrl+C / Ctrl+X / Ctrl+V', t('h_clip'))}
      ${K('Alt+F1 / Alt+F2', t('h_drives'))}
      ${K('F10', t('h_menu'))}
      ${K('Alt+← / Alt+→', t('h_hist'))}
      ${K('Ctrl+R, Ctrl+H, Ctrl+U, Ctrl+=', t('h_misc'))}
      ${K('Ctrl+\\', t('h_root'))}
      ${K('Alt+Shift+Enter', t('h_sizes'))}
      ${K(t('h_drag_k'), t('h_drag'))}
    </table>`,
  });
}

function cmdUpload() {
  const inp = $('#fileinput');
  inp.value = '';
  inp.onchange = () => {
    const files = [...inp.files].map(f => ({ file: f, rel: f.name }));
    run(() => uploadItems(active.path, files, []));
  };
  inp.click();
}

const CMD = {
  view: cmdView, edit: () => cmdEdit(), newfile: cmdNewFile, copy: () => copyDialog(false), move: () => copyDialog(true),
  mkdir: cmdMkdir, del: cmdDelete, chmod: cmdChmod, rename: cmdRename,
  refresh: () => { loadDrives(); return refreshAll(); }, hidden: toggleHidden, swap: swapPanels,
  same: () => active.other.load(active.path), upload: cmdUpload, download: cmdDownload,
  sizes: () => active.calcAll(), help: cmdHelp, selpat: () => selectPattern(true), unselpat: () => selectPattern(false),
  invert: () => active.invert(), selall: () => active.selectAll(), selnone: () => active.selectNone(),
  root: () => active.nav('root'), home: () => active.nav('home'), up: () => active.nav('up'),
  drvL: () => driveMenu(panels.L), drvR: () => driveMenu(panels.R),
  sort_n: () => active.setSort('n'), sort_e: () => active.setSort('e'), sort_s: () => active.setSort('s'), sort_m: () => active.setSort('m'),
  about: cmdAbout, update: () => cmdUpdate(true),
  lang_hu: () => switchLang('hu'), lang_en: () => switchLang('en'),
  logout: async () => { await POST('/api/logout'); location.reload(); },
};

function switchLang(l) {
  if (l === LANG) return;
  store.set('lang', l);
  location.reload();
}

const repoUrl = () => (INFO.repo ? 'https://github.com/' + INFO.repo : '');

function updateLine() {
  const u = UPDATE;
  if (!u) return '';
  if (!u.enabled) return t('about_nocheck');
  if (!u.latest) return t('about_checkfail');
  return u.newer ? t('about_latest', 'v' + u.latest) : t('about_uptodate');
}

function cmdAbout() {
  const repo = repoUrl();
  return modal({
    title: t('about_title'), buttons: [{ label: t('ok'), value: 'ok', primary: true }],
    body: `<div class="about"><img src="favicon.svg" alt=""><div><h3>Gabo Commander v${esc(INFO.version || '')}</h3>
      <div>${t('about_desc')}</div>
      <div class="hint" style="margin-top:6px">${esc(t('about_server', `${INFO.user}@${INFO.host}${INFO.root ? ' (root)' : ''}`))}</div>
      <div class="hint">${esc(updateLine())}</div>
      ${repo ? `<div class="hint"><a href="${esc(repo)}" target="_blank" rel="noopener">${esc(repo.replace('https://', ''))}</a></div>` : ''}</div></div>`,
  });
}

async function checkUpdate(force) {
  try { UPDATE = await GET('/api/update', force ? { force: '1' } : null); } catch (e) { return; }
  const b = $('#upd');
  b.hidden = !UPDATE.newer;
  if (UPDATE.newer) {
    b.textContent = '⬆ ' + t('upd_badge', 'v' + UPDATE.latest);
    b.title = t('upd_badge_t');
  }
}

async function cmdUpdate(force) {
  if (force) await checkUpdate(true);
  if (!UPDATE || !UPDATE.newer) return cmdAbout();
  const repo = repoUrl();
  await modal({
    title: t('upd_title'), buttons: [{ label: t('ok'), value: 'ok', primary: true }],
    body: `<p>${t('upd_body', esc('v' + INFO.version), esc('v' + UPDATE.latest))}</p>
      <p>${t('upd_howto')}</p><pre class="cmd">sudo gabo-commander update</pre>
      ${repo ? `<p class="hint"><a href="${esc(repo)}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${t('upd_changes')}</a></p>` : ''}`,
  });
}

/* ------------------------------------------------------------ menüsor (F10) */
/* [fordítási kulcs, parancs, gyorsbillentyű, pipa-e] – a feliratok megjelenítéskor fordítódnak */
const MENUS = [
  ['m_files', [
    ['mi_rename', 'rename', 'F2'], ['mi_view', 'view', 'F3'], ['mi_edit', 'edit', 'F4'], ['mi_newfile', 'newfile', 'Shift+F4'], '-',
    ['mi_copy', 'copy', 'F5'], ['mi_move', 'move', 'F6'], ['mi_mkdir', 'mkdir', 'F7'], ['mi_del', 'del', 'F8'], '-',
    ['mi_chmod', 'chmod', 'F9'], '-',
    ['mi_upload', 'upload', ''], ['mi_download', 'download', 'Shift+F3'], '-',
    ['mi_logout', 'logout', ''],
  ]],
  ['m_mark', [
    ['mi_selpat', 'selpat', 'Num +'], ['mi_unselpat', 'unselpat', 'Num −'],
    ['mi_selall', 'selall', 'Ctrl+A'], ['mi_selnone', 'selnone', 'Esc'], ['mi_invert', 'invert', 'Num *'], '-',
    ['mi_sizes', 'sizes', 'Alt+Shift+Enter'],
  ]],
  ['m_commands', [
    ['mi_refresh', 'refresh', 'Ctrl+R'], ['mi_swap', 'swap', 'Ctrl+U'], ['mi_same', 'same', 'Ctrl+='], '-',
    ['mi_root', 'root', 'Ctrl+\\'], ['mi_home', 'home', ''], ['mi_up', 'up', 'Backspace'], '-',
    ['mi_drvL', 'drvL', 'Alt+F1'], ['mi_drvR', 'drvR', 'Alt+F2'],
  ]],
  ['m_view', [
    ['mi_hidden', 'hidden', 'Ctrl+H', () => showHidden], '-',
    ['mi_sort_n', 'sort_n', '', () => active && active.sort.key === 'n'],
    ['mi_sort_e', 'sort_e', '', () => active && active.sort.key === 'e'],
    ['mi_sort_s', 'sort_s', '', () => active && active.sort.key === 's'],
    ['mi_sort_m', 'sort_m', '', () => active && active.sort.key === 'm'], '-',
    [LANGS.hu, 'lang_hu', '', () => LANG === 'hu'],
    [LANGS.en, 'lang_en', '', () => LANG === 'en'],
  ]],
  ['m_help', [['mi_keys', 'help', 'F1'], '-', ['mi_update', 'update', ''], ['mi_about', 'about', '']]],
];
const menu = { open: -1, sel: -1, drop: null };

function menuItems(i) { return MENUS[i][1].filter(it => it === '-' || it[1] !== 'logout' || INFO.auth); }

function buildMenubar() {
  const bar = $('#menubar');
  MENUS.forEach(([label], i) => {
    const el = document.createElement('span');
    el.className = 'mb-item';
    el.textContent = t(label);
    el.dataset.m = i;
    el.addEventListener('mousedown', e => { e.preventDefault(); if (menu.open === i) menuClose(); else menuOpen(i, -1); });
    el.addEventListener('mouseenter', () => { if (menu.open >= 0 && menu.open !== i) menuOpen(i, -1); });
    bar.insertBefore(el, bar.querySelector('.grow'));
  });
  document.addEventListener('mousedown', e => { if (menu.open >= 0 && !e.target.closest('#menubar')) menuClose(); });
}

function menuOpen(i, sel) {
  menuClose();
  const bar = $('#menubar'), head = bar.querySelector(`[data-m="${i}"]`);
  head.classList.add('open');
  const drop = document.createElement('div');
  drop.className = 'mb-drop';
  drop.style.left = head.offsetLeft + 'px';
  drop.innerHTML = menuItems(i).map((it, k) => it === '-' ? '<hr>'
    : `<div class="mi${it[3] && it[3]() ? ' chk' : ''}" data-k="${k}"><span>${esc(t(it[0]))}</span><span class="k">${esc(it[2])}</span></div>`).join('');
  drop.addEventListener('mousedown', e => {
    e.preventDefault();
    const mi = e.target.closest('.mi');
    if (mi) menuRun(i, +mi.dataset.k);
  });
  drop.addEventListener('mousemove', e => {
    const mi = e.target.closest('.mi');
    if (mi) menuHighlight(+mi.dataset.k);
  });
  bar.appendChild(drop);
  Object.assign(menu, { open: i, sel: -1, drop });
  if (sel >= 0) menuHighlight(sel);
}

function menuClose() {
  if (menu.drop) menu.drop.remove();
  for (const h of document.querySelectorAll('.mb-item.open')) h.classList.remove('open');
  Object.assign(menu, { open: -1, sel: -1, drop: null });
}

function menuHighlight(k) {
  menu.sel = k;
  for (const el of menu.drop.querySelectorAll('.mi')) el.classList.toggle('on', +el.dataset.k === k);
}

function menuRun(i, k) {
  const it = menuItems(i)[k];
  menuClose();
  if (it && it !== '-' && CMD[it[1]]) run(CMD[it[1]]);
}

function menuKey(e) {   // true, ha a menü kezelte a billentyűt
  if (menu.open < 0) return false;
  const items = menuItems(menu.open);
  const step = d => {
    let k = menu.sel;
    for (let n = 0; n < items.length; n++) { k = (k + d + items.length) % items.length; if (items[k] !== '-') break; }
    menuHighlight(k);
  };
  switch (e.key) {
    case 'Escape': case 'F10': case 'Alt': menuClose(); break;
    case 'ArrowDown': step(1); break;
    case 'ArrowUp': step(-1); break;
    case 'ArrowRight': menuOpen((menu.open + 1) % MENUS.length, 0); break;
    case 'ArrowLeft': menuOpen((menu.open - 1 + MENUS.length) % MENUS.length, 0); break;
    case 'Enter': if (menu.sel >= 0) menuRun(menu.open, menu.sel); break;
    default: break;
  }
  e.preventDefault();
  e.stopPropagation();
  return true;
}

/* ------------------------------------------------------------ feladatok (másolás / törlés / feltöltés) */
let serverJobs = [];
const localJobs = new Map();
const jobEls = new Map();
const finishedSeen = new Set();
const hiddenJobs = new Set();
const askedJobs = new Set();
let pollTimer = 0;
let localSeq = 0;
let firstJobPoll = true;
const MAX_CARDS = 4;

async function pollJobs() {
  clearTimeout(pollTimer);
  try {
    serverJobs = (await GET('/api/jobs')).jobs;
    if (firstJobPoll) {   // az oldal betöltése előtt befejeződött feladatokat nem mutatjuk
      firstJobPoll = false;
      for (const j of serverJobs) if (j.finished) { hiddenJobs.add(j.id); finishedSeen.add(j.id); }
    }
  } catch (e) { /* csendben újrapróbáljuk */ }
  renderJobs();
  const busy = serverJobs.some(j => !j.finished);
  pollTimer = setTimeout(pollJobs, busy ? 500 : 3000);
}
function pollSoon() { clearTimeout(pollTimer); pollTimer = setTimeout(pollJobs, 150); }

function renderJobs() {
  const all = serverJobs.concat([...localJobs.values()]);
  const box = $('#jobs'), ids = new Set();
  let runBytes = 0, runDone = 0;
  for (const j of all) {
    if (hiddenJobs.has(j.id)) continue;
    ids.add(j.id);
    let el = jobEls.get(j.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'job';
      el.innerHTML = '<div class="job-h"><span class="job-t"></span><span class="job-pct"></span><button class="job-x">✕</button></div><div class="bar"><i></i></div><div class="bar sm" hidden><i></i></div><div class="job-info"></div><div class="job-cur"></div><div class="job-err"></div>';
      const id = j.id;
      el.querySelector('.job-x').addEventListener('mousedown', e => e.preventDefault());
      el.querySelector('.job-x').addEventListener('click', () => run(() => jobClose(id)));
      box.appendChild(el);
      jobEls.set(j.id, el);
    }
    updateJobEl(el, j);
    if (!j.finished && j.total_bytes) { runBytes += j.total_bytes; runDone += j.done_bytes; }
    if (j.state === 'ask' && !askedJobs.has(j.id)) { askedJobs.add(j.id); run(() => askConflict(j)); }
    if (j.finished && !finishedSeen.has(j.id)) {
      finishedSeen.add(j.id);
      refreshAll();
      loadDrives();
      if (j.state === 'done') setTimeout(() => jobHide(j.id), 6000);
    }
  }
  for (const [id, el] of jobEls) if (!ids.has(id)) { el.remove(); jobEls.delete(id); }
  // legfeljebb MAX_CARDS kártya látszik: a futók előnyt élveznek, a többiről összesítő sor
  const cards = [...jobEls.values()];
  const order = cards.filter(el => !el.classList.contains('done')).concat(cards.filter(el => el.classList.contains('done')));
  order.forEach((el, i) => { el.hidden = i >= MAX_CARDS; });
  let more = $('#jobs-more');
  const extra = order.length - MAX_CARDS;
  if (extra > 0) {
    if (!more) { more = document.createElement('div'); more.id = 'jobs-more'; more.className = 'job'; }
    more.textContent = t('more_jobs', extra);
    box.appendChild(more);
  } else if (more) more.remove();
  const base = `${INFO.host} – Gabo Commander`;
  document.title = runBytes ? `${Math.floor(runDone / runBytes * 100)}% – ${base}` : base;
}

function updateJobEl(el, j) {
  const pct = j.total_bytes ? j.done_bytes / j.total_bytes : j.total_files ? j.done_files / j.total_files : (j.finished ? 1 : 0);
  el.className = 'job ' + j.state;
  el.querySelector('.job-t').textContent = j.title;
  el.querySelector('.job-t').title = j.title;
  el.querySelector('.job-pct').textContent = j.state === 'scan' ? t('j_scanning') : j.state === 'ask' ? t('j_waiting') : Math.floor(pct * 100) + '%';
  el.querySelector('.bar > i').style.width = (Math.min(1, pct) * 100).toFixed(1) + '%';
  const sm = el.querySelector('.bar.sm');
  const showCur = j.state === 'run' && j.cur_total > 32 * 1024 * 1024 && j.total_files > 1;
  sm.hidden = !showCur;
  if (showCur) sm.firstChild.style.width = (j.cur_done / j.cur_total * 100).toFixed(1) + '%';
  let info = '';
  const files = j.total_files ? t(j.kind === 'delete' ? 'j_items' : 'j_files', j.done_files, j.total_files) : '';
  if (j.state === 'scan') info = t('j_scan', j.total_files, fmtSize(j.total_bytes));
  else if (j.state === 'ask') info = t('j_ask');
  else if (j.state === 'run') {
    if (j.total_bytes) {
      info = `${fmtSize(j.done_bytes)} / ${fmtSize(j.total_bytes)} · ${fmtSize(j.speed)}/s`
        + ` · ${t('j_left', fmtDur(j.eta))}${j.eta != null ? ` · ${t('j_eta', fmtClock(Date.now() + j.eta * 1000))}` : ''}${files}`;
    } else {
      info = `${files.slice(3)} · ${t('j_rate', nf0.format(j.fspeed || 0))} · ${t('j_left', fmtDur(j.eta))}`;
    }
  } else if (j.state === 'done') {
    info = j.total_bytes
      ? t('j_done_bytes', fmtSize(j.total_bytes), j.total_files, fmtDur(j.elapsed), fmtSize(j.elapsed > 0 ? j.total_bytes / j.elapsed : 0))
      : t('j_done', files, fmtDur(j.elapsed));
  } else if (j.state === 'error') info = t('j_error', j.error_count, files);
  else if (j.state === 'cancelled') info = t('j_cancelled');
  el.querySelector('.job-info').textContent = info;
  el.querySelector('.job-cur').innerHTML = j.current ? `<bdi>${esc(j.current)}</bdi>` : '';
  const x = el.querySelector('.job-x');
  x.title = t(j.finished ? 'j_close' : 'j_cancel');
  const errSig = j.error_count + '|' + (j.errors || []).length;
  const errEl = el.querySelector('.job-err');
  if (errEl._sig !== errSig) {
    errEl._sig = errSig;
    errEl.innerHTML = j.error_count
      ? `<details${j.finished ? ' open' : ''}><summary>${t('j_n_errors', j.error_count)}</summary><ul>${(j.errors || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>`
      : '';
  }
}

async function askConflict(j) {
  const sample = (j.ask.sample || []).map(n => `<li>${esc(n)}</li>`).join('');
  const r = await modal({
    title: t('conflict_title'), select: false,
    body: `<p>${t('conflict_body', j.ask.count)}</p><ul class="namelist">${sample}${j.ask.count > j.ask.sample.length ? '<li>…</li>' : ''}</ul><p class="hint">${esc(j.title)}</p>`,
    buttons: [
      { label: t('c_overwrite_all'), value: 'overwrite', primary: true },
      { label: t('c_newer'), value: 'newer' },
      { label: t('c_skip'), value: 'skip' },
      { label: t('c_rename'), value: 'rename' },
      { label: t('cancel'), value: null },
    ],
  });
  if (r) await POST('/api/jobs/answer', { id: j.id, policy: r._btn });
  else await POST('/api/jobs/cancel', { id: j.id });
  pollSoon();
}

async function jobClose(id) {
  const lj = localJobs.get(id);
  if (lj) {
    if (!lj.finished) { lj.cancel = true; if (lj.xhr) lj.xhr.abort(); return; }
    return jobHide(id);
  }
  const j = serverJobs.find(x => x.id === id);
  if (j && !j.finished) {
    const r = await modal({ title: t('cancel_title'), ok: t('cancel_btn'), cancel: t('continue_btn'), body: `<p>${t('cancel_q')}</p><p class="hint">${esc(j.title)}</p>` });
    if (r) { await POST('/api/jobs/cancel', { id }); pollSoon(); }
    return;
  }
  jobHide(id);
}

function jobHide(id) {
  hiddenJobs.add(id);
  if (localJobs.has(id)) localJobs.delete(id);
  else POST('/api/jobs/dismiss', { id }).catch(() => {});
  renderJobs();
}

/* --- feltöltés a böngészőből */
async function collectDrop(dt) {
  const entries = [];
  for (const it of dt.items || []) {
    if (it.kind !== 'file') continue;
    const en = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
    if (en) entries.push(en);
  }
  const files = [], dirs = [];
  if (!entries.length) {
    for (const f of dt.files || []) files.push({ file: f, rel: f.name });
    return { files, dirs };
  }
  const readAll = reader => new Promise((res, rej) => {
    const out = [];
    const step = () => reader.readEntries(b => { if (!b.length) res(out); else { out.push(...b); step(); } }, rej);
    step();
  });
  const fileOf = en => new Promise((res, rej) => en.file(res, rej));
  const walk = async (en, prefix) => {
    const rel = prefix ? prefix + '/' + en.name : en.name;
    if (en.isFile) {
      try { files.push({ file: await fileOf(en), rel }); } catch (e) { /* olvashatatlan */ }
    } else if (en.isDirectory) {
      dirs.push(rel);
      for (const c of await readAll(en.createReader())) await walk(c, rel);
    }
  };
  for (const en of entries) await walk(en, '');
  return { files, dirs };
}

function putFile(job, url, file, onprog) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    job.xhr = x;
    x.open('PUT', url);
    x.setRequestHeader('X-GC', '1');
    x.setRequestHeader('X-GC-Lang', LANG);
    x.upload.onprogress = e => onprog(e.loaded);
    x.onload = () => {
      if (x.status === 401) { rej(new Error(t('login_required'))); return; }
      if (x.status >= 200 && x.status < 300) { res(); return; }
      let m = x.status + ' ' + x.statusText;
      try { m = JSON.parse(x.responseText).error || m; } catch (e) { /* */ }
      rej(new Error(m));
    };
    x.onerror = () => rej(new Error(t('network_error')));
    x.onabort = () => rej(new Error(t('aborted')));
    x.send(file);
  });
}

function localRates(j) {
  const now = performance.now();
  j.samples.push([now, j.done_bytes]);
  while (j.samples.length > 2 && now - j.samples[0][0] > 5000) j.samples.shift();
  const [t0, b0] = j.samples[0], dt = (now - t0) / 1000;
  j.elapsed = (now - j.t0) / 1000;
  j.speed = dt > 0.8 ? (j.done_bytes - b0) / dt : (j.elapsed > 0 ? j.done_bytes / j.elapsed : 0);
  j.eta = j.speed > 0 ? (j.total_bytes - j.done_bytes) / j.speed : null;
}

async function uploadItems(destDir, files, dirs) {
  if (!files.length && !dirs.length) return;
  let names = new Set();
  try { names = new Set((await GET('/api/list', { path: destDir })).entries.map(e => e.n)); } catch (e) { /* */ }
  const tops = new Set(files.map(f => f.rel.split('/')[0]).concat(dirs.map(d => d.split('/')[0])));
  const conflicts = [...tops].filter(n => names.has(n));
  let policy = 'overwrite';
  if (conflicts.length) {
    const r = await modal({
      title: t('up_conflict_title'), select: false,
      body: `<p>${t('up_conflict_body', conflicts.length, esc(destDir))}</p><ul class="namelist">${conflicts.slice(0, 8).map(n => `<li>${esc(n)}</li>`).join('')}</ul>`,
      buttons: [{ label: t('c_overwrite'), value: 'overwrite', primary: true }, { label: t('c_skip'), value: 'skip' }, { label: t('c_rename'), value: 'rename' }, { label: t('cancel'), value: null }],
    });
    if (!r) return;
    policy = r._btn;
  }
  const what = tops.size === 1 ? [...tops][0] : t('n_items', tops.size);
  const job = {
    id: 'u' + (++localSeq), kind: 'upload', title: t('up_title', what, destDir), state: 'run',
    total_bytes: files.reduce((a, f) => a + f.file.size, 0), done_bytes: 0, total_files: files.length, done_files: 0,
    cur_total: 0, cur_done: 0, current: '', speed: 0, fspeed: 0, eta: null, elapsed: 0,
    errors: [], error_count: 0, finished: false, samples: [], t0: performance.now(), cancel: false, xhr: null,
  };
  const err = m => { job.error_count++; if (job.errors.length < 50) job.errors.push(m); };
  localJobs.set(job.id, job);
  renderJobs();
  const timer = setInterval(() => { localRates(job); renderJobs(); }, 500);
  try {
    for (const d of dirs) {
      if (job.cancel) break;
      try { await POST('/api/mkdir', { path: pjoin(destDir, d), parents: true, exist_ok: true }); } catch (e) { err(d + ': ' + e.message); }
    }
    for (const f of files) {
      if (job.cancel) break;
      job.current = f.rel;
      job.cur_total = f.file.size;
      const base = job.done_bytes;
      const url = '/api/upload?' + new URLSearchParams({ path: pjoin(destDir, f.rel), policy, mtime: f.file.lastModified || '' });
      try {
        await putFile(job, url, f.file, loaded => { job.cur_done = loaded; job.done_bytes = base + Math.min(loaded, f.file.size); });
      } catch (e) { if (!job.cancel) err(f.rel + ': ' + e.message); }
      job.done_bytes = base + f.file.size;
      job.done_files++;
    }
  } finally {
    clearInterval(timer);
    localRates(job);
    job.finished = true;
    job.state = job.cancel ? 'cancelled' : job.error_count ? 'error' : 'done';
    job.current = '';
    renderJobs();
  }
}

/* ------------------------------------------------------------ billentyűzet */
document.addEventListener('keydown', e => {
  if (modalStack.length || e.defaultPrevented) return;
  if (menuKey(e)) return;
  if (e.key === 'F10') { e.preventDefault(); menuOpen(0, 0); return; }
  const t = e.target;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const p = active;
  if (!p) return;
  const k = e.key, ctrl = e.ctrlKey || e.metaKey, alt = e.altKey, sh = e.shiftKey;
  const go = fn => { e.preventDefault(); e.stopPropagation(); run(fn); };
  if (/^F\d+$/.test(k)) e.preventDefault();   // ne frissítsen (F5), ne keressen (F3) a böngésző

  switch (k) {
    case 'ArrowDown': return go(() => p.move(1, sh));
    case 'ArrowUp': return go(() => p.move(-1, sh));
    case 'PageDown': return go(() => (ctrl ? p.openCur() : p.move(p.pageSize(), sh)));
    case 'PageUp': return go(() => (ctrl ? p.goUp() : p.move(-p.pageSize(), sh)));
    case 'Home': return go(() => p.moveTo(0, sh));
    case 'End': return go(() => p.moveTo(p.view.length - 1, sh));
    case 'ArrowLeft': if (alt) return go(() => p.histGo(-1)); break;
    case 'ArrowRight': if (alt) return go(() => p.histGo(1)); break;
    case 'Enter': return go(() => (alt && sh ? p.calcAll() : p.openCur()));
    case 'Backspace': return go(() => p.goUp());
    case 'Tab': return go(() => setActive(p.other));
    case ' ': return go(() => p.toggleCur(true));
    case 'Insert': return go(() => p.toggleCur(false));
    case 'Delete': return go(CMD.del);
    case 'Escape': return go(() => (p.qs ? p.quickReset() : p.selectNone()));
    case 'F1': return go(alt ? () => driveMenu(panels.L) : CMD.help);
    case 'F2': return go(alt ? () => driveMenu(panels.R) : CMD.rename);
    case 'F3': return go(sh ? CMD.download : CMD.view);
    case 'F4': return go(sh ? CMD.newfile : CMD.edit);
    case 'F5': return go(CMD.copy);
    case 'F6': return go(sh ? CMD.rename : CMD.move);
    case 'F7': return go(CMD.mkdir);
    case 'F8': return go(CMD.del);
    case 'F9': return go(CMD.chmod);
    default: break;
  }
  if (ctrl && !alt) {
    switch (k.toLowerCase()) {
      case 'a': return go(() => p.selectAll());
      case 'r': return go(CMD.refresh);
      case 'h': return go(CMD.hidden);
      case 'u': return go(CMD.swap);
      case 'c': return go(() => clipSet(false));
      case 'x': return go(() => clipSet(true));
      case 'v': return go(clipPaste);
      case '=': return go(CMD.same);
      case '\\': return go(() => p.load(rootOf(p.path)));
      default: return;
    }
  }
  if (e.code === 'NumpadAdd') return go(CMD.selpat);
  if (e.code === 'NumpadSubtract') return go(CMD.unselpat);
  if (e.code === 'NumpadMultiply') return go(() => p.invert());
  if (!ctrl && !alt && k.length === 1) return go(() => p.quick(k));
});

/* gombok: ne vegyék el a fókuszt, parancsot futtatnak */
document.addEventListener('mousedown', e => {
  if (e.target.closest('button') && !e.target.closest('.dlg')) e.preventDefault();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]');
  if (b && CMD[b.dataset.cmd]) run(CMD[b.dataset.cmd]);
});
document.addEventListener('mouseup', e => { if (e.button === 2) for (const p of Object.values(panels)) p.rdrag = false; });
document.addEventListener('dragover', e => {
  if (e.defaultPrevented) return;
  clearDrop();
  if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; }   // ne nyissa meg a böngésző
});
document.addEventListener('drop', e => { e.preventDefault(); clearDrop(); dragData = null; });

let lastFocusRefresh = 0;
window.addEventListener('focus', () => {
  if (Date.now() - lastFocusRefresh < 3000 || modalStack.length) return;
  lastFocusRefresh = Date.now();
  refreshAll();
});

/* ------------------------------------------------------------ indulás */
async function init() {
  INFO = await GET('/api/info');
  if (store.get('lang', null) == null && INFO.lang && INFO.lang !== LANG) setLang(INFO.lang);
  applyI18n();
  $('#ver').textContent = 'v' + INFO.version;
  $('#upd').addEventListener('click', () => run(() => cmdUpdate(false)));
  document.title = `${INFO.host} – Gabo Commander`;
  $('#host').textContent = `${INFO.user}@${INFO.host}${INFO.root ? ' (root)' : ''}`;
  $('#logout').hidden = !INFO.auth;
  buildMenubar();
  showHidden = store.get('hidden', false);
  $('[data-cmd=hidden]').classList.toggle('on', showHidden);
  panels.L = new Panel('L', $('#left'));
  panels.R = new Panel('R', $('#right'));
  setActive(panels[store.get('active', 'L')] || panels.L);
  await loadDrives();
  const start = async (p, def) => { if (!(await p.load(store.get('path.' + p.side, def)))) await p.load(def); };
  await Promise.all([start(panels.L, INFO.home), start(panels.R, INFO.win ? INFO.home : '/')]);
  lastFocusRefresh = Date.now();
  pollJobs();
  setInterval(loadDrives, 30000);
  checkUpdate(false);
  setInterval(() => checkUpdate(false), 6 * 3600 * 1000);
}

run(init);
