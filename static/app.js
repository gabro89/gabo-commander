/* Gabo Commander – kliens (keretrendszer nélkül) */
'use strict';

let ROW_H = 20;                     /* a CSS --row-h értéke (mobilon nagyobb) */
const COARSE = matchMedia('(pointer: coarse)').matches;   /* érintőképernyő */
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
let lynx = false;
let leftSel = false;                /* bal klikk kijelöl (Windows-stílus); alapból TC-stílus: csak a kurzor mozog */                   /* Lynx-navigáció: → belép a mappába, ← a szülőbe (Nézet menü) */
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
const resolvePath = (base, v) => (isAbs(v) ? v : pjoin(base, v));     /* relatív útvonal a base mappához képest */

/* minták: *.jpg; *.png – reEsc: szöveg regexbe, globSrc: minta (* ?) regexbe, globList: több minta szétszedése */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const globSrc = g => reEsc(g).replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
const globList = s => s.split(/[;,\s]+/).filter(Boolean);
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
      pendingSingle: null, rdrag: false, rsel: true, rlast: 0, rY: 0, rTimer: 0, dropEl: null,
      filter: '', ptype: '', tapPrev: -1, lpTimer: 0, lpFired: false, lpX: 0, lpY: 0,
      arc: null,                    /* ha a panel egy archívum belsejét mutatja: az archívum útvonala */
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
        <button class="mini" data-nav="fav" title="${t('tb_fav')}">★</button>
        <button class="mini" data-nav="root" title="${esc(t('t_root'))}">/</button>
        <button class="mini" data-nav="home" title="${t('t_home')}">~</button>
        <button class="mini" data-nav="up" title="${t('t_up')}">..</button>
      </div>
      <div class="pathbar" title="${t('t_path')}"><span class="path-text"></span><input class="path-input" spellcheck="false" hidden></div>
      <div class="cols">${COLS.map(k => `<span class="c-${k}" data-k="${k}">${t('col_' + k)}</span>`).join('')}</div>
      <div class="list"><div class="spacer-v"></div><div class="rows"></div></div>
      <div class="filterbar" hidden><span class="f-ic">⏷</span><input class="filter-input" spellcheck="false" autocomplete="off" placeholder="${esc(t('filter_ph'))}"><span class="f-count"></span><button class="mini f-close" title="${esc(t('filter_close'))}">✕</button></div>
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
    this.filterBar = q('.filterbar');
    this.filterInput = q('.filter-input');
    this.filterCount = q('.f-count');
    this.updateCols();

    /* --- szűrő */
    this.filterInput.addEventListener('input', () => this.setFilter(this.filterInput.value));
    this.filterInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.clearFilter(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.filterInput.blur(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); this.filterInput.blur(); this.move(e.key === 'ArrowDown' ? 1 : -1);
      }
    });
    q('.f-close').addEventListener('click', () => this.clearFilter());

    this.el.addEventListener('mousedown', e => {
      setActive(this);
      const ae = document.activeElement;
      if (ae && ae !== this.pathInput && ae !== this.filterInput && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) ae.blur();
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
      if (b) run(() => (b.dataset.nav === 'fav' ? favMenu(this) : this.nav(b.dataset.nav)));
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

    /* --- érintés: koppintás = kurzor, újabb koppintás = megnyitás, hosszan nyomva = kijelölés */
    const lpCancel = () => { clearTimeout(this.lpTimer); this.lpTimer = 0; };
    this.rowsEl.addEventListener('pointerdown', e => {
      this.ptype = e.pointerType;
      this.tapPrev = this.cursor;
      this.lpFired = false;
      lpCancel();
      if (e.pointerType !== 'touch') return;
      const row = e.target.closest('.row');
      if (!row) return;
      this.lpX = e.clientX; this.lpY = e.clientY;
      this.lpTimer = setTimeout(() => {
        this.lpTimer = 0;
        const i = +row.dataset.i, ent = this.view[i];
        if (!ent) return;
        this.lpFired = true;
        this.cursor = i;
        if (!ent.up) this.setSel(ent, !this.sel.has(ent.n));
        if (navigator.vibrate) navigator.vibrate(15);
        this.render(); this.updateStatus();
      }, 500);
    });
    this.rowsEl.addEventListener('pointermove', e => {
      if (this.lpTimer && Math.hypot(e.clientX - this.lpX, e.clientY - this.lpY) > 10) lpCancel();
    });
    this.rowsEl.addEventListener('pointerup', lpCancel);
    this.rowsEl.addEventListener('pointercancel', lpCancel);

    /* --- egér */
    this.rowsEl.addEventListener('mousedown', e => {
      const row = e.target.closest('.row');
      if (!row) return;
      const i = +row.dataset.i, ent = this.view[i];
      if (!ent) return;
      if (this.ptype === 'touch') {               // érintésnél a kijelölést nem bántjuk
        if (e.button === 0 && !this.lpFired) { this.cursor = i; this.render(); this.updateStatus(); }
        return;
      }
      if (e.button === 2) {                      // jobb gomb: kijelölés (TC-stílus, húzva is)
        e.preventDefault();
        this.cursor = i;
        this.rsel = ent.up ? true : !this.sel.has(ent.n);
        if (!ent.up) this.setSel(ent, this.rsel);
        this.rdrag = true;
        this.rlast = i;
        this.rY = e.clientY;
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
      } else if (leftSel) {                        // Windows-stílus: a bal klikk kijelöl
        if (!this.sel.has(ent.n)) { this.sel.clear(); if (!ent.up) this.sel.add(ent.n); }
        else this.pendingSingle = i;               // kijelöltre kattintás: húzás jöhet
        this.anchor = i;
      } else {
        this.anchor = i;                           // TC-stílus: a bal klikk csak a kurzort viszi, a kijelölés marad
      }
      this.cursor = i;
      this.render(); this.updateStatus();
    });
    /* jobb gombos húzás: a sort az egér helyéből számoljuk (gyors mozgásnál sincs kihagyott sor),
       a lista szélén automatikusan görget */
    document.addEventListener('mousemove', e => {
      if (!this.rdrag) return;
      if (!(e.buttons & 2)) { this.rdragEnd(); return; }
      this.rY = e.clientY;
      this.rdragTo();
      if (!this.rTimer) this.rTimer = setInterval(() => this.rdragScroll(), 40);
    });
    this.rowsEl.addEventListener('click', e => {
      const row = e.target.closest('.row');
      if (row && this.ptype === 'touch') {
        if (this.lpFired) { this.lpFired = false; return; }
        const i = +row.dataset.i;
        if (i === this.tapPrev) run(() => this.open(i));
        return;
      }
      if (!row || this.pendingSingle == null) return;
      const ent = this.view[+row.dataset.i];
      if (+row.dataset.i === this.pendingSingle && ent && !ent.up && !e.ctrlKey && !e.shiftKey) {
        this.sel.clear(); this.sel.add(ent.n);
        this.render(); this.updateStatus();
      }
      this.pendingSingle = null;
    });
    this.rowsEl.addEventListener('dblclick', e => {
      if (this.ptype === 'touch') return;
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
      let items;
      if (this.sel.has(ent.n)) items = this.targets();           // kijelöltről indul: az egész kijelölés megy
      else if (leftSel) { this.sel.clear(); this.sel.add(ent.n); this.render(); this.updateStatus(); items = [ent]; }
      else items = [ent];                                       // TC-stílus: csak ez az elem, a kijelölés marad
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
      if (this.arc) return;                       // archívumba nem lehet ejteni (csak olvasható)
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

  /* jobb gombos kijelölés az egér magasságában lévő sorig (a közbülsőket is) */
  rdragTo() {
    const r = this.list.getBoundingClientRect();
    const y = Math.max(r.top, Math.min(r.bottom - 1, this.rY));
    const i = Math.max(0, Math.min(this.view.length - 1, Math.floor((y - r.top + this.list.scrollTop) / ROW_H)));
    if (i === this.rlast && i === this.cursor) return;
    const step = i >= this.rlast ? 1 : -1;
    for (let k = this.rlast; k !== i + step; k += step) {
      const ent = this.view[k];
      if (ent && !ent.up) this.setSel(ent, this.rsel);
    }
    this.rlast = i;
    this.cursor = i;
    this.render(); this.updateStatus();
  }
  rdragScroll() {
    if (!this.rdrag) return;
    const r = this.list.getBoundingClientRect(), edge = ROW_H * 1.5;
    let d = 0;
    if (this.rY < r.top + edge) d = -Math.ceil((r.top + edge - this.rY) / 4);
    else if (this.rY > r.bottom - edge) d = Math.ceil((this.rY - (r.bottom - edge)) / 4);
    if (!d) return;
    this.list.scrollTop += Math.max(-ROW_H * 3, Math.min(ROW_H * 3, d));
    this.rdragTo();
  }
  rdragEnd() {
    this.rdrag = false;
    clearInterval(this.rTimer);
    this.rTimer = 0;
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
    this.arc = d.archive || null;
    this.el.classList.toggle('in-arc', !!this.arc);
    this.entries = d.entries.map(prep);
    if (!same) {
      this.cursor = 0;
      this.sel.clear(); this.sizes.clear(); this.pending.clear(); this.quickReset(true);
      this.filter = ''; this.filterBar.hidden = true;
      if (push) { this.hist = this.hist.slice(0, this.hpos + 1); this.hist.push(d.path); if (this.hist.length > 100) this.hist.shift(); this.hpos = this.hist.length - 1; }
    }
    if (this.arc) for (const e of d.entries) if (e.d && e.ds != null) this.sizes.set(e.n, e.ds);   // archívumban a mappaméret ismert
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
    const fre = this.filterRe();
    const arr = this.entries.filter(e => (showHidden || e.n[0] !== '.') && (!fre || fre.test(e.n)));
    if (fre) this.filterCount.textContent = t('filter_count', arr.length, this.entries.filter(e => showHidden || e.n[0] !== '.').length);
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
    /* a teljes magasság most kell, hogy legyen: különben a görgetés a régi (rövidebb) listához igazodna,
       és mappából kilépve a lista a tetejére ugrana a kurzor helyett */
    this.spacer.style.height = arr.length * ROW_H + 'px';
    const names = new Set(arr.map(e => e.n));
    for (const n of this.sel) if (!names.has(n)) this.sel.delete(n);
    const c = focusName != null ? arr.findIndex(e => e.n === focusName) : -1;
    this.cursor = c >= 0 ? c : Math.max(0, Math.min(this.cursor, arr.length - 1));
    this.updateStatus();
  }

  /* --- szűrő: szövegrész (kis/nagybetű mindegy) vagy minta (*, ?), több is ; vagy szóköz között */
  filterRe() {
    const f = this.filter.trim();
    if (!f) return null;
    const parts = globList(f).map(g => {
      const x = globSrc(g);
      return /[*?]/.test(g) ? '^' + x + '$' : x;
    });
    return new RegExp(parts.join('|'), 'i');
  }
  openFilter() {
    this.filterBar.hidden = false;
    this.filterInput.value = this.filter;
    this.filterInput.focus();
    this.filterInput.select();
    this.render();
  }
  setFilter(v) {
    this.filter = v;
    const cur = this.view[this.cursor];
    this.rebuild(cur && cur.n);
    this.ensureVisible(); this.render();
  }
  clearFilter() {
    this.filterInput.blur();
    this.filterBar.hidden = true;
    if (this.filter) this.setFilter('');
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
        el.draggable = !e.up && !COARSE;
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
    if (qv.on && this === active) qvSchedule();
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
    const tab = $('#ptab' + this.side);
    if (tab) tab.textContent = baseName(this.path) || this.path;
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
    this.statusEl.textContent = t('status', fmtSize(bs), fmtSize(bt), fs, ft, ds, dt) + (this.arc ? ' · ' + t('arc_status') : '');
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
  /* asArc: Ctrl+PgDn – bármely fájlt archívumként próbál megnyitni (pl. .jar, .docx, .apk) */
  open(i, asArc) {
    const e = this.view[i];
    if (!e) return;
    if (e.up) return this.goUp();
    const path = pjoin(this.path, e.n);
    if (e.d) return this.load(path);
    if (!this.arc && (asArc || ARCH_RE.test(e.n))) return this.load(path);
    window.open(rawUrl(path), '_blank');
  }
  openCur(asArc) { return this.open(this.cursor, asArc); }
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
    if (this.pending.has(e.n) || this.arc) return;
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
  if (qv.on && p === qv.target) return;      // a gyorsnézet panelje nem lehet aktív
  for (const s of ['L', 'R']) { const b = $(`[data-cmd=tab${s}]`); if (b) b.classList.toggle('on', p.side === s); }
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
const whatText = names => (names.length === 1 ? t('quoted', names[0]) : t('n_items', names.length));
/* ha a másik panel ugyanazt a mappát mutatja, azt is frissíteni kell */
const syncOther = p => (p.other.path === p.path ? p.other.refresh() : null);
/* kicsomagolás / kibontás: felülír vagy kihagy (az utolsó választást megjegyzi) */
const unpackPolicy = () => {
  const pol = store.get('unpackpol', 'overwrite');
  return `<label>${t('if_exists')}<select name="policy"><option value="overwrite">${esc(t('pol_overwrite'))}</option><option value="skip"${pol === 'skip' ? ' selected' : ''}>${esc(t('pol_skip'))}</option></select></label>`;
};
/* fel / le nyíl gombok listáján a dialógusokban (meghajtók, kedvencek); true, ha kezelte */
function listNav(ev, form, sel) {
  if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return false;
  ev.preventDefault();
  const bs = [...form.querySelectorAll(sel)];
  if (bs.length) bs[(bs.indexOf(document.activeElement) + (ev.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
  return true;
}

/* archívumban nem lehet módosítani: a hívó parancs hibaüzenettel leáll */
function ro(p = active) { if (p && p.arc) throw new Error(t('arc_readonly')); }
const arcDir = arc => arc.slice(0, arc.length - baseName(arc).length);

async function copyDialog(move, src = active, dest, items) {
  items = items || src.targets();
  if (!items.length) return;
  if (src.arc) {                               // archívumból: kibontás
    if (move) throw new Error(t('arc_readonly'));
    return extractDialog(src.path, items.map(e => e.n), dest || (src.other.arc ? arcDir(src.arc) : src.other.path), arcDir(src.arc));
  }
  if (!dest) ro(src.other);
  dest = dest || src.other.path;
  const what = whatText(items.map(e => e.n));
  const r = await modal({
    title: t(move ? 'move_title' : 'copy_title'),
    ok: t(move ? 'move_btn' : 'copy_btn'),
    body: `<label>${t(move ? 'move_to' : 'copy_to', esc(what))}<input name="dest" value="${esc(dest)}"></label>
           <label>${t('if_exists')}${policySelect(store.get('policy', 'ask'))}</label>
           <p class="hint">${t('copy_hint')}</p>`,
  });
  if (!r) return;
  const d = r.dest.trim();
  if (!d) return;
  store.set('policy', r.policy);
  await POST('/api/copy', { sources: items.map(e => pjoin(src.path, e.n)), dest: resolvePath(src.path, d), move, policy: r.policy });
  src.selectNone();
  pollSoon();
}

async function cmdDelete() {
  const p = active, items = p.targets();
  if (!items.length) return;
  ro(p);
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
  ro(p);
  const r = await modal({ title: t('mkdir_title'), ok: t('create_btn'), body: `<label>${t('mkdir_label')}<input name="name"></label>` });
  if (!r || !r.name.trim()) return;
  const name = r.name.trim();
  await POST('/api/mkdir', { path: resolvePath(p.path, name), parents: true });
  await p.load(p.path, name.split(/[\\/]/)[0], false);
  syncOther(p);
}

async function cmdNewFile() {
  const p = active;
  ro(p);
  const r = await modal({ title: t('newfile_title'), ok: t('newfile_btn'), body: `<label>${t('newfile_label')}<input name="name" value="${t('newfile_default')}"></label>` });
  if (!r || !r.name.trim()) return;
  const name = r.name.trim();
  const path = resolvePath(p.path, name);
  await POST('/api/mkfile', { path });
  await p.load(p.path, baseName(path), false);
  await cmdEdit(path);
}

async function cmdRename() {
  const p = active, e = p.view[p.cursor];
  if (!e || e.up) return;
  ro(p);
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
  syncOther(p);
}

/* ------------------------------------------------------------ csoportos átnevezés (Ctrl+M), mint a TC-ben */
const MR_DEF = { mask: '[N]', ext: '[E]', search: '', replace: '', regex: false, cs: false, first: false, kase: 'keep', cstart: '1', cstep: '1', cdigits: '1' };
const MR_INS = ['[N]', '[N1-3]', '[E]', '[C]', '[P]', '[d]', '[t]', '[Y]', '[M]', '[D]', '[h]', '[m]', '[U]', '[L]', '[F]', '[n]'];

/* [N2-5] 2–5. karakter, [N2,3] 3 karakter a 2.-tól, [N2-] a 2.-tól a végéig, [N-3-] az utolsó 3, [N-5] hátulról az 5. */
function mrRange(s, spec) {
  if (!spec) return s;
  const m = /^(-?\d+)(?:(-)(-?\d+)?|,(\d+))?$/.exec(spec);
  if (!m) return null;
  const ch = [...s], L = ch.length;
  const pos = v => (v < 0 ? L + v + 1 : v);
  let a = pos(+m[1]), b;
  if (m[4] != null) b = a + +m[4] - 1;
  else if (m[2]) b = m[3] != null ? pos(+m[3]) : L;
  else b = a;
  a = Math.max(1, a);
  return ch.slice(a - 1, Math.max(a - 1, b)).join('');
}

const mrWords = s => s.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
function mrCase(s, mode) {
  if (mode === 'U') return s.toUpperCase();
  if (mode === 'L') return s.toLowerCase();
  if (mode === 'F') return mrWords(s);
  return s;
}

function mrToken(tok, c) {
  let m = /^([NEPG])(.*)$/.exec(tok);
  if (m) { const r = mrRange({ N: c.name, E: c.ext, P: c.parent, G: c.grand }[m[1]], m[2]); return r == null ? null : r; }
  m = /^C(\d+)?(?:\+(-?\d+))?(?::(\d+))?$/.exec(tok);
  if (m) {
    const v = (m[1] != null ? +m[1] : c.cstart) + c.idx * (m[2] != null ? +m[2] : c.cstep);
    return (v < 0 ? '-' : '') + String(Math.abs(v)).padStart(Math.min(20, m[3] != null ? +m[3] : c.cdigits), '0');
  }
  const d = c.date, Y = String(d.getFullYear()), M = pad(d.getMonth() + 1), D = pad(d.getDate());
  const h = pad(d.getHours()), mi = pad(d.getMinutes()), sec = pad(d.getSeconds());
  const V = { Y, y: Y.slice(2), M, D, h, m: mi, s: sec, d: `${Y}-${M}-${D}`, t: `${h}.${mi}.${sec}` };
  return V[tok] != null ? V[tok] : null;
}

/* a minta kiértékelése; [U] [L] [F] [n]: kis/nagybetű innentől, [[] és []]: szögletes zárójel */
function mrMask(mask, c) {
  let out = '', mode = 'n', i = 0;
  while (i < mask.length) {
    if (mask[i] !== '[') {
      const k = mask.indexOf('[', i), j = k < 0 ? mask.length : k;
      out += mrCase(mask.slice(i, j), mode);
      i = j;
      continue;
    }
    if (mask.startsWith('[[]', i)) { out += '['; i += 3; continue; }
    if (mask.startsWith('[]]', i)) { out += ']'; i += 3; continue; }
    const j = mask.indexOf(']', i + 1);
    if (j < 0) { out += mrCase(mask.slice(i), mode); break; }
    const tok = mask.slice(i + 1, j);
    i = j + 1;
    if (/^[ULFn]$/.test(tok)) { mode = tok; continue; }
    const v = mrToken(tok, c);
    out += v == null ? `[${tok}]` : mrCase(v, mode);
  }
  return out;
}

/* keresés és csere; sima szövegnél több keresett szó | jellel elválasztva (a cserében is, párban) */
function mrReplacer(o) {
  if (!o.search) return s => s;
  const fl = (o.first ? '' : 'g') + (o.cs ? '' : 'i');
  if (o.regex) { const re = new RegExp(o.search, fl); return s => s.replace(re, o.replace); }
  const ss = o.search.split('|'), rs = o.replace.split('|');
  const pairs = ss.map((x, k) => [x, rs.length === ss.length ? rs[k] : o.replace]).filter(x => x[0]);
  if (!pairs.length) return s => s;
  const re = new RegExp(pairs.map(x => reEsc(x[0])).join('|'), fl);
  const same = o.cs ? (a, b) => a === b : (a, b) => a.toLowerCase() === b.toLowerCase();
  return s => s.replace(re, m => (pairs.find(x => same(x[0], m)) || [m, m])[1]);
}

function mrCaseAll(n, isDir, mode) {
  if (mode === 'lower') return n.toLowerCase();
  if (mode === 'upper') return n.toUpperCase();
  if (mode !== 'first' && mode !== 'words') return n;
  const dot = isDir ? -1 : n.lastIndexOf('.');
  const b = dot > 0 ? n.slice(0, dot) : n, x = dot > 0 ? n.slice(dot) : '';
  return (mode === 'words' ? mrWords(b) : b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()) + x;
}

const enc = new TextEncoder();
function mrNameError(n) {
  if (!n || n === '.' || n === '..' || n.includes('/') || n.includes('\0') || (INFO.win && /[\\:]/.test(n))) return 'mr_err_bad';
  if (enc.encode(n).length > 255) return 'mr_err_long';
  return '';
}

/* az új nevek kiszámítása és ellenőrzése */
function mrCompute(p, items, o, manual) {
  const rep = mrReplacer(o);                   // hibás reguláris kifejezésnél kivételt dob
  const c = {
    parent: baseName(p.path), grand: p.parent ? baseName(p.parent) : '',
    cstart: parseInt(o.cstart, 10) || 0, cstep: parseInt(o.cstep, 10) || 0, cdigits: Math.max(1, parseInt(o.cdigits, 10) || 1),
  };
  const rows = items.map((e, idx) => {
    let to;
    if (manual) to = manual[idx];
    else {
      Object.assign(c, { idx, name: e.base, ext: e.ext, date: new Date((e.m || 0) * 1000) });
      const x = mrMask(o.ext, c);
      to = mrCaseAll(rep(mrMask(o.mask, c) + (x ? '.' + x : '')), e.d, o.kase);
    }
    return { e, from: e.n, to, err: '' };
  });
  const key = INFO.win ? s => s.toLowerCase() : s => s;
  const moving = new Set(rows.filter(r => r.to !== r.from).map(r => r.from));
  const taken = new Set(p.entries.filter(e => !moving.has(e.n)).map(e => key(e.n)));
  const count = new Map();
  for (const r of rows) count.set(key(r.to), (count.get(key(r.to)) || 0) + 1);
  let changed = 0, errors = 0;
  for (const r of rows) {
    if (r.to === r.from) continue;
    changed++;
    r.err = mrNameError(r.to) || (count.get(key(r.to)) > 1 ? 'mr_err_dup' : '')
      || (taken.has(key(r.to)) && key(r.to) !== key(r.from) ? 'mr_err_exists' : '');
    if (r.err) errors++;
  }
  return { rows, changed, errors };
}

async function cmdMultiRename() {
  const p = active;
  ro(p);
  const items = p.targets();
  if (!items.length) return;
  const saved = Object.assign({}, MR_DEF, store.get('mr', {}));
  const undo = store.get('mr.undo', null);
  const canUndo = undo && undo.dir === p.path && undo.pairs && undo.pairs.length;
  let manual = null, res = null, opts = saved;
  const chk = (n, l) => `<label class="chk"><input type="checkbox" name="${n}"${saved[n] ? ' checked' : ''}> ${t(l)}</label>`;
  const inp = (n, l, cls = '') => `<label class="${cls}">${t(l)}<input name="${n}" value="${esc(saved[n])}" spellcheck="false"></label>`;
  const cases = ['keep', 'lower', 'upper', 'first', 'words'].map(k => `<option value="${k}"${saved.kase === k ? ' selected' : ''}>${esc(t('mr_case_' + k))}</option>`).join('');
  const r = await modal({
    title: t('mr_title', items.length), cls: 'mr', select: false,
    body: `<fieldset class="mr-rules">
        <div class="mr-grid">${inp('mask', 'mr_mask')}${inp('ext', 'mr_ext')}</div>
        <div class="mr-ins"><span>${t('mr_ins')}</span>${MR_INS.map(x => `<button type="button" tabindex="-1" data-ins="${x}">${x}</button>`).join('')}</div>
        <div class="mr-grid">${inp('search', 'mr_search')}${inp('replace', 'mr_replace')}</div>
        <div class="mr-opts">${chk('regex', 'mr_regex')}${chk('cs', 'mr_cs')}${chk('first', 'mr_first')}</div>
        <div class="mr-grid">
          <label>${t('mr_case')}<select name="kase">${cases}</select></label>
          <div class="mr-counter"><span>${t('mr_counter')}</span>${inp('cstart', 'mr_start')}${inp('cstep', 'mr_step')}${inp('cdigits', 'mr_digits')}</div>
        </div>
      </fieldset>
      <div class="mr-manual" hidden>${t('mr_manual')} <button type="button" class="mr-manual-off">${t('mr_manual_off')}</button></div>
      <details class="mr-help"><summary>${t('mr_help_t')}</summary><div>${t('mr_help')}</div></details>
      <div class="mr-prev"><table><thead><tr><th>${t('mr_old')}</th><th>${t('mr_new')}</th></tr></thead><tbody></tbody></table></div>
      <div class="mr-stat"></div>`,
    buttons: [
      { label: t('mr_edit'), action: (close, form) => run(() => form._edit()) },
      { label: t('mr_reset'), action: (close, form) => form._reset() },
    ].concat(canUndo ? [{ label: t('mr_undo', undo.pairs.length), value: 'undo' }] : []).concat([
      { label: t('mr_btn'), primary: true, action: (close, form) => form._go(close) },
      { label: t('cancel'), value: null },
    ]),
    onOpen(form) {
      const el = form.elements, tbody = form.querySelector('tbody'), stat = form.querySelector('.mr-stat');
      const okBtn = form.querySelector('.dlg-btns .primary');
      const rules = form.querySelector('.mr-rules'), man = form.querySelector('.mr-manual');
      let target = el.mask, timer = 0;
      const read = () => {
        const o = {};
        for (const k of Object.keys(MR_DEF)) o[k] = typeof MR_DEF[k] === 'boolean' ? el[k].checked : el[k].value;
        return o;
      };
      const draw = () => {
        opts = read();
        rules.disabled = !!manual;
        man.hidden = !manual;
        try { res = mrCompute(p, items, opts, manual); } catch (err) {
          res = null;
          stat.innerHTML = `<span class="err">${esc(t('mr_bad_re', err.message))}</span>`;
          okBtn.disabled = true;
          return;
        }
        const MAX = 1000;
        tbody.innerHTML = res.rows.slice(0, MAX).map(x => `<tr class="${x.to === x.from ? 'same' : x.err ? 'bad' : ''}"><td>${icon(x.e)}<span>${esc(x.from)}</span></td><td><span>${esc(x.to)}</span>${x.err ? `<em>${esc(t(x.err))}</em>` : ''}</td></tr>`).join('')
          + (res.rows.length > MAX ? `<tr class="same"><td colspan="2">${esc(t('and_more', res.rows.length - MAX))}</td></tr>` : '');
        stat.innerHTML = esc(t('mr_stat', res.rows.length, res.changed)) + (res.errors ? ` · <span class="err">${esc(t('mr_stat_err', res.errors))}</span>` : '');
        okBtn.disabled = !res.changed || res.errors > 0;
      };
      const later = () => { clearTimeout(timer); timer = setTimeout(draw, 60); };
      form.addEventListener('input', later);
      form.addEventListener('change', later);
      form.addEventListener('focusin', e => { if (e.target === el.mask || e.target === el.ext) target = e.target; });
      form.querySelector('.mr-ins').addEventListener('click', e => {
        const b = e.target.closest('[data-ins]');
        if (!b || manual) return;
        target.focus();
        target.setRangeText(b.dataset.ins, target.selectionStart, target.selectionEnd, 'end');
        draw();
      });
      form.querySelector('.mr-manual-off').addEventListener('click', () => { manual = null; draw(); });
      form._reset = () => {
        manual = null;
        for (const [k, v] of Object.entries(MR_DEF)) { if (typeof v === 'boolean') el[k].checked = v; else el[k].value = v; }
        draw();
        el.mask.focus();
      };
      form._go = close => {
        clearTimeout(timer);
        draw();
        if (res && res.changed && !res.errors) close('ok');
      };
      form._edit = async () => {
        if (!res) return;
        const e2 = await modal({
          title: t('mr_edit_title'), cls: 'editor', select: false,
          body: `<textarea name="text" spellcheck="false">${esc(res.rows.map(x => x.to).join('\n'))}</textarea><div class="ed-info">${esc(t('mr_edit_hint', items.length))}</div>`,
          onKey(ev) { return ev.key === 'Enter'; },
        });
        if (!e2) return;
        const lines = e2.text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
        if (lines.length !== items.length) throw new Error(t('mr_edit_count', lines.length, items.length));
        manual = lines;
        draw();
      };
      draw();
      el.mask.focus();
      const v = el.mask.value, k = v.indexOf('[N]');   // a kurzor a [N] után, mint a TC-ben
      el.mask.setSelectionRange(k >= 0 ? k + 3 : v.length, k >= 0 ? k + 3 : v.length);
    },
    onKey(ev, close, form) {
      if (ev.key === 'Enter' && !ev.isComposing && ev.target.tagName !== 'BUTTON' && ev.target.tagName !== 'TEXTAREA') {
        ev.preventDefault(); ev.stopPropagation();
        form._go(close);
        return true;
      }
      return false;
    },
  });
  if (!r) return;
  let pairs;
  if (r._btn === 'undo') pairs = undo.pairs;
  else {
    store.set('mr', opts);
    pairs = res.rows.filter(x => x.to !== x.from).map(x => [x.from, x.to]);
  }
  const out = await POST('/api/multirename', { dir: p.path, pairs });
  if (r._btn === 'undo') store.set('mr.undo', null);
  else store.set('mr.undo', { dir: p.path, pairs: out.done.map(([a, b]) => [b, a]) });
  const map = new Map(out.done);
  const sel = new Set([...p.sel].filter(n => !map.has(n)));
  for (const [a, b] of out.done) if (p.sel.has(a)) sel.add(b);
  p.sel = sel;
  const cur = p.view[p.cursor];
  await p.load(p.path, cur ? (map.get(cur.n) || cur.n) : null, false);
  syncOther(p);
  if (out.errors.length) toast(t('n_errors_first', out.errors.length, out.errors[0]), 'err');
  else toast(t(r._btn === 'undo' ? 'mr_undone' : 'mr_done', out.done.length), 'ok');
}

function cmdView() {
  const p = active, e = p.view[p.cursor];
  if (!e) return;
  if (e.d) { if (!e.up) p.calcSize(e); return; }
  window.open(rawUrl(pjoin(p.path, e.n)), '_blank');
}

function cmdDownload() {
  const p = active, items = p.targets();
  if (!items.length) return;
  if (p.arc && (items.length > 1 || items[0].d)) throw new Error(t('arc_nozip'));
  const a = document.createElement('a');
  if (items.length === 1 && !items[0].d) {
    a.href = rawUrl(pjoin(p.path, items[0].n), true);
    a.download = items[0].n;
  } else {                                     // mappa vagy több elem: egyetlen zip, menet közben készül
    const q = new URLSearchParams({ dir: p.path });
    items.forEach(e => q.append('n', e.n));
    a.href = '/api/zip?' + q;
  }
  document.body.appendChild(a); a.click(); a.remove();
}

/* ------------------------------------------------------------ tömörítés / kicsomagolás */
const PACK_FMTS = ['zip', 'tar.gz', 'tar.xz', 'tar'];
const ARCH_RE = /\.(zip|tar|tgz|txz|tbz2?|tar\.(gz|xz|bz2))$/i;

async function cmdPack() {
  const p = active, items = p.targets();
  if (!items.length) return;
  ro(p);
  let fmt = store.get('packfmt', 'zip');
  if (!PACK_FMTS.includes(fmt)) fmt = 'zip';
  const base = items.length === 1 ? (items[0].d ? items[0].n : items[0].base) : (baseName(p.path) || 'archive');
  const what = whatText(items.map(e => e.n));
  const r = await modal({
    title: t('pack_title'), ok: t('pack_btn'),
    body: `<label>${t('pack_what', esc(what))}<input name="dest" value="${esc(pjoin(p.other.arc ? p.path : p.other.path, base + '.' + fmt))}"></label>
           <label>${t('pack_format')}<select name="format">${PACK_FMTS.map(f => `<option${f === fmt ? ' selected' : ''}>${f}</option>`).join('')}</select></label>`,
    onOpen(f) {
      const sel = f.elements.format, inp = f.elements.dest;
      sel.addEventListener('change', () => {
        const v = inp.value, old = PACK_FMTS.find(x => v.endsWith('.' + x));
        inp.value = (old ? v.slice(0, -old.length) : v + '.') + sel.value;
      });
    },
  });
  if (!r || !r.dest.trim()) return;
  const dest = resolvePath(p.path, r.dest.trim());
  store.set('packfmt', r.format);
  await POST('/api/pack', { sources: items.map(e => pjoin(p.path, e.n)), dest, format: r.format });
  p.selectNone();
  pollSoon();
}

async function cmdUnpack() {
  const p = active;
  ro(p);
  const items = p.targets().filter(e => !e.d && ARCH_RE.test(e.n));
  if (!items.length) { toast(t('unpack_none'), 'err'); return; }
  const what = whatText(items.map(e => e.n));
  const r = await modal({
    title: t('unpack_title'), ok: t('unpack_btn'),
    body: `<label>${t('unpack_to', esc(what))}<input name="dest" value="${esc(p.other.arc ? p.path : p.other.path)}"></label>
           <label class="chk"><input type="checkbox" name="subdir"${store.get('unpacksub', true) ? ' checked' : ''}> ${t('unpack_subdir')}</label>
           ${unpackPolicy()}`,
  });
  if (!r || !r.dest.trim()) return;
  const dest = resolvePath(p.path, r.dest.trim());
  store.set('unpacksub', !!r.subdir);
  store.set('unpackpol', r.policy);
  await POST('/api/unpack', { archives: items.map(e => pjoin(p.path, e.n)), dest, subdir: !!r.subdir, policy: r.policy });
  p.selectNone();
  pollSoon();
}

/* kijelölt elemek kibontása egy archívum belsejéből (F5, húzás, Ctrl+C / Ctrl+V); base: a relatív cél alapja */
async function extractDialog(path, names, dest, base) {
  if (!names.length) return;
  const what = whatText(names);
  const r = await modal({
    title: t('extract_title'), ok: t('extract_btn'),
    body: `<label>${t('extract_to', esc(what))}<input name="dest" value="${esc(dest)}"></label>
           ${unpackPolicy()}`,
  });
  if (!r || !r.dest.trim()) return;
  const d = resolvePath(base, r.dest.trim());
  store.set('unpackpol', r.policy);
  await POST('/api/extract', { path, names, dest: d, policy: r.policy });
  for (const p of Object.values(panels)) if (p.path === path) p.selectNone();
  pollSoon();
}

/* ------------------------------------------------------------ kedvenc mappák (a szerveren tárolva, minden eszközön ugyanaz) */
let FAVS = null;
async function favLoad() {
  if (FAVS == null) { try { FAVS = (await GET('/api/bookmarks')).items; } catch (e) { FAVS = []; } }
  return FAVS;
}
async function favSave(items) { FAVS = (await POST('/api/bookmarks', { items })).items; }

async function favAdd(p = active) {
  const list = await favLoad();
  if (list.includes(p.path)) { toast(t('fav_exists')); return; }
  await favSave(list.concat([p.path]));
  toast(t('fav_added', p.path), 'ok');
}

async function favMenu(p = active) {
  setActive(p);
  p = active;
  await favLoad();
  const STAR = '<svg viewBox="0 0 16 16"><path d="M8 1.3l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.4 1-4.6L1.3 6.1 6 5.6z" fill="#ffc83d" stroke="#b07d00"/></svg>';
  const r = await modal({
    title: t('fav_title'), cls: 'favs',
    buttons: [
      { label: t('fav_add_btn'), action: (close, form) => run(async () => { await favAdd(p); form._draw(); }) },
      { label: t('close'), value: null },
    ],
    body: '<div class="fav-list"></div>',
    onOpen(form, close) {
      const box = form.querySelector('.fav-list');
      form._draw = (focus = 0) => {
        box.innerHTML = FAVS.length
          ? FAVS.map((f, i) => `<button type="button" class="menu-drv fav" data-i="${i}">${STAR}<span>${esc(baseName(f) || f)}</span><span class="m-free"><bdi>${esc(f)}</bdi></span><span class="fav-del" data-del="${i}" title="${esc(t('fav_remove'))}">✕</span></button>`).join('')
            + `<p class="hint">${t('fav_hint')}</p>`
          : `<p class="hint">${t('fav_empty')}</p>`;
        const bs = box.querySelectorAll('.fav');
        if (bs.length) bs[Math.min(focus, bs.length - 1)].focus();
      };
      form._del = i => run(async () => { await favSave(FAVS.filter((_, k) => k !== i)); form._draw(i); });
      box.addEventListener('click', e => {
        const d = e.target.closest('[data-del]');
        if (d) { form._del(+d.dataset.del); return; }
        const b = e.target.closest('.fav');
        if (b) close(FAVS[+b.dataset.i]);
      });
      form._draw();
    },
    onKey(ev, close, form) {
      if (listNav(ev, form, '.fav')) return true;
      const i = [...form.querySelectorAll('.fav')].indexOf(document.activeElement);
      if (ev.key === 'Delete' && i >= 0) { ev.preventDefault(); form._del(i); return true; }
      return false;
    },
  });
  if (r) await p.load(r._btn);
}

/* ------------------------------------------------------------ gyorsnézet (Ctrl+Q): a másik panelen előnézet */
const qv = { on: false, target: null, box: null, key: '', timer: 0 };
const QV_IMG = new Set('jpg jpeg png gif bmp webp svg ico avif'.split(' '));
const QV_VIDEO = new Set('mp4 webm mkv mov m4v ogv'.split(' '));
const QV_AUDIO = new Set('mp3 wav flac ogg opus m4a aac'.split(' '));

function qvToggle() {
  if (qv.on) { qvClose(); return; }
  if (!active) return;
  qv.on = true;
  qv.target = active.other;
  qv.box = document.createElement('div');
  qv.box.className = 'qv';
  qv.target.el.appendChild(qv.box);
  qv.target.el.classList.add('qv-target');
  qv.key = '';
  $('[data-cmd=qview]').classList.add('on');
  qvUpdate();
}

function qvClose() {
  if (qv.box) qv.box.remove();
  if (qv.target) qv.target.el.classList.remove('qv-target');
  Object.assign(qv, { on: false, target: null, box: null, key: '' });
  $('[data-cmd=qview]').classList.remove('on');
}

function qvSchedule() { clearTimeout(qv.timer); qv.timer = setTimeout(qvUpdate, 120); }

async function qvUpdate() {
  if (!qv.on || !active) return;
  const p = active, e = p.view[p.cursor];
  const path = e && !e.up ? pjoin(p.path, e.n) : '';
  const key = path + '|' + (e ? e.m : '') + '|' + (e && e.d ? p.sizes.get(e.n) : '');
  if (key === qv.key) return;
  qv.key = key;
  const box = qv.box;
  if (!e || e.up) { box.innerHTML = `<div class="qv-msg">${esc(p.path)}</div>`; return; }
  const head = `<div class="qv-head">${icon(e)}<b>${esc(e.n)}</b><span>${e.d ? '' : esc(fmtSize(e.s))}</span><span>${esc(fmtDate(e.m))}</span></div>`;
  const ext = e.ext.toLowerCase(), url = esc(rawUrl(path));
  if (e.d) {
    box.innerHTML = head + `<div class="qv-msg">${p.sizes.has(e.n) ? esc(t('qv_dir_size', fmtSize(p.sizes.get(e.n)))) : esc(t('qv_dir'))}</div>`;
  } else if (QV_IMG.has(ext)) {
    box.innerHTML = head + `<div class="qv-media"><img src="${url}" alt=""></div>`;
  } else if (QV_VIDEO.has(ext)) {
    box.innerHTML = head + `<div class="qv-media"><video src="${url}" controls preload="metadata"></video></div>`;
  } else if (QV_AUDIO.has(ext)) {
    box.innerHTML = head + `<div class="qv-media"><audio src="${url}" controls preload="metadata"></audio></div>`;
  } else if (ext === 'pdf') {
    box.innerHTML = head + `<iframe class="qv-frame" src="${url}"></iframe>`;
  } else if (!p.arc && ARCH_RE.test(e.n)) {          // archívum: a tartalomjegyzéke
    box.innerHTML = head + '<div class="qv-msg">…</div>';
    try {
      const d = await GET('/api/list', { path });
      if (qv.key === key) box.lastElementChild.outerHTML = qvArcHtml(d);
    } catch (err) {
      if (qv.key === key) box.lastElementChild.textContent = err.message;
    }
  } else {
    box.innerHTML = head + '<pre class="qv-text">…</pre>';
    const pre = box.querySelector('.qv-text');
    try {
      const r = await GET('/api/text', { path, head: '1' });
      if (qv.key === key) pre.textContent = r.text + (r.truncated ? '\n…' : '');
    } catch (err) {
      if (qv.key === key) pre.outerHTML = `<div class="qv-msg">${esc(err.message)}</div>`;
    }
  }
}

function qvArcHtml(d) {
  const list = d.entries.map(prep).sort((a, b) => (a.d !== b.d ? (a.d ? -1 : 1) : collator.compare(a.n, b.n)));
  const files = list.filter(e => !e.d).length;
  const total = list.reduce((s, e) => s + (e.d ? e.ds || 0 : e.s), 0);
  const MAX = 500;
  const rows = list.slice(0, MAX).map(e => `<tr><td>${icon(e)}<span>${esc(e.n)}</span></td><td>${esc(fmtSize(e.d ? e.ds : e.s))}</td><td>${esc(fmtDate(e.m))}</td></tr>`).join('');
  return `<div class="qv-arc"><div class="qv-sum">${esc(t('qv_arc', files, list.length - files, fmtSize(total)))} · ${esc(t('qv_arc_enter'))}</div>`
    + `<table>${rows}</table>${list.length > MAX ? `<div class="qv-sum">${esc(t('and_more', list.length - MAX))}</div>` : ''}</div>`;
}

/* ------------------------------------------------------------ téma és sorhossz */
/* data-theme: a választás (auto / light / dark); data-dark: most sötét-e – a CSS csak ezt nézi */
const DARK_MQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(m) {
  const r = document.documentElement;
  r.dataset.theme = ['light', 'dark'].includes(m) ? m : 'auto';
  r.toggleAttribute('data-dark', r.dataset.theme === 'dark' || (r.dataset.theme === 'auto' && DARK_MQ.matches));
}
DARK_MQ.addEventListener('change', () => applyTheme(document.documentElement.dataset.theme));
function setTheme(m) { store.set('theme', m); applyTheme(m); }

function updateRowH() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h'));
  const n = v > 0 ? v : 20;
  if (n === ROW_H) return;
  ROW_H = n;
  for (const p of Object.values(panels)) { p.gen++; p.ensureVisible(); p.render(); }
}

async function cmdEdit(path) {
  const p = active;
  if (!path) {
    const e = p.view[p.cursor];
    if (!e || e.d) return;
    ro(p);
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
  ro(p);
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
  syncOther(p);
}

async function selectPattern(on) {
  const p = active, cur = p.view[p.cursor];
  const def = on && cur && !cur.d && cur.ext ? '*.' + cur.ext : '*';
  const r = await modal({
    title: t(on ? 'selpat_title' : 'unselpat_title'), ok: t(on ? 'select_btn' : 'unselect_btn'),
    body: `<label>${t('pattern_label')}<input name="pat" value="${esc(def)}"></label><label class="chk"><input type="checkbox" name="dirs"> ${t('pattern_dirs')}</label>`,
  });
  if (!r || !r.pat.trim()) return;
  const re = new RegExp('^(?:' + globList(r.pat).map(globSrc).join('|') + ')$', 'i');
  for (const e of p.view) {
    if (e.up || (e.d && !r.dirs)) continue;
    if (re.test(e.n)) p.setSel(e, on);
  }
  p.render(); p.updateStatus();
}

function swapPanels() {
  const a = panels.L.path, b = panels.R.path;
  return Promise.all([panels.L.load(b), panels.R.load(a)]);
}

function toggleLynx() {
  lynx = !lynx;
  store.set('lynx', lynx);
  toast(t(lynx ? 'lynx_on' : 'lynx_off'));
}

/* → Lynx-módban: mappába, archívumba vagy a ..-ba lép; sima fájlon nem csinál semmit */
function lynxEnter(p) {
  const e = p.view[p.cursor];
  if (e && (e.d || e.up || (!p.arc && ARCH_RE.test(e.n)))) return p.openCur();
}

function toggleLeftSel() {
  leftSel = !leftSel;
  store.set('leftsel', leftSel);
  toast(t(leftSel ? 'leftsel_on' : 'leftsel_off'));
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
  const p = active, items = p.targets();
  if (!items.length) return;
  if (p.arc) {                                 // archívumból: beillesztéskor kibontás
    if (move) ro(p);
    clip = { arc: p.path, base: arcDir(p.arc), names: items.map(e => e.n), move: false };
  } else clip = { paths: items.map(e => pjoin(p.path, e.n)), move };
  toast(t(move ? 'clip_cut' : 'clip_copied', items.length));
}

async function clipPaste() {
  if (!clip) return;
  ro(active);
  if (clip.arc) return extractDialog(clip.arc, clip.names, active.path, clip.base);
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
    onKey(ev, close, form) { return listNav(ev, form, '.menu-drv'); },
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
      ${K('Ctrl+M', t('h_multirename'))}
      ${K('F3 / Shift+F3', t('h_view'))}
      ${K('F4 / Shift+F4', t('h_edit'))}
      ${K('F5 / F6', t('h_copy'))}
      ${K('F7 / F8, Delete', t('h_mkdir'))}
      ${K('F9', t('h_chmod'))}
      ${K('Alt+F5 / Alt+F9', t('h_pack'))}
      ${K(t('h_arc_k'), t('h_arc'))}
      ${K('Ctrl+F', t('h_filter'))}
      ${K('Ctrl+D', t('h_fav'))}
      ${K('Ctrl+Q', t('h_qview'))}
      ${K('Ctrl+C / Ctrl+X / Ctrl+V', t('h_clip'))}
      ${K('Alt+F1 / Alt+F2', t('h_drives'))}
      ${K('F10', t('h_menu'))}
      ${K('Alt+← / Alt+→', t('h_hist'))}
      ${K('← / →', t('h_lynx'))}
      ${K('Ctrl+R, Ctrl+H, Ctrl+U, Ctrl+=', t('h_misc'))}
      ${K('Ctrl+\\', t('h_root'))}
      ${K('Alt+Shift+Enter', t('h_sizes'))}
      ${K(t('h_drag_k'), t('h_drag'))}
    </table>`,
  });
}

function cmdUpload() {
  ro(active);
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
  mkdir: cmdMkdir, del: cmdDelete, chmod: cmdChmod, rename: cmdRename, multirename: cmdMultiRename,
  refresh: () => { loadDrives(); return refreshAll(); }, hidden: toggleHidden, lynx: toggleLynx, leftsel: toggleLeftSel, swap: swapPanels,
  same: () => active.other.load(active.path), upload: cmdUpload, download: cmdDownload,
  sizes: () => active.calcAll(), help: cmdHelp, selpat: () => selectPattern(true), unselpat: () => selectPattern(false),
  invert: () => active.invert(), selall: () => active.selectAll(), selnone: () => active.selectNone(),
  root: () => active.nav('root'), home: () => active.nav('home'), up: () => active.nav('up'),
  drvL: () => driveMenu(panels.L), drvR: () => driveMenu(panels.R),
  sort_n: () => active.setSort('n'), sort_e: () => active.setSort('e'), sort_s: () => active.setSort('s'), sort_m: () => active.setSort('m'),
  about: cmdAbout, update: () => cmdUpdate(true),
  filter: () => active.openFilter(), fav: () => favMenu(active), favadd: () => favAdd(active), qview: qvToggle,
  pack: cmdPack, unpack: cmdUnpack,
  theme_auto: () => setTheme('auto'), theme_light: () => setTheme('light'), theme_dark: () => setTheme('dark'),
  tabL: () => setActive(panels.L), tabR: () => setActive(panels.R),
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
  const self = !!INFO.selfupdate;
  const r = await modal({
    title: t('upd_title'),
    buttons: self ? [{ label: t('upd_now'), value: 'go', primary: true }, { label: t('upd_later'), value: null }]
      : [{ label: t('ok'), value: 'ok', primary: true }],
    body: `<p>${t('upd_body', esc('v' + INFO.version), esc('v' + UPDATE.latest))}</p>
      ${self ? `<p>${t('upd_self')}</p><p class="hint">${t('upd_or')}</p>` : `<p>${t('upd_howto')}</p>`}
      <pre class="cmd">sudo gabo-commander update</pre>
      ${self ? '' : `<p class="hint">${t('upd_noself')}</p>`}
      ${repo ? `<p class="hint"><a href="${esc(repo)}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${t('upd_changes')}</a></p>` : ''}`,
  });
  if (r && r._btn === 'go') await selfUpdate();
}

/* frissítés a felületről: a szerver rootként futó frissítő egységet indít, mi addig figyelünk,
   amíg az új verzió el nem indul, aztán újratöltjük az oldalt */
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function selfUpdate() {
  const from = INFO.version;
  const { now: t0 } = await POST('/api/selfupdate');
  let form = null;
  modal({
    title: t('upd_running_title'), cancel: null, buttons: [], cls: 'wide',
    body: `<p class="upd-msg">${esc(t('upd_running', 'v' + UPDATE.latest))}</p><pre class="upd-log" hidden></pre>`,
    onOpen(f, close) { form = f; form._close = close; },
  });
  const msg = s => { form.querySelector('.upd-msg').textContent = s; };
  const finish = (text, log) => {
    msg(text);
    const pre = form.querySelector('.upd-log');
    if (log) { pre.hidden = false; pre.textContent = log; pre.scrollTop = pre.scrollHeight; }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'primary'; b.textContent = t('close');
    b.addEventListener('click', () => form._close('x'));
    form.querySelector('.dlg-btns').appendChild(b);
    b.focus();
  };
  for (let i = 0; i < 180; i++) {          // legfeljebb ~6 perc
    await sleep(2000);
    let s;
    try { s = await GET('/api/selfupdate'); } catch (e) { msg(t('upd_restarting')); continue; }
    const fresh = s.log_at >= t0 - 1;
    if (s.version !== from || (fresh && s.done && s.code === 0)) {
      msg(t('upd_done', 'v' + s.version));
      await sleep(1200);
      location.reload();
      return;
    }
    if (fresh && s.done) { finish(t('upd_failed'), s.log); return; }
    if (fresh && s.log) {
      const pre = form.querySelector('.upd-log');
      pre.hidden = false; pre.textContent = s.log; pre.scrollTop = pre.scrollHeight;
    }
  }
  finish(t('upd_timeout'), '');
}

/* ------------------------------------------------------------ menüsor (F10) */
/* [fordítási kulcs, parancs, gyorsbillentyű, pipa-e] – a feliratok megjelenítéskor fordítódnak */
const MENUS = [
  ['m_files', [
    ['mi_rename', 'rename', 'F2'], ['mi_multirename', 'multirename', 'Ctrl+M'], ['mi_view', 'view', 'F3'], ['mi_edit', 'edit', 'F4'], ['mi_newfile', 'newfile', 'Shift+F4'], '-',
    ['mi_copy', 'copy', 'F5'], ['mi_move', 'move', 'F6'], ['mi_mkdir', 'mkdir', 'F7'], ['mi_del', 'del', 'F8'], '-',
    ['mi_chmod', 'chmod', 'F9'], '-',
    ['mi_pack', 'pack', 'Alt+F5'], ['mi_unpack', 'unpack', 'Alt+F9'], '-',
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
    ['mi_drvL', 'drvL', 'Alt+F1'], ['mi_drvR', 'drvR', 'Alt+F2'], '-',
    ['mi_fav', 'fav', 'Ctrl+D'], ['mi_favadd', 'favadd', ''],
  ]],
  ['m_view', [
    ['mi_hidden', 'hidden', 'Ctrl+H', () => showHidden],
    ['mi_filter', 'filter', 'Ctrl+F'], ['mi_qview', 'qview', 'Ctrl+Q', () => qv.on],
    ['mi_lynx', 'lynx', '← →', () => lynx],
    ['mi_leftsel', 'leftsel', '', () => leftSel], '-',
    ['mi_sort_n', 'sort_n', '', () => active && active.sort.key === 'n'],
    ['mi_sort_e', 'sort_e', '', () => active && active.sort.key === 'e'],
    ['mi_sort_s', 'sort_s', '', () => active && active.sort.key === 's'],
    ['mi_sort_m', 'sort_m', '', () => active && active.sort.key === 'm'], '-',
    ['mi_theme_auto', 'theme_auto', '', () => document.documentElement.dataset.theme === 'auto'],
    ['mi_theme_light', 'theme_light', '', () => document.documentElement.dataset.theme === 'light'],
    ['mi_theme_dark', 'theme_dark', '', () => document.documentElement.dataset.theme === 'dark'], '-',
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
  pollTimer = setTimeout(pollJobs, busy ? 500 : document.hidden ? 20000 : 3000);   // háttérben lévő lapon ritkábban
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
    case 'PageDown': return go(() => (ctrl ? p.openCur(true) : p.move(p.pageSize(), sh)));
    case 'PageUp': return go(() => (ctrl ? p.goUp() : p.move(-p.pageSize(), sh)));
    case 'Home': return go(() => p.moveTo(0, sh));
    case 'End': return go(() => p.moveTo(p.view.length - 1, sh));
    case 'ArrowLeft':
      if (alt) return go(() => p.histGo(-1));
      if (lynx && !ctrl && !sh) return go(() => p.goUp());
      break;
    case 'ArrowRight':
      if (alt) return go(() => p.histGo(1));
      if (lynx && !ctrl && !sh) return go(() => lynxEnter(p));
      break;
    case 'Enter': return go(() => (alt && sh ? p.calcAll() : p.openCur()));
    case 'Backspace': return go(() => p.goUp());
    case 'Tab': return go(() => setActive(p.other));
    case ' ': return go(() => p.toggleCur(true));
    case 'Insert': return go(() => p.toggleCur(false));
    case 'Delete': return go(CMD.del);
    case 'Escape': return go(() => (p.qs ? p.quickReset() : p.filter ? p.clearFilter() : p.selectNone()));
    case 'F1': return go(alt ? () => driveMenu(panels.L) : CMD.help);
    case 'F2': return go(alt ? () => driveMenu(panels.R) : CMD.rename);
    case 'F3': return go(sh ? CMD.download : CMD.view);
    case 'F4': return go(sh ? CMD.newfile : CMD.edit);
    case 'F5': return go(alt ? CMD.pack : CMD.copy);
    case 'F6': return go(sh ? CMD.rename : CMD.move);
    case 'F7': return go(CMD.mkdir);
    case 'F8': return go(CMD.del);
    case 'F9': return go(alt ? CMD.unpack : CMD.chmod);
    default: break;
  }
  if (ctrl && !alt) {
    switch (k.toLowerCase()) {
      case 'a': return go(() => p.selectAll());
      case 'f': return go(CMD.filter);
      case 'd': return go(CMD.fav);
      case 'q': return go(CMD.qview);
      case 'm': return go(CMD.multirename);
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
document.addEventListener('mouseup', e => { if (e.button === 2) for (const p of Object.values(panels)) p.rdragEnd(); });
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
  updateRowH();
  addEventListener('resize', () => { clearTimeout(updateRowH.t); updateRowH.t = setTimeout(updateRowH, 150); });
  if (store.get('lang', null) == null && INFO.lang && INFO.lang !== LANG) setLang(INFO.lang);
  applyI18n();
  $('#ver').textContent = 'v' + INFO.version;
  $('#upd').addEventListener('click', () => run(() => cmdUpdate(false)));
  document.title = `${INFO.host} – Gabo Commander`;
  $('#host').textContent = `${INFO.user}@${INFO.host}${INFO.root ? ' (root)' : ''}`;
  $('#logout').hidden = !INFO.auth;
  buildMenubar();
  showHidden = store.get('hidden', false);
  lynx = store.get('lynx', false);
  leftSel = store.get('leftsel', false);
  $('[data-cmd=hidden]').classList.toggle('on', showHidden);
  panels.L = new Panel('L', $('#left'));
  panels.R = new Panel('R', $('#right'));
  setActive(panels[store.get('active', 'L')] || panels.L);
  await loadDrives();
  const start = async (p, def) => { if (!(await p.load(store.get('path.' + p.side, def)))) await p.load(def); };
  await Promise.all([start(panels.L, INFO.home), start(panels.R, INFO.win ? INFO.home : '/')]);
  lastFocusRefresh = Date.now();
  pollJobs();
  setInterval(() => { if (!document.hidden) loadDrives(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollSoon(); });
  checkUpdate(false);
  setInterval(() => checkUpdate(false), 3600 * 1000);
}

run(init);
