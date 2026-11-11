#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gabo Commander – two-panel web file manager / kétpaneles, böngészőből használható fájlkezelő.

Only the Python standard library is used (Python 3.8+), nothing to install.

    python3 server.py                        # http://0.0.0.0:28090
    python3 server.py --port 9000 --lang hu
    GC_PASSWORD=secret python3 server.py     # password login / jelszavas belépés
"""

import argparse
import collections
import ctypes
import errno
import getpass
import hashlib
import hmac
import http.cookies
import http.server
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import stat
import struct
import sys
import tarfile
import threading
import time
import traceback
import urllib.parse
import urllib.request
import zipfile

try:
    import grp
    import pwd
except ImportError:  # Windows – csak fejlesztéshez
    grp = pwd = None

HERE = os.path.dirname(os.path.abspath(__file__))


def _read_version():
    try:
        with open(os.path.join(HERE, 'VERSION'), encoding='utf-8') as f:
            return f.read().strip() or '0'
    except OSError:
        return '0'


VERSION = _read_version()
DEFAULT_PORT = 28090
DEFAULT_REPO = 'gabro89/gabo-commander'
IS_WIN = os.name == 'nt'
IS_ROOT = hasattr(os, 'geteuid') and os.geteuid() == 0
STATIC_DIR = os.path.join(HERE, 'static')
COPY_CHUNK = 8 * 1024 * 1024
MAX_TEXT = 5 * 1024 * 1024
POLICIES = ('ask', 'overwrite', 'skip', 'newer', 'rename')
HAS_SENDFILE = hasattr(os, 'sendfile') and sys.platform.startswith('linux')

CONFIG = {'password': '', 'password_hash': '', 'verbose': False, 'lang': 'en',
          'update_check': True, 'repo': DEFAULT_REPO}
SESSIONS = {}          # sha256(token) -> lejárat (unix idő)
SESSIONS_LOCK = threading.Lock()
SESSION_AGE = 30 * 24 * 3600

# ------------------------------------------------------------------ fordítások / translations

MSG = {
    'hu': {
        'missing_path': 'Hiányzó útvonal', 'not_dir': 'Nem mappa vagy nem létezik: {0}',
        'target_missing': 'A célmappa nem létezik: {0}', 'not_found': 'Nem található: {0}',
        'not_found_plain': 'Nem található', 'self_copy': 'Mappa nem másolható önmagába: {0}',
        'special_skipped': 'Speciális fájl kihagyva: {0}', 'dir_exists': 'Ugyanilyen nevű mappa létezik: {0}',
        'deleting_source': 'Forrás törlése…', 'internal': 'Belső hiba: {0}',
        'chown_unsupported': 'Tulajdonos váltás ezen a rendszeren nem támogatott',
        'unknown_user': 'Ismeretlen felhasználó: {0}', 'unknown_group': 'Ismeretlen csoport: {0}',
        'bad_length': 'Hibás Content-Length', 'too_large': 'Túl nagy kérés', 'bad_json': 'Hibás JSON',
        'bad_request': 'Érvénytelen kérés', 'login_required': 'Bejelentkezés szükséges',
        'unknown_endpoint': 'Ismeretlen végpont', 'wrong_password': 'Hibás jelszó', 'is_dir': 'Ez egy mappa',
        'text_too_big': 'A fájl túl nagy a szerkesztőhöz (max. 5 MB)', 'binary': 'Bináris fájl, nem szerkeszthető',
        'bad_name': 'Érvénytelen név', 'exists': 'Már létezik: {0}', 'bad_octal': 'Hibás oktális jog: {0}',
        'nothing_selected': 'Nincs kijelölt elem', 'unknown_policy': 'Ismeretlen ütközéskezelés: {0}',
        'items': '{0} elem', 'job_copy': 'Másolás', 'job_move': 'Áthelyezés', 'job_delete': 'Törlés',
        'no_such_job': 'Nincs ilyen feladat', 'length_required': 'Content-Length szükséges',
        'upload_interrupted': 'Megszakadt feltöltés',
        'too_many_logins': 'Túl sok sikertelen belépés. Próbáld újra {0} perc múlva.',
        'not_archive': 'Nem támogatott archívum: {0}', 'unsafe_path': 'Veszélyes útvonal kihagyva: {0}',
        'bad_format': 'Ismeretlen formátum: {0}', 'job_pack': 'Tömörítés', 'job_unpack': 'Kicsomagolás',
        'zip_errors': 'Ezeket nem sikerült beletenni:',
        'bad_name_x': 'Érvénytelen név: {0}', 'dup_target': 'Több elem kapná ugyanezt a nevet: {0}',
        'too_many': 'Túl sok elem egyszerre (max. {0})', 'encrypted': 'Jelszóval védett, nem nyitható meg: {0}',
        'job_extract': 'Kibontás', 'same_file': 'A forrás és a cél ugyanaz a fájl, kihagyva: {0}',
        'selfupdate_off': 'A felületről indított frissítés itt nem érhető el. A szerveren: sudo gabo-commander update',
        'running': 'Gabo Commander {0} fut:', 'user': 'Felhasználó: {0}',
        'no_password': 'Figyelem: nincs jelszó – csak megbízható belső hálózaton használd! (gabo-commander password)',
    },
    'en': {
        'missing_path': 'Missing path', 'not_dir': 'Not a folder or does not exist: {0}',
        'target_missing': 'The target folder does not exist: {0}', 'not_found': 'Not found: {0}',
        'not_found_plain': 'Not found', 'self_copy': 'A folder cannot be copied into itself: {0}',
        'special_skipped': 'Special file skipped: {0}', 'dir_exists': 'A folder with the same name exists: {0}',
        'deleting_source': 'Deleting source…', 'internal': 'Internal error: {0}',
        'chown_unsupported': 'Changing the owner is not supported on this system',
        'unknown_user': 'Unknown user: {0}', 'unknown_group': 'Unknown group: {0}',
        'bad_length': 'Invalid Content-Length', 'too_large': 'Request too large', 'bad_json': 'Invalid JSON',
        'bad_request': 'Invalid request', 'login_required': 'Sign-in required',
        'unknown_endpoint': 'Unknown endpoint', 'wrong_password': 'Wrong password', 'is_dir': 'This is a folder',
        'text_too_big': 'The file is too large for the editor (max. 5 MB)', 'binary': 'Binary file, cannot be edited',
        'bad_name': 'Invalid name', 'exists': 'Already exists: {0}', 'bad_octal': 'Invalid octal mode: {0}',
        'nothing_selected': 'Nothing selected', 'unknown_policy': 'Unknown conflict policy: {0}',
        'items': '{0} items', 'items1': '1 item', 'job_copy': 'Copy', 'job_move': 'Move', 'job_delete': 'Delete',
        'no_such_job': 'No such task', 'length_required': 'Content-Length required',
        'upload_interrupted': 'Upload interrupted',
        'too_many_logins': 'Too many failed sign-ins. Try again in {0} minutes.',
        'not_archive': 'Unsupported archive: {0}', 'unsafe_path': 'Unsafe path skipped: {0}',
        'bad_format': 'Unknown format: {0}', 'job_pack': 'Pack', 'job_unpack': 'Unpack',
        'zip_errors': 'These could not be added:',
        'bad_name_x': 'Invalid name: {0}', 'dup_target': 'Several items would get the same name: {0}',
        'too_many': 'Too many items at once (max. {0})', 'encrypted': 'Password protected, cannot be opened: {0}',
        'job_extract': 'Extract', 'same_file': 'Source and target are the same file, skipped: {0}',
        'selfupdate_off': 'Updating from the UI is not available here. On the server: sudo gabo-commander update',
        'running': 'Gabo Commander {0} is running:', 'user': 'User: {0}',
        'no_password': 'Warning: no password – use only on a trusted local network! (gabo-commander password)',
    },
}


def tr(lang, key, *args):
    d = MSG.get(lang) or MSG['en']
    s = d.get(key) or MSG['en'].get(key) or key
    return s.format(*args) if args else s


def items_text(lang, n):
    return tr(lang, 'items1') if n == 1 and 'items1' in MSG.get(lang, {}) else tr(lang, 'items', n)


class GCError(Exception):
    """Felhasználónak megjeleníthető hiba: fordítási kulcs + paraméterek."""

    def __init__(self, key, *args):
        super().__init__(key, *args)
        self.key, self.params = key, args

    def text(self, lang):
        return tr(lang, self.key, *self.params)


class Cancelled(Exception):
    pass


_ERRNO_HU = {
    'EACCES': 'Nincs jogosultság', 'EPERM': 'A művelet nem engedélyezett', 'ENOENT': 'Nem található',
    'EEXIST': 'Már létezik', 'ENOSPC': 'Betelt a lemez', 'ENOTEMPTY': 'A mappa nem üres',
    'EROFS': 'Csak olvasható fájlrendszer', 'EBUSY': 'Az erőforrás foglalt', 'EISDIR': 'Ez egy mappa',
    'ENOTDIR': 'Nem mappa', 'EIO': 'I/O hiba', 'ENAMETOOLONG': 'Túl hosszú név',
    'EXDEV': 'Eltérő fájlrendszer', 'EINVAL': 'Érvénytelen paraméter', 'EDQUOT': 'Elfogyott a kvóta',
}
ERRNO_HU = {getattr(errno, k): v for k, v in _ERRNO_HU.items() if hasattr(errno, k)}


def errtext(e, lang=None):
    lang = lang or CONFIG['lang']
    if isinstance(e, GCError):
        return e.text(lang)
    if isinstance(e, OSError):
        msg = (ERRNO_HU.get(e.errno) if lang == 'hu' else None) or e.strerror or str(e)
        return '%s: %s' % (e.filename, msg) if e.filename else msg
    return str(e)


def norm(p):
    if not p or not isinstance(p, str):
        raise GCError('missing_path')
    return os.path.abspath(os.path.expanduser(p))


# ------------------------------------------------------------------ létrehozás dátuma
# Linuxon az os.stat() nem adja vissza a születési időt, ezért a statx() rendszerhívást
# hívjuk ctypes-szal (glibc 2.28+, kernel 4.11+; ext4/btrfs/xfs támogatja).

_statx = None
if sys.platform.startswith('linux'):
    try:
        _libc = ctypes.CDLL(None, use_errno=True)
        _statx = _libc.statx
        _statx.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_uint, ctypes.c_void_p]
        _statx.restype = ctypes.c_int
    except (OSError, AttributeError):
        _statx = None
_tls = threading.local()
AT_FDCWD, AT_SYMLINK_NOFOLLOW, STATX_BTIME = -100, 0x100, 0x800


def birth_time(path, st):
    if _statx is not None:
        buf = getattr(_tls, 'buf', None)
        if buf is None:
            buf = _tls.buf = ctypes.create_string_buffer(256)
        if _statx(AT_FDCWD, os.fsencode(path), AT_SYMLINK_NOFOLLOW, STATX_BTIME, buf) == 0:
            if struct.unpack_from('=I', buf, 0)[0] & STATX_BTIME:
                sec, nsec = struct.unpack_from('=qI', buf, 80)
                return sec + nsec / 1e9
        return None
    bt = getattr(st, 'st_birthtime', None)
    if bt is not None:
        return bt
    return st.st_ctime if IS_WIN else None


# ------------------------------------------------------------------ felhasználó/csoport nevek

_uid_cache, _gid_cache = {}, {}


def uname(uid):
    if pwd is None:
        return ''
    n = _uid_cache.get(uid)
    if n is None:
        try:
            n = pwd.getpwuid(uid).pw_name
        except KeyError:
            n = str(uid)
        _uid_cache[uid] = n
    return n


def gname(gid):
    if grp is None:
        return ''
    n = _gid_cache.get(gid)
    if n is None:
        try:
            n = grp.getgrgid(gid).gr_name
        except KeyError:
            n = str(gid)
        _gid_cache[gid] = n
    return n


# ------------------------------------------------------------------ listázás, meghajtók

def usage(path):
    try:
        u = shutil.disk_usage(path)
        return u.total, u.free
    except OSError:
        return 0, 0


def list_dir(path):
    if not os.path.isdir(path):
        raise GCError('not_dir', path)
    entries = []
    with os.scandir(path) as it:
        for de in it:
            try:
                st = de.stat(follow_symlinks=False)
            except OSError:
                continue
            is_link = stat.S_ISLNK(st.st_mode)
            is_dir = stat.S_ISDIR(st.st_mode)
            size = st.st_size
            e = {'n': de.name, 'l': is_link}
            if is_link:
                try:
                    e['t'] = os.readlink(de.path)
                except OSError:
                    pass
                try:
                    tst = os.stat(de.path)
                    is_dir = stat.S_ISDIR(tst.st_mode)
                    size = tst.st_size
                except OSError:
                    e['broken'] = True
            e.update({
                'd': is_dir,
                's': 0 if is_dir else size,
                'm': st.st_mtime,
                'b': birth_time(de.path, st),
                'p': stat.filemode(st.st_mode),
                'o': uname(st.st_uid),
                'g': gname(st.st_gid),
            })
            entries.append(e)
    parent = os.path.dirname(path)
    total, free = usage(path)
    return {'path': path, 'parent': parent if parent != path else None,
            'entries': entries, 'total': total, 'free': free}


NET_FS = {'nfs', 'nfs4', 'cifs', 'smb3', 'smbfs', '9p', 'ceph', 'glusterfs', 'davfs',
          'fuse.sshfs', 'fuse.rclone', 'fuse.davfs2', 'fuse.s3fs'}
LOCAL_FS = {'zfs', 'btrfs', 'fuseblk', 'fuse.mergerfs', 'fuse.ntfs-3g', 'fuse.exfat'}
SKIP_PREFIX = ('/snap/', '/var/snap/', '/var/lib/docker/', '/var/lib/containers/',
               '/run/', '/sys/', '/proc/', '/dev/', '/boot/')


def _unescape(s):
    return re.sub(r'\\([0-7]{3})', lambda m: chr(int(m.group(1), 8)), s)


def _block_kind(dev):
    """USB/cserélhető eszköz felismerése a /sys alapján."""
    try:
        base = os.path.basename(os.path.realpath(dev))
        sys_path = os.path.realpath('/sys/class/block/' + base)
        if '/usb' in sys_path:
            return 'usb'
        for p in (sys_path, os.path.dirname(sys_path)):
            f = os.path.join(p, 'removable')
            if os.path.exists(f):
                with open(f) as fh:
                    return 'usb' if fh.read().strip() == '1' else 'hdd'
    except OSError:
        pass
    return 'hdd'


def drives():
    out = []
    if IS_WIN:
        if hasattr(os, 'listdrives'):
            letters = os.listdrives()
        else:
            letters = ['%s:\\' % c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' if os.path.exists('%s:\\' % c)]
        for d in letters:
            total, free = usage(d)
            out.append({'path': d, 'label': d.rstrip('\\'), 'kind': 'hdd', 'dev': d, 'fs': '',
                        'total': total, 'free': free})
    else:
        seen = set()
        try:
            with open('/proc/self/mounts', encoding='utf-8', errors='replace') as f:
                lines = f.read().splitlines()
        except OSError:
            lines = ['rootfs / rootfs']
        for line in lines:
            parts = line.split()
            if len(parts) < 3:
                continue
            dev, mp, fs = parts[0], _unescape(parts[1]), parts[2]
            if mp in seen:
                continue
            if mp == '/':
                kind = 'root'
            elif mp == '/boot' or mp.startswith(SKIP_PREFIX):
                continue
            elif fs in NET_FS:
                kind = 'net'
            elif dev.startswith('/dev/') and fs != 'squashfs':
                kind = _block_kind(dev)
            elif fs in LOCAL_FS:
                kind = 'hdd'
            else:
                continue
            seen.add(mp)
            total, free = usage(mp)
            out.append({'path': mp, 'label': '/' if mp == '/' else os.path.basename(mp), 'kind': kind,
                        'dev': dev, 'fs': fs, 'total': total, 'free': free})
        out.sort(key=lambda d: (d['path'] != '/', d['path']))
    home = os.path.expanduser('~')
    if os.path.isdir(home):
        total, free = usage(home)
        out.insert(1 if out else 0, {'path': home, 'label': '~', 'kind': 'home', 'dev': '', 'fs': '',
                                     'total': total, 'free': free})
    return out


def dir_size(path):
    total = files = dirs = 0
    stack = [path]
    while stack:
        p = stack.pop()
        try:
            with os.scandir(p) as it:
                for de in it:
                    try:
                        if de.is_dir(follow_symlinks=False):
                            dirs += 1
                            stack.append(de.path)
                        else:
                            total += de.stat(follow_symlinks=False).st_size
                            files += 1
                    except OSError:
                        pass
        except OSError:
            pass
    return {'size': total, 'files': files, 'dirs': dirs}


# ------------------------------------------------------------------ háttérfeladatok (másolás, törlés)

JOBS = collections.OrderedDict()
JOBS_LOCK = threading.Lock()


class Job:
    def __init__(self, kind, title, lang):
        self.id = secrets.token_hex(6)
        self.lang = lang
        self.kind = kind
        self.title = title
        self.state = 'scan'
        self.total_bytes = self.done_bytes = 0
        self.total_files = self.done_files = 0
        self.cur_total = self.cur_done = 0
        self.current = ''
        self.errors = []
        self.error_count = 0
        self.started = time.time()
        self.run_started = None
        self.finished = None
        self.cancel = False
        self.dismissed = False
        self.ask = None
        self.answer = None
        self.answer_ev = threading.Event()
        self.samples = collections.deque(maxlen=64)
        with JOBS_LOCK:
            JOBS[self.id] = self

    def t(self, key, *args):
        return tr(self.lang, key, *args)

    def fail(self, e):
        self.error(errtext(e, self.lang))

    def error(self, msg):
        self.error_count += 1
        if len(self.errors) < 300:
            self.errors.append(msg)

    def check(self):
        if self.cancel:
            raise Cancelled()

    def tick(self, force=False):
        now = time.time()
        if force or not self.samples or now - self.samples[-1][0] >= 0.25:
            self.samples.append((now, self.done_bytes, self.done_files))

    def set_running(self):
        self.state = 'run'
        self.run_started = time.time()
        self.samples.clear()
        self.tick(True)

    def rates(self, now):
        """Pillanatnyi sebesség az utolsó ~5 másodperc alapján (bájt/s, fájl/s)."""
        if self.run_started is None:
            return 0.0, 0.0
        base = None
        for s in self.samples:
            if now - s[0] <= 5.0:
                base = s
                break
        if base is None:
            base = self.samples[-1] if self.samples else (self.run_started, 0, 0)
        if now - base[0] < 1.0:
            base = (self.run_started, 0, 0)
        dt = now - base[0]
        if dt <= 0:
            return 0.0, 0.0
        return (self.done_bytes - base[1]) / dt, (self.done_files - base[2]) / dt

    def to_json(self):
        now = time.time()
        bps, fps = self.rates(now) if self.finished is None else (0.0, 0.0)
        eta = None
        if self.state == 'run':
            if self.total_bytes > 0 and bps > 0:
                eta = max(0, self.total_bytes - self.done_bytes) / bps
            elif self.total_bytes == 0 and fps > 0:
                eta = max(0, self.total_files - self.done_files) / fps
        end = self.finished or now
        return {
            'id': self.id, 'kind': self.kind, 'title': self.title, 'state': self.state,
            'total_bytes': self.total_bytes, 'done_bytes': self.done_bytes,
            'total_files': self.total_files, 'done_files': self.done_files,
            'cur_total': self.cur_total, 'cur_done': self.cur_done, 'current': self.current,
            'speed': bps, 'fspeed': fps, 'eta': eta, 'elapsed': end - (self.run_started or self.started),
            'errors': self.errors[-50:], 'error_count': self.error_count, 'ask': self.ask,
            'finished': self.finished is not None,
        }


def start_job(job, fn, *args):
    def target():
        try:
            fn(job, *args)
        except Cancelled:
            pass
        except (GCError, OSError) as e:
            job.fail(e)
        except Exception as e:  # pragma: no cover
            traceback.print_exc()
            job.error(job.t('internal', repr(e)))
        finally:
            if job.cancel:
                job.state = 'cancelled'
            elif job.error_count:
                job.state = 'error'
            else:
                job.state = 'done'
            job.current = ''
            job.finished = time.time()
    threading.Thread(target=target, daemon=True, name='job-' + job.id).start()


def unique_name(path):
    d, name = os.path.split(path)
    base, ext = os.path.splitext(name)
    i = 2
    while True:
        cand = os.path.join(d, '%s (%d)%s' % (base, i, ext))
        if not os.path.lexists(cand):
            return cand
        i += 1


def is_inside(child, parent):
    child, parent = os.path.realpath(child), os.path.realpath(parent)
    return child == parent or child.startswith(parent.rstrip(os.sep) + os.sep)


def same_path(a, b):
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def same_inode(a, b):
    """Ugyanaz a fájl-e (más útvonalon is: symlinkelt mappa, hardlink, bind mount)."""
    try:
        sa, sb = os.lstat(a), os.lstat(b)
    except OSError:
        return False
    return (sa.st_dev, sa.st_ino) == (sb.st_dev, sb.st_ino) and sa.st_ino != 0


def copy_file(job, src, dst, size):
    """Ideiglenes fájlba ír, és csak a végén cseréli le a célt: megszakításkor, betelt lemeznél
    a korábbi célfájl épen marad."""
    job.cur_total, job.cur_done = size, 0
    start_bytes = job.done_bytes
    tmp = dst + '.gcpart'
    ok = False
    try:
        with open(src, 'rb') as fi, open(tmp, 'wb') as fo:
            done = 0
            use_sendfile = HAS_SENDFILE
            if use_sendfile:
                try:
                    while True:
                        job.check()
                        n = os.sendfile(fo.fileno(), fi.fileno(), done, COPY_CHUNK)
                        if n == 0:
                            break
                        done += n
                        job.done_bytes += n
                        job.cur_done = done
                        job.tick()
                except OSError as e:
                    if done or e.errno not in (errno.EINVAL, errno.ENOSYS, getattr(errno, 'EOPNOTSUPP', -1)):
                        raise
                    use_sendfile = False
            if not use_sendfile:
                buf = bytearray(4 << 20)
                mv = memoryview(buf)
                while True:
                    job.check()
                    n = fi.readinto(buf)
                    if not n:
                        break
                    fo.write(mv[:n])
                    done += n
                    job.done_bytes += n
                    job.cur_done = done
                    job.tick()
        try:
            shutil.copystat(src, tmp)
        except OSError:
            pass
        os.replace(tmp, dst)
        ok = True
    finally:
        if not ok:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            job.done_bytes = start_bytes + size


def copy_job(job, sources, dest, move, policy):
    sources = [norm(s) for s in sources]
    dest = norm(dest)
    if os.path.isdir(dest):
        plan = [(s, os.path.join(dest, os.path.basename(s))) for s in sources]
    elif len(sources) == 1:
        if not os.path.isdir(os.path.dirname(dest)):
            raise GCError('target_missing', os.path.dirname(dest))
        plan = [(sources[0], dest)]          # másolás/áthelyezés új néven
    else:
        os.makedirs(dest)
        plan = [(s, os.path.join(dest, os.path.basename(s))) for s in sources]

    rest = []
    for s, d in plan:
        job.check()
        if not os.path.lexists(s):
            job.error(job.t('not_found', s))
            continue
        if same_path(s, d):
            if move:
                continue                       # önmagára mozgatás: nincs teendő
            d = unique_name(d)                 # ugyanabba a mappába másolás: „név (2)”
        if os.path.isdir(s) and not os.path.islink(s) and is_inside(d, s):
            job.error(job.t('self_copy', s))
            continue
        if move and not os.path.lexists(d):
            try:
                os.rename(s, d)                # azonos fájlrendszeren azonnali
                job.total_files += 1
                job.done_files += 1
                continue
            except OSError as e:
                if e.errno != errno.EXDEV:
                    job.fail(e)
                    continue
        rest.append((s, d))

    # --- felmérés: mit kell másolni, mekkora
    ops = []   # [típus, forrás, cél, méret, sikeres]
    for s, d in rest:
        stack = [(s, d)]
        while stack:
            job.check()
            ss, dd = stack.pop()
            try:
                st = os.lstat(ss)
            except OSError as e:
                job.fail(e)
                continue
            if stat.S_ISLNK(st.st_mode):
                ops.append(['link', ss, dd, 0, False])
                job.total_files += 1
            elif stat.S_ISDIR(st.st_mode):
                ops.append(['dir', ss, dd, 0, False])
                try:
                    names = sorted(os.listdir(ss), reverse=True)
                except OSError as e:
                    job.fail(e)
                    continue
                for n in names:
                    stack.append((os.path.join(ss, n), os.path.join(dd, n)))
            elif stat.S_ISREG(st.st_mode):
                ops.append(['file', ss, dd, st.st_size, False])
                job.total_files += 1
                job.total_bytes += st.st_size
            else:
                job.error(job.t('special_skipped', ss))

    conflicts = [op for op in ops if op[0] != 'dir' and os.path.lexists(op[2])]
    if conflicts and policy == 'ask':
        job.state = 'ask'
        job.ask = {'count': len(conflicts), 'sample': [os.path.basename(c[2]) for c in conflicts[:5]]}
        job.answer_ev.wait()
        job.ask = None
        policy = job.answer
        if job.cancel or policy not in POLICIES[1:]:
            job.cancel = True
            raise Cancelled()

    job.set_running()
    for op in ops:
        kind, s, d, size = op[0], op[1], op[2], op[3]
        if job.cancel:
            break
        job.current = s
        before = job.done_bytes
        try:
            if kind == 'dir':
                if not os.path.isdir(d):
                    os.mkdir(d)
                op[4] = True
                continue
            if os.path.lexists(d):
                if same_inode(s, d):            # ugyanaz a fájl más úton: felülírva elveszne (áthelyezésnél törölve is)
                    raise GCError('same_file', d)
                if policy == 'skip' or (policy == 'newer' and os.lstat(d).st_mtime >= os.lstat(s).st_mtime):
                    job.done_bytes += size
                    job.done_files += 1
                    job.tick()
                    continue
                if policy == 'rename':
                    d = unique_name(d)
                elif os.path.isdir(d) and not os.path.islink(d):
                    raise GCError('dir_exists', d)
                elif os.path.islink(d) or kind == 'link':
                    os.unlink(d)
            if kind == 'link':
                os.symlink(os.readlink(s), d)
            else:
                copy_file(job, s, d, size)
            if IS_ROOT:   # rootként a tulajdonost is megőrizzük (mint a cp -a)
                try:
                    st = os.lstat(s)
                    os.lchown(d, st.st_uid, st.st_gid)
                except OSError:
                    pass
            op[4] = True
            job.done_files += 1
        except Cancelled:
            break
        except (OSError, GCError) as e:
            job.fail(e)
            job.done_bytes = before + size
            job.done_files += 1
        job.tick()

    for op in reversed(ops):       # mappák dátumainak visszaállítása
        if op[0] == 'dir' and op[4]:
            try:
                shutil.copystat(op[1], op[2])
            except OSError:
                pass

    if move and not job.cancel:    # áthelyezésnél a sikeresen átmásolt forrás törlése
        job.current = job.t('deleting_source')
        for op in reversed(ops):
            if not op[4]:
                continue
            try:
                if op[0] == 'dir':
                    os.rmdir(op[1])
                else:
                    os.unlink(op[1])
            except OSError as e:
                if op[0] != 'dir':
                    job.fail(e)


def delete_job(job, paths):
    items = []   # (mappa-e, útvonal) – alulról felfelé sorrendben
    for p in map(norm, paths):
        job.check()
        if os.path.isdir(p) and not os.path.islink(p):
            for root, dirs, files in os.walk(p, topdown=False, onerror=job.fail):
                job.check()
                for f in files:
                    items.append((False, os.path.join(root, f)))
                for d in dirs:
                    full = os.path.join(root, d)
                    if os.path.islink(full):
                        items.append((False, full))
                items.append((True, root))
                job.total_files = len(items)
        elif os.path.lexists(p):
            items.append((False, p))
        else:
            job.error(job.t('not_found', p))
        job.total_files = len(items)
    job.set_running()
    for is_dir, path in items:
        job.check()
        job.current = path
        try:
            if is_dir:
                os.rmdir(path)
            else:
                os.unlink(path)
        except OSError as e:
            job.fail(e)
        job.done_files += 1
        job.tick()


# ------------------------------------------------------------------ jogosultságok

def do_chmod(paths, mode, recursive, owner, group, lang):
    uid = gid = -1
    if (owner or group) and not hasattr(os, 'chown'):
        raise GCError('chown_unsupported')
    if owner:
        try:
            uid = int(owner) if owner.isdigit() else pwd.getpwnam(owner).pw_uid
        except KeyError:
            raise GCError('unknown_user', owner)
    if group:
        try:
            gid = int(group) if group.isdigit() else grp.getgrnam(group).gr_gid
        except KeyError:
            raise GCError('unknown_group', group)
    errors = []
    count = [0]

    def one(p):
        try:
            st = os.lstat(p)
            if not stat.S_ISLNK(st.st_mode) and mode is not None:
                m = mode & 0o777
                if recursive and stat.S_ISDIR(st.st_mode):
                    m |= (m & 0o444) >> 2          # mappák x jogot kapnak, ahol r van
                os.chmod(p, (stat.S_IMODE(st.st_mode) & ~0o777) | m)
            if uid != -1 or gid != -1:
                os.chown(p, uid, gid, follow_symlinks=False)
            count[0] += 1
        except OSError as e:
            errors.append(errtext(e, lang))

    for p in map(norm, paths):
        one(p)
        if recursive and os.path.isdir(p) and not os.path.islink(p):
            for root, dirs, files in os.walk(p):
                for n in dirs + files:
                    one(os.path.join(root, n))
    return {'count': count[0], 'errors': errors[:100], 'error_count': len(errors)}


# ------------------------------------------------------------------ állapot (munkamenetek, kedvencek) / state

def state_dir():
    """systemd StateDirectory (/var/lib/gabo-commander), különben ~/.local/state/gabo-commander."""
    d = (os.environ.get('STATE_DIRECTORY') or '').split(os.pathsep)[0]   # systemd több mappát ':'-tal választ el
    if not d and os.path.isdir('/var/lib/gabo-commander') and os.access('/var/lib/gabo-commander', os.W_OK):
        d = '/var/lib/gabo-commander'
    return d or os.path.join(os.path.expanduser('~'), '.local', 'state', 'gabo-commander')


def load_state(name, default):
    try:
        with open(os.path.join(state_dir(), name), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_state(name, data):
    d = state_dir()
    try:
        os.makedirs(d, mode=0o700, exist_ok=True)
        tmp = os.path.join(d, '.%s.%s.tmp' % (name, secrets.token_hex(4)))
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        os.replace(tmp, os.path.join(d, name))
    except OSError as e:
        sys.stderr.write('cannot save %s: %s\n' % (name, e))


def _pw_fingerprint():
    """Ha a jelszó megváltozik, a régi munkamenetek érvénytelenné válnak."""
    return hashlib.sha256((CONFIG['password_hash'] or CONFIG['password']).encode('utf-8')).hexdigest()[:16]


def _tok_hash(tok):
    return hashlib.sha256(tok.encode('utf-8')).hexdigest()


def sessions_load():
    data = load_state('sessions.json', {})
    now = time.time()
    if isinstance(data, dict) and data.get('pw') == _pw_fingerprint():
        for h, exp in (data.get('s') or {}).items():
            if isinstance(exp, (int, float)) and exp > now:
                SESSIONS[h] = exp


def _sessions_save():
    now = time.time()
    for h in [h for h, exp in SESSIONS.items() if exp <= now]:
        del SESSIONS[h]
    save_state('sessions.json', {'pw': _pw_fingerprint(), 's': SESSIONS})


def session_new():
    tok = secrets.token_urlsafe(32)
    with SESSIONS_LOCK:
        SESSIONS[_tok_hash(tok)] = time.time() + SESSION_AGE
        _sessions_save()
    return tok


def session_valid(tok):
    exp = SESSIONS.get(_tok_hash(tok))
    return bool(exp and exp > time.time())


def session_drop(tok):
    with SESSIONS_LOCK:
        if SESSIONS.pop(_tok_hash(tok), None) is not None:
            _sessions_save()


# sikertelen belépések IP-címenként: 15 percen belül 8 hiba után 15 perc tiltás
FAILS = {}
FAILS_LOCK = threading.Lock()
FAIL_WINDOW, FAIL_MAX = 15 * 60, 8


def login_blocked(ip):
    """Hány másodpercig tiltott még (0 = nem tiltott)."""
    now = time.time()
    with FAILS_LOCK:
        lst = [t for t in FAILS.get(ip, []) if now - t < FAIL_WINDOW]
        FAILS[ip] = lst
        if len(lst) >= FAIL_MAX:
            return int(FAIL_WINDOW - (now - lst[0])) + 1
    return 0


def login_failed(ip):
    with FAILS_LOCK:
        FAILS.setdefault(ip, []).append(time.time())
        if len(FAILS) > 10000:    # ne nőjön a végtelenségig
            FAILS.clear()


def login_ok(ip):
    with FAILS_LOCK:
        FAILS.pop(ip, None)


# ------------------------------------------------------------------ archívumok / archives

PACK_FORMATS = {'zip': None, 'tar.gz': 'w:gz', 'tar.xz': 'w:xz', 'tar.bz2': 'w:bz2', 'tar': 'w'}
ARCHIVE_EXTS = ('.tar.gz', '.tgz', '.tar.xz', '.txz', '.tar.bz2', '.tbz2', '.tbz', '.tar', '.zip')
NO_DEFLATE = {'zip', 'gz', 'tgz', 'xz', 'bz2', '7z', 'rar', 'zst', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic',
              'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'iso', 'deb', 'rpm'}


def archive_base(name):
    low = name.lower()
    for ext in ARCHIVE_EXTS:
        if low.endswith(ext) and len(name) > len(ext):
            return name[:-len(ext)]
    return os.path.splitext(name)[0] or name


def walk_items(sources, job=None):
    """(teljes útvonal, archívumbeli név, lstat) minden elemre, mappák is; a hibákat a feladatba írja."""
    out = []
    for src in sources:
        stack = [(src, os.path.basename(src.rstrip('/\\')) or 'root')]
        while stack:
            if job:
                job.check()
            path, arc = stack.pop()
            try:
                st = os.lstat(path)
            except OSError as e:
                if job:
                    job.fail(e)
                continue
            out.append((path, arc, st))
            if stat.S_ISDIR(st.st_mode):
                try:
                    names = sorted(os.listdir(path), reverse=True)
                except OSError as e:
                    if job:
                        job.fail(e)
                    continue
                stack.extend((os.path.join(path, n), arc + '/' + n) for n in names)
            elif stat.S_ISREG(st.st_mode) and job:
                job.total_files += 1
                job.total_bytes += st.st_size
    return out


def zip_items(zf, items, job=None, errors=None):
    """Elemek írása egy nyitott ZipFile-ba (lehet nem kereshető adatfolyam is, pl. a letöltés)."""
    for path, arc, st in items:
        if job:
            job.check()
            job.current = path
        try:
            if stat.S_ISLNK(st.st_mode):      # a fájlra mutató linket a tartalmával tesszük bele
                try:
                    st = os.stat(path)
                except OSError:
                    continue
                if not stat.S_ISREG(st.st_mode):
                    continue
            if stat.S_ISDIR(st.st_mode):
                zf.write(path, arc)
                continue
            if not stat.S_ISREG(st.st_mode):
                continue
            zi = zipfile.ZipInfo.from_file(path, arc, strict_timestamps=False)
            ext = arc.rsplit('.', 1)[-1].lower() if '.' in arc else ''
            zi.compress_type = zipfile.ZIP_STORED if ext in NO_DEFLATE else zipfile.ZIP_DEFLATED
            with open(path, 'rb') as fi:
                with zf.open(zi, 'w', force_zip64=st.st_size >= zipfile.ZIP64_LIMIT) as fo:
                    while True:
                        if job:
                            job.check()
                        b = fi.read(1 << 20)
                        if not b:
                            break
                        fo.write(b)
                        if job:
                            job.done_bytes += len(b)
                            job.tick()
            if job:
                job.done_files += 1
        except (OSError, ValueError) as e:
            if job:
                job.fail(e)
            if errors is not None:
                errors.append('%s: %s' % (arc, getattr(e, 'strerror', None) or e))


class _JobReader:
    """Fájl olvasása közben frissíti a feladat előrehaladását és figyeli a megszakítást."""

    def __init__(self, f, job):
        self.f, self.job = f, job

    def read(self, n=-1):
        self.job.check()
        b = self.f.read(n)
        self.job.done_bytes += len(b)
        self.job.tick()
        return b


def pack_job(job, sources, dest, fmt):
    sources = [norm(x) for x in sources]
    dest = norm(dest)
    if os.path.lexists(dest):
        raise GCError('exists', dest)
    items = walk_items(sources, job)
    tmp = dest + '.gcpart'
    job.set_running()
    ok = False
    try:
        if fmt == 'zip':
            with zipfile.ZipFile(tmp, 'w', allowZip64=True, strict_timestamps=False) as zf:
                zip_items(zf, items, job)
        else:
            with tarfile.open(tmp, PACK_FORMATS[fmt], format=tarfile.PAX_FORMAT) as tf:
                for path, arc, st in items:
                    job.check()
                    job.current = path
                    try:
                        ti = tf.gettarinfo(path, arc)
                        if ti is None:
                            continue
                        if ti.isreg():
                            with open(path, 'rb') as f:
                                tf.addfile(ti, _JobReader(f, job))
                            job.done_files += 1
                        else:
                            tf.addfile(ti)
                    except OSError as e:
                        job.fail(e)
        if job.cancel:
            raise Cancelled()
        os.replace(tmp, dest)
        ok = True
    finally:
        if not ok:
            try:
                os.unlink(tmp)
            except OSError:
                pass


class _ProgressFile:
    """A nyers archívumfájl olvasási pozíciója adja az előrehaladást (tömörített tarnál is)."""

    def __init__(self, f, job, base):
        self.f, self.job, self.base = f, job, base

    def read(self, n=-1):
        self.job.check()
        b = self.f.read(n)
        self.job.done_bytes = self.base + self.f.tell()
        self.job.tick()
        return b

    def seek(self, *a):
        return self.f.seek(*a)

    def tell(self):
        return self.f.tell()

    def readable(self):
        return True

    def seekable(self):
        return True

    def close(self):
        pass


def clean_parts(name):
    """Az archívumbeli név részei; a kezdő '/' és a meghajtóbetű elhagyva (mint a GNU tarnál).
    None, ha '..' van benne vagy üres – ezek kiléphetnének a célmappából."""
    name = re.sub(r'^[A-Za-z]:', '', name.replace('\\', '/'))
    parts = [x for x in name.split('/') if x not in ('', '.')]
    if not parts or '..' in parts:
        return None
    return parts


def safe_member(root, name, pick=None):
    """Az archívumbeli név célútvonala, vagy None, ha veszélyes / nincs a kiválasztottak között.
    A pick(részek) a kiválasztott elemeknél a célmappához viszonyított részeket adja (különben None)."""
    parts = clean_parts(name)
    if parts is not None and pick is not None:
        parts = pick(parts)
    return os.path.join(root, *parts) if parts else None


def zip_name(info):
    """Zip-beli név: UTF-8 jelző nélkül a cp437-ként olvasott név gyakran valójában UTF-8."""
    if info.flag_bits & 0x800:
        return info.filename
    try:
        return info.filename.encode('cp437').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return info.filename


def _inside(path, root):
    path, root = os.path.normpath(path), os.path.normpath(root)
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def _prepare_target(job, target, policy, is_dir):
    """True, ha írhatunk a célba (a létezőt a szabály szerint kezeli)."""
    if not os.path.lexists(target):
        return True
    if is_dir:
        if os.path.isdir(target) and not os.path.islink(target):
            return True
        raise GCError('exists', target)
    if policy == 'skip':
        return False
    if os.path.isdir(target) and not os.path.islink(target):
        raise GCError('dir_exists', target)
    os.unlink(target)
    return True


def _copy_stream(job, fi, target):
    with open(target, 'wb') as fo:
        while True:
            job.check()
            b = fi.read(1 << 20)
            if not b:
                break
            fo.write(b)


def unpack_zip(job, arc, root, policy, pick=None):
    with zipfile.ZipFile(arc) as zf:
        todo = []
        for info in zf.infolist():
            name = zip_name(info)
            if clean_parts(name) is None:
                job.error(job.t('unsafe_path', name))
                continue
            target = safe_member(root, name, pick)
            if target is not None:
                todo.append((info, target))
        base = job.done_bytes
        job.total_bytes += sum(i.file_size for i, _ in todo)
        job.total_files += sum(1 for i, _ in todo if not i.is_dir())
        for info, target in todo:
            job.check()
            job.current = target
            try:
                if info.is_dir():
                    if _prepare_target(job, target, policy, True):
                        os.makedirs(target, exist_ok=True)
                    continue
                os.makedirs(os.path.dirname(target), exist_ok=True)
                if _prepare_target(job, target, policy, False):
                    with zf.open(info) as fi:
                        _copy_stream(job, _JobReader(fi, job), target)
                    mode = (info.external_attr >> 16) & 0o777
                    if mode and not IS_WIN:
                        os.chmod(target, mode | 0o200)
                    t = time.mktime(info.date_time + (0, 0, -1))
                    os.utime(target, (t, t))
                job.done_files += 1
            except (OSError, GCError) as e:
                job.fail(e)
            except RuntimeError:                  # jelszóval védett tag
                job.error(job.t('encrypted', info.filename))
            base += info.file_size
            job.done_bytes = base
            job.tick()


def unpack_tar(job, arc, root, policy, pick=None):
    size = os.path.getsize(arc)
    base = job.done_bytes
    job.total_bytes += size
    dirs = []
    with open(arc, 'rb') as raw:
        with tarfile.open(fileobj=_ProgressFile(raw, job, base), mode='r:*') as tf:
            for m in tf:
                job.check()
                if clean_parts(m.name) is None:
                    job.error(job.t('unsafe_path', m.name))
                    continue
                target = safe_member(root, m.name, pick)
                if target is None:
                    continue
                job.current = target
                try:
                    if m.isdir():
                        if _prepare_target(job, target, policy, True):
                            os.makedirs(target, exist_ok=True)
                            dirs.append((target, m))
                        continue
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    if m.isreg():
                        job.total_files += 1
                        if _prepare_target(job, target, policy, False):
                            _copy_stream(job, tf.extractfile(m), target)
                            if not IS_WIN:
                                os.chmod(target, (m.mode & 0o777) | 0o200)
                            os.utime(target, (m.mtime, m.mtime))
                        job.done_files += 1
                    elif m.issym():
                        link = os.path.join(os.path.dirname(target), m.linkname)
                        if os.path.isabs(m.linkname) or not _inside(link, root):
                            job.error(job.t('unsafe_path', '%s -> %s' % (m.name, m.linkname)))
                        elif _prepare_target(job, target, policy, False):
                            os.symlink(m.linkname, target)
                    elif m.islnk():
                        if clean_parts(m.linkname) is None:
                            job.error(job.t('unsafe_path', '%s -> %s' % (m.name, m.linkname)))
                        elif _prepare_target(job, target, policy, False):
                            src = safe_member(root, m.linkname, pick)
                            try:
                                os.link(src, target)
                            except (OSError, TypeError):   # a cél nincs kibontva: a tartalmát írjuk ki
                                _copy_stream(job, tf.extractfile(m), target)
                    # eszközfájlokat, FIFO-kat nem hozunk létre
                except (OSError, GCError) as e:
                    job.fail(e)
    for target, m in reversed(dirs):    # a mappák jogai és dátuma a végén (különben nem írhatnánk beléjük)
        try:
            if not IS_WIN:
                os.chmod(target, (m.mode & 0o777) | 0o700)
            os.utime(target, (m.mtime, m.mtime))
        except OSError:
            pass
    job.done_bytes = base + size


def unpack_job(job, archives, dest, subdir, policy):
    dest = norm(dest)
    jobs = []
    for a in map(norm, archives):
        if zipfile.is_zipfile(a):
            kind = 'zip'
        elif tarfile.is_tarfile(a):
            kind = 'tar'
        else:
            job.error(job.t('not_archive', a))
            continue
        root = os.path.join(dest, archive_base(os.path.basename(a))) if subdir else dest
        jobs.append((kind, a, root))
    job.set_running()
    for kind, a, root in jobs:
        job.check()
        os.makedirs(root, exist_ok=True)
        (unpack_zip if kind == 'zip' else unpack_tar)(job, a, root, policy)


# ------------------------------------------------------------------ archívum böngészése / browsing archives
# Az archívumon belüli útvonal „virtuális”: /home/x/a.zip/mappa/fajl.txt. A panel ugyanúgy kezeli,
# mint egy mappát; a tartalomjegyzéket a memóriában tartjuk, amíg az archívum nem változik.

def arc_kind(path):
    try:
        if zipfile.is_zipfile(path):
            return 'zip'
        if tarfile.is_tarfile(path):
            return 'tar'
    except (OSError, EOFError, tarfile.TarError):
        pass
    return None


def split_arc(path):
    """(archívum, belső '/'-útvonal, fajta), ha az útvonal egy archívumba mutat, különben None."""
    p, rest = path, []
    while not os.path.exists(p):
        head, tail = os.path.split(p)
        if head == p or not tail:
            return None
        rest.append(tail)
        p = head
    if not os.path.isfile(p):
        return None
    kind = arc_kind(p)
    return (p, '/'.join(reversed(rest)), kind) if kind else None


def _zip_time(info):
    try:
        return time.mktime(info.date_time + (0, 0, -1))
    except (OverflowError, ValueError):
        return 0


class ArcIndex:
    """Egy archívum tartalomjegyzéke mappánként: dirs[belső mappa][név] = [mappa?, méret, idő, jogok, link?, cél, tulaj, csoport]."""

    def __init__(self, path, kind):
        self.path, self.kind = path, kind
        self.dirs = {'': {}}
        self.files = {}                       # belső fájlútvonal -> eredeti tagnév
        self.dsize = collections.Counter()    # belső mappa -> a benne lévő fájlok összmérete
        if kind == 'zip':
            with zipfile.ZipFile(path) as zf:
                for info in zf.infolist():
                    mode = info.external_attr >> 16
                    is_dir = info.is_dir()
                    if not stat.S_IFMT(mode):
                        mode |= (stat.S_IFDIR | 0o755) if is_dir else (stat.S_IFREG | 0o644)
                    self._add(zip_name(info), info.filename, is_dir, info.file_size, _zip_time(info),
                              stat.filemode(mode), stat.S_ISLNK(mode), '', '', '')
        else:
            with tarfile.open(path, 'r:*') as tf:
                for m in tf:
                    ftype = stat.S_IFDIR if m.isdir() else stat.S_IFLNK if m.issym() else stat.S_IFREG
                    self._add(m.name, m.name, m.isdir(), m.size if m.isreg() else 0, m.mtime,
                              stat.filemode(ftype | (m.mode & 0o7777)), m.issym(),
                              m.linkname if (m.issym() or m.islnk()) else '', m.uname, m.gname)

    def _bump(self, d, delta):
        while True:
            self.dsize[d] += delta
            if not d:
                return
            d = d.rpartition('/')[0]

    def _add(self, name, orig, is_dir, size, mtime, perm, is_link, link, owner, group):
        parts = clean_parts(name)
        if parts is None:
            return
        d = ''
        for comp in parts[:-1]:               # a hiányzó szülőmappák (a zipben gyakran nincsenek külön)
            sub = d + '/' + comp if d else comp
            if sub not in self.dirs:
                self.dirs[sub] = {}
                self.dirs[d][comp] = [True, 0, mtime, 'drwxr-xr-x', False, '', '', '']
                self.files.pop(sub, None)
            d = sub
        leaf = parts[-1]
        full = d + '/' + leaf if d else leaf
        kids = self.dirs[d]
        if is_dir:
            self.dirs.setdefault(full, {})
            kids[leaf] = [True, 0, mtime, perm, False, '', owner, group]
            return
        if full in self.dirs:
            return
        old = kids.get(leaf)
        if old and not old[0]:                # ugyanaz a név többször (tar): az utolsó számít
            self._bump(d, -old[1])
        kids[leaf] = [False, size, mtime, perm, is_link, link, owner, group]
        self.files[full] = orig
        self._bump(d, size)

    def entries(self, inner):
        kids = self.dirs.get(inner)
        if kids is None:
            raise GCError('not_dir' if inner in self.files else 'not_found', arc_vpath(self.path, inner))
        out = []
        for n, (d, s, m, p, lnk, tgt, o, g) in kids.items():
            e = {'n': n, 'l': lnk, 'd': d, 's': s, 'm': m, 'b': None, 'p': p, 'o': o, 'g': g}
            if tgt:
                e['t'] = tgt
            if d:
                e['ds'] = self.dsize.get(inner + '/' + n if inner else n, 0)
            out.append(e)
        return out


ARC_CACHE = collections.OrderedDict()
ARC_LOCK = threading.Lock()


def arc_index(path, kind):
    st = os.stat(path)
    key = (path, st.st_mtime_ns, st.st_size)
    with ARC_LOCK:
        idx = ARC_CACHE.get(key)
        if idx is not None:
            ARC_CACHE.move_to_end(key)
            return idx
    try:
        idx = ArcIndex(path, kind)
    except (zipfile.BadZipFile, tarfile.TarError, EOFError, ValueError) as e:
        raise GCError('not_archive', '%s (%s)' % (path, e))
    with ARC_LOCK:
        for k in [k for k in ARC_CACHE if k[0] == path]:
            del ARC_CACHE[k]
        ARC_CACHE[key] = idx
        while len(ARC_CACHE) > 4:
            ARC_CACHE.popitem(last=False)
    return idx


def arc_vpath(arc, inner):
    return arc + os.sep + inner.replace('/', os.sep) if inner else arc


def list_arc(arc, inner, kind):
    idx = arc_index(arc, kind)
    inner = '/'.join(clean_parts(inner) or [])
    entries = idx.entries(inner)
    parent = arc_vpath(arc, inner.rpartition('/')[0]) if inner else os.path.dirname(arc)
    total, free = usage(os.path.dirname(arc))
    return {'path': arc_vpath(arc, inner), 'parent': parent, 'entries': entries,
            'total': total, 'free': free, 'archive': arc, 'inner': inner}


class _Member:
    """Archívumbeli fájl olvasásra; a close() az archívumot is lezárja."""

    def __init__(self, f, owner, size):
        self.f, self.owner, self.size = f, owner, size

    def read(self, n=-1):
        return self.f.read(n)

    def close(self):
        try:
            self.f.close()
        finally:
            self.owner.close()


def arc_open(arc, inner, kind):
    """Egy archívumbeli fájl megnyitása. A size None, ha előre nem tudható (tar hardlink)."""
    idx = arc_index(arc, kind)
    inner = '/'.join(clean_parts(inner) or [])
    if inner in idx.dirs:
        raise GCError('is_dir')
    orig = idx.files.get(inner)
    if orig is None:
        raise GCError('not_found', arc_vpath(arc, inner))
    if kind == 'zip':
        zf = zipfile.ZipFile(arc)
        try:
            info = zf.getinfo(orig)
            return _Member(zf.open(info), zf, info.file_size)
        except RuntimeError:
            zf.close()
            raise GCError('encrypted', inner)
        except BaseException:
            zf.close()
            raise
    tf = tarfile.open(arc, 'r:*')
    try:
        for m in tf:
            if m.name == orig and (m.isreg() or m.islnk() or m.issym()):
                f = tf.extractfile(m)
                if f is not None:
                    return _Member(f, tf, m.size if m.isreg() else None)
        raise GCError('not_found', arc_vpath(arc, inner))
    except BaseException:
        tf.close()
        raise


def read_start(path, limit):
    """Egy fájl első limit bájtja és a teljes mérete – archívumon belül is."""
    if not os.path.lexists(path):
        s = split_arc(path)
        if s:
            f = arc_open(*s)
            try:
                data = f.read(limit)
            finally:
                f.close()
            return data, f.size if f.size is not None else len(data)
    if os.path.isdir(path):
        raise GCError('is_dir')
    with open(path, 'rb') as f:
        return f.read(limit), os.fstat(f.fileno()).st_size


def extract_job(job, arc, inner, kind, names, dest, policy):
    """Kiválasztott elemek kibontása egy archívum belső mappájából (a mappák tartalmával együtt)."""
    if not os.path.isdir(dest):
        raise GCError('target_missing', dest)
    pre = clean_parts(inner) or []
    sel, k = set(names), len(pre)

    def pick(parts):
        return parts[k:] if len(parts) > k and parts[:k] == pre and parts[k] in sel else None

    job.set_running()
    (unpack_zip if kind == 'zip' else unpack_tar)(job, arc, dest, policy, pick)


# ------------------------------------------------------------------ csoportos átnevezés / multi-rename

MAX_RENAME = 50000


def valid_name(name):
    return (isinstance(name, str) and name not in ('', '.', '..') and '/' not in name and '\0' not in name
            and not (IS_WIN and ('\\' in name or ':' in name)) and len(os.fsencode(name)) <= 255)


def same_entry(a, b):
    """Ugyanaz a bejegyzés-e (kis/nagybetűre nem érzékeny fájlrendszeren a csak betűméretben eltérő név)."""
    try:
        sa, sb = os.lstat(a), os.lstat(b)
    except OSError:
        return False
    return (sa.st_dev, sa.st_ino) == (sb.st_dev, sb.st_ino) and os.path.basename(a).lower() == os.path.basename(b).lower()


def multi_rename(base, pairs, lang=None):
    """Egy mappán belüli átnevezések; láncok (a→b, b→c) és körök (a→b, b→a) is működnek.
    Előbb mindent ellenőriz, és ha bármi gond van, semmit nem nevez át."""
    if not os.path.isdir(base):
        raise GCError('not_dir', base)
    if len(pairs) > MAX_RENAME:
        raise GCError('too_many', MAX_RENAME)
    todo = collections.OrderedDict()
    for p in pairs:
        if not isinstance(p, (list, tuple)) or len(p) != 2:
            raise GCError('bad_json')
        src, dst = p
        for n in (src, dst):
            if not valid_name(n):
                raise GCError('bad_name_x', str(n))
        if src in todo:
            raise GCError('dup_target', src)
        if src != dst:
            todo[src] = dst
    seen = set()
    for src, dst in todo.items():
        if not os.path.lexists(os.path.join(base, src)):
            raise GCError('not_found', src)
        key = dst.lower() if IS_WIN else dst
        if key in seen:
            raise GCError('dup_target', dst)
        seen.add(key)
        full = os.path.join(base, dst)
        if dst not in todo and os.path.lexists(full) and not same_entry(os.path.join(base, src), full):
            raise GCError('exists', dst)

    done, errors, orig = [], [], {}
    pending = todo
    while pending:
        progress = False
        for src, dst in list(pending.items()):
            if dst in pending:                       # a cél még foglalt: egy másik elem vár átnevezésre
                continue
            del pending[src]
            progress = True
            a, b = os.path.join(base, src), os.path.join(base, dst)
            first = orig.pop(src, src)
            try:
                if os.path.lexists(b) and not same_entry(a, b):   # az os.rename felülírná!
                    raise GCError('exists', dst)
                os.rename(a, b)
                done.append([first, dst])
            except (OSError, GCError) as e:
                errors.append('%s → %s: %s' % (first, dst, errtext(e, lang)))
                if first != src:                     # ideiglenes névről vissza az eredetire, ha lehet
                    try:
                        if not os.path.lexists(os.path.join(base, first)):
                            os.rename(a, os.path.join(base, first))
                    except OSError:
                        pass
        if not progress:                             # kör: az egyiket ideiglenes névre tesszük
            src, dst = next(iter(pending.items()))
            tmp = '.gc-rename-%s' % secrets.token_hex(4)
            try:
                os.rename(os.path.join(base, src), os.path.join(base, tmp))
                orig[tmp] = orig.pop(src, src)
                pending[tmp] = dst
            except OSError as e:
                errors.append('%s → %s: %s' % (src, dst, errtext(e, lang)))
            del pending[src]
    return {'done': done, 'errors': errors}


# ------------------------------------------------------------------ HTTP

STATIC_TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png'}
VIEWABLE = ('image/', 'video/', 'audio/')
for _ext, _t in (('.mkv', 'video/x-matroska'), ('.webm', 'video/webm'), ('.flac', 'audio/flac'),
                 ('.webp', 'image/webp'), ('.avif', 'image/avif'), ('.m4a', 'audio/mp4')):
    mimetypes.add_type(_t, _ext)


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'GaboCommander/' + VERSION
    sys_version = ''
    protocol_version = 'HTTP/1.1'
    # ennyi ideig várunk egy elakadt kapcsolatra (pl. szüneteltetett videó a gyorsnézetben), aztán lezárjuk –
    # különben a szál és a nyitott fájl örökre megmaradna (a törölt fájl helye sem szabadulna fel)
    timeout = 120

    def log_message(self, fmt, *args):
        if CONFIG['verbose']:
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    # --- segédek
    def send_json(self, obj, status=200, headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def fail(self, msg, status=400, extra=None):
        obj = {'error': msg}
        obj.update(extra or {})
        self.send_json(obj, status)

    def t(self, key, *args):
        return tr(self.lang, key, *args)

    def read_json(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            raise GCError('bad_length')
        if n > 20 * 1024 * 1024:
            self.close_connection = True
            raise GCError('too_large')
        raw = self.rfile.read(n) if n else b''
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode('utf-8'))
        except ValueError:
            raise GCError('bad_json')
        return data if isinstance(data, dict) else {}

    def is_authed(self):
        if not auth_enabled():
            return True
        c = http.cookies.SimpleCookie()
        try:
            c.load(self.headers.get('Cookie', ''))
        except http.cookies.CookieError:
            return False
        m = c.get('gc_session')
        return bool(m and session_valid(m.value))

    def client_ip(self):
        ip = self.client_address[0]
        fwd = self.headers.get('X-Forwarded-For')
        if fwd and ip in ('127.0.0.1', '::1'):     # fordított proxy mögött a valódi kliens címe
            ip = fwd.split(',')[-1].strip() or ip
        return ip

    def do_GET(self):
        self.handle_req('GET')

    def do_POST(self):
        self.handle_req('POST')

    def do_PUT(self):
        self.handle_req('PUT')

    def handle_req(self, method):
        url = urllib.parse.urlsplit(self.path)
        path = url.path
        self.qm = urllib.parse.parse_qs(url.query, keep_blank_values=True)
        q = {k: v[-1] for k, v in self.qm.items()}
        self.body = {}
        lang = self.headers.get('X-GC-Lang', '')
        self.lang = lang if lang in MSG else CONFIG['lang']
        try:
            if method == 'POST':
                self.body = self.read_json()
            if method == 'GET' and not path.startswith('/api/'):
                return self.serve_static(path)
            if method != 'GET' and self.headers.get('X-GC') != '1':   # egyszerű CSRF-védelem
                self.close_connection = True
                return self.fail(self.t('bad_request'), 403)
            if path == '/api/login' and method == 'POST':
                return self.api_login()
            if not self.is_authed():
                if method == 'PUT':
                    self.close_connection = True
                return self.fail(self.t('login_required'), 401, {'lang': CONFIG['lang']})
            fn = getattr(self, 'api_%s_%s' % (method.lower(), path[5:].replace('/', '_')), None)
            if fn is None:
                if method == 'PUT':
                    self.close_connection = True
                return self.fail(self.t('unknown_endpoint'), 404)
            fn(q)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.timeout):
            self.close_connection = True
        except GCError as e:
            self.fail(e.text(self.lang))
        except OSError as e:
            self.fail(errtext(e, self.lang))
        except Exception as e:  # pragma: no cover
            traceback.print_exc()
            self.fail(self.t('internal', repr(e)), 500)

    def serve_static(self, path):
        name = path.lstrip('/') or 'index.html'
        fp = os.path.join(STATIC_DIR, name)
        if '/' in name or '\\' in name or name.startswith('.') or not os.path.isfile(fp):
            return self.fail(self.t('not_found_plain'), 404)
        with open(fp, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', STATIC_TYPES.get(os.path.splitext(name)[1], 'application/octet-stream'))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.end_headers()
        self.wfile.write(data)

    # --- belépés
    def api_login(self):
        if not auth_enabled():
            return self.send_json({'ok': True})
        ip = self.client_ip()
        wait = login_blocked(ip)
        if wait:
            return self.fail(self.t('too_many_logins', (wait + 59) // 60), 429)
        if not check_password(str(self.body.get('password', ''))):
            login_failed(ip)
            time.sleep(1.0)
            return self.fail(self.t('wrong_password'), 403)
        login_ok(ip)
        tok = session_new()
        self.send_json({'ok': True}, headers={
            'Set-Cookie': 'gc_session=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000' % tok})

    def api_post_logout(self, q):
        c = http.cookies.SimpleCookie()
        try:
            c.load(self.headers.get('Cookie', ''))
            m = c.get('gc_session')
            if m:
                session_drop(m.value)
        except http.cookies.CookieError:
            pass
        self.send_json({'ok': True}, headers={'Set-Cookie': 'gc_session=; Path=/; Max-Age=0'})

    # --- lekérdezések
    def api_get_info(self, q):
        try:
            user = getpass.getuser()
        except Exception:
            user = ''
        self.send_json({'sep': os.sep, 'home': os.path.expanduser('~'), 'user': user,
                        'host': socket.gethostname(), 'auth': auth_enabled(),
                        'win': IS_WIN, 'root': IS_ROOT, 'version': VERSION, 'lang': CONFIG['lang'],
                        'repo': CONFIG['repo'], 'selfupdate': self_update_ok()})

    def api_get_update(self, q):
        self.send_json(check_update(q.get('force') == '1'))

    def api_get_selfupdate(self, q):
        self.send_json(self_update_status())

    def api_post_selfupdate(self, q):
        if not self_update_ok():
            raise GCError('selfupdate_off')
        with open(UPD_REQUEST, 'w') as f:
            f.write('%d\n' % time.time())
        self.send_json({'ok': True, 'now': time.time()})

    def api_get_list(self, q):
        path = norm(q.get('path') or '~')
        if not os.path.isdir(path):
            s = split_arc(path)
            if s:
                return self.send_json(list_arc(*s))
        self.send_json(list_dir(path))

    def api_get_drives(self, q):
        self.send_json({'drives': drives()})

    def api_get_dirsize(self, q):
        self.send_json(dir_size(norm(q.get('path'))))

    def api_get_jobs(self, q):
        now = time.time()
        with JOBS_LOCK:
            for jid, j in list(JOBS.items()):
                if j.finished and (j.dismissed or now - j.finished > (900 if j.error_count else 60)):
                    del JOBS[jid]
            out = [j.to_json() for j in JOBS.values() if not j.dismissed]
        self.send_json({'jobs': out})

    def api_get_raw(self, q):
        path = norm(q.get('path'))
        download = q.get('dl') == '1'
        if not os.path.lexists(path):
            s = split_arc(path)
            if s:
                return self.send_member(path, s, download)
        if os.path.isdir(path):
            raise GCError('is_dir')
        f = open(path, 'rb')
        try:
            size = os.fstat(f.fileno()).st_size
            ctype = mimetypes.guess_type(path)[0] or ''
            extra = {}
            if download:
                ctype = ctype or 'application/octet-stream'
            elif ctype.startswith(VIEWABLE) or ctype == 'application/pdf':
                if ctype == 'image/svg+xml':
                    extra['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'"
            else:
                head = f.read(8192)
                f.seek(0)
                if b'\0' in head:
                    ctype, download = 'application/octet-stream', True
                else:
                    ctype = 'text/plain; charset=utf-8'   # a HTML-t is forrásként mutatjuk (biztonság)
            start, end, status = 0, size - 1, 200
            rng = self.headers.get('Range')
            if rng and rng.startswith('bytes=') and size > 0:
                a, _, b = rng[6:].split(',')[0].strip().partition('-')
                try:
                    if a == '':
                        start = max(0, size - int(b))
                    else:
                        start = int(a)
                        end = min(int(b), size - 1) if b else size - 1
                    status = 206
                except ValueError:
                    start, end = 0, size - 1
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header('Content-Range', 'bytes */%d' % size)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
            length = max(0, end - start + 1)
            self.send_response(status)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(length))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Disposition', "%s; filename*=UTF-8''%s" % (
                'attachment' if download else 'inline', urllib.parse.quote(os.path.basename(path))))
            if status == 206:
                self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
            for k, v in extra.items():
                self.send_header(k, v)
            self.end_headers()
            if length:
                try:
                    self.connection.sendfile(f, start, length)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    self.close_connection = True
        finally:
            f.close()

    def send_member(self, path, s, download):
        """Archívumbeli fájl küldése (nézet, gyorsnézet, letöltés); tartományt nem támogat."""
        f = arc_open(*s)
        try:
            ctype = mimetypes.guess_type(path)[0] or ''
            head = f.read(8192)
            extra = {}
            if download:
                ctype = ctype or 'application/octet-stream'
            elif ctype.startswith(VIEWABLE) or ctype == 'application/pdf':
                if ctype == 'image/svg+xml':
                    extra['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'"
            elif b'\0' in head:
                ctype, download = 'application/octet-stream', True
            else:
                ctype = 'text/plain; charset=utf-8'   # a HTML-t is forrásként mutatjuk (biztonság)
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            if f.size is not None:
                self.send_header('Content-Length', str(f.size))
            else:
                self.send_header('Connection', 'close')
                self.close_connection = True
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Disposition', "%s; filename*=UTF-8''%s" % (
                'attachment' if download else 'inline', urllib.parse.quote(os.path.basename(path))))
            for k, v in extra.items():
                self.send_header(k, v)
            self.end_headers()
            try:
                b = head
                while b:
                    self.wfile.write(b)
                    b = f.read(1 << 20)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                self.close_connection = True
        finally:
            f.close()

    def api_get_text(self, q):
        path = norm(q.get('path'))
        if q.get('head') == '1':       # gyorsnézet: csak az eleje
            return self.text_head(path)
        data, size = read_start(path, MAX_TEXT + 1)
        if size > MAX_TEXT or len(data) > MAX_TEXT:
            raise GCError('text_too_big')
        if b'\0' in data[:8192]:
            raise GCError('binary')
        try:
            text, enc = data.decode('utf-8'), 'utf-8'
        except UnicodeDecodeError:
            text, enc = data.decode('cp1250', errors='replace'), 'cp1250'
        self.send_json({'text': text, 'enc': enc, 'crlf': b'\r\n' in data, 'size': len(data)})

    def text_head(self, path, limit=256 * 1024):
        data, size = read_start(path, limit)
        if b'\0' in data[:8192]:
            raise GCError('binary')
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError as e:
            if e.start >= len(data) - 3 and len(data) == limit:   # csak a vágás vitt ketté egy karaktert
                text = data[:e.start].decode('utf-8', errors='replace')
            else:
                text = data.decode('cp1250', errors='replace')
        self.send_json({'text': text, 'size': size, 'truncated': size > len(data)})

    # --- kedvencek
    def api_get_bookmarks(self, q):
        items = load_state('bookmarks.json', [])
        self.send_json({'items': items if isinstance(items, list) else []})

    def api_post_bookmarks(self, q):
        items = self.body.get('items')
        if not isinstance(items, list):
            raise GCError('bad_json')
        clean = [str(x) for x in items if isinstance(x, str) and x][:200]
        save_state('bookmarks.json', clean)
        self.send_json({'items': clean})

    # --- mappák letöltése zipként (folyamatos küldés, nem kell ideiglenes fájl)
    def api_get_zip(self, q):
        base = norm(q.get('dir'))
        names = [n for n in self.qm.get('n', []) if n and n not in ('.', '..') and '/' not in n and not (IS_WIN and '\\' in n)]
        if not names:
            raise GCError('nothing_selected')
        sources = [os.path.join(base, n) for n in names]
        for src in sources:
            if not os.path.lexists(src):
                raise GCError('not_found', src)
        fname = (names[0] if len(names) == 1 else (os.path.basename(base.rstrip('/\\')) or 'files')) + '.zip'
        self.send_response(200)
        self.send_header('Content-Type', 'application/zip')
        self.send_header('Content-Disposition', "attachment; filename*=UTF-8''%s" % urllib.parse.quote(fname))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.close_connection = True
        out = _StreamOut(self.wfile)
        errors = []
        try:
            with zipfile.ZipFile(out, 'w', allowZip64=True, strict_timestamps=False) as zf:
                zip_items(zf, walk_items(sources), errors=errors)
                if errors:
                    zf.writestr('_errors.txt', '\n'.join([self.t('zip_errors')] + errors) + '\n')
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    # --- tömörítés / kicsomagolás
    def api_post_pack(self, q):
        b = self.body
        sources = b.get('sources')
        if not isinstance(sources, list) or not sources:
            raise GCError('nothing_selected')
        fmt = b.get('format') or 'zip'
        if fmt not in PACK_FORMATS:
            raise GCError('bad_format', str(fmt))
        dest = norm(b.get('dest'))
        if os.path.lexists(dest):
            raise GCError('exists', dest)
        job = Job('pack', '%s: %s' % (self.t('job_pack'), dest), self.lang)
        start_job(job, pack_job, sources, dest, fmt)
        self.send_json({'id': job.id})

    def api_post_unpack(self, q):
        b = self.body
        archives = b.get('archives')
        if not isinstance(archives, list) or not archives:
            raise GCError('nothing_selected')
        dest = norm(b.get('dest'))
        policy = 'skip' if b.get('policy') == 'skip' else 'overwrite'
        what = os.path.basename(str(archives[0])) if len(archives) == 1 else items_text(self.lang, len(archives))
        job = Job('unpack', '%s: %s → %s' % (self.t('job_unpack'), what, dest), self.lang)
        start_job(job, unpack_job, archives, dest, bool(b.get('subdir')), policy)
        self.send_json({'id': job.id})

    def api_post_extract(self, q):
        b = self.body
        path = norm(b.get('path'))
        s = split_arc(path)
        if not s:
            raise GCError('not_archive', path)
        names = [n for n in (b.get('names') or []) if valid_name(n)]
        if not names:
            raise GCError('nothing_selected')
        dest = norm(b.get('dest'))
        policy = 'skip' if b.get('policy') == 'skip' else 'overwrite'
        what = names[0] if len(names) == 1 else items_text(self.lang, len(names))
        job = Job('unpack', '%s: %s → %s' % (self.t('job_extract'), what, dest), self.lang)
        start_job(job, extract_job, s[0], s[1], s[2], names, dest, policy)
        self.send_json({'id': job.id})

    # --- műveletek
    def api_post_multirename(self, q):
        b = self.body
        pairs = b.get('pairs')
        if not isinstance(pairs, list):
            raise GCError('bad_json')
        self.send_json(multi_rename(norm(b.get('dir')), pairs, self.lang))

    def api_post_text(self, q):
        b = self.body
        path = norm(b.get('path'))
        text = str(b.get('text', ''))
        if b.get('crlf'):
            text = text.replace('\r\n', '\n').replace('\n', '\r\n')
        enc = b.get('enc') if b.get('enc') in ('utf-8', 'cp1250') else 'utf-8'
        data = text.encode(enc, errors='replace')
        real = os.path.realpath(path)          # symlinknél a célfájlt írjuk, a linket meghagyjuk
        tmp = real + '.gcpart'
        try:                                   # ideiglenes fájlba, aztán csere: betelt lemeznél sem marad csonka fájl
            st = os.stat(real)
            with open(tmp, 'wb') as f:
                f.write(data)
            os.chmod(tmp, stat.S_IMODE(st.st_mode))
            if IS_ROOT:
                os.chown(tmp, st.st_uid, st.st_gid)
            if st.st_nlink > 1:                # hardlinknél a csere szétválasztaná: helyben írunk
                raise OSError(errno.EMLINK, 'hardlink')
            os.replace(tmp, real)
        except OSError:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            with open(real, 'wb') as f:        # pl. a mappa nem írható, csak a fájl: a régi módon
                f.write(data)
        self.send_json({'ok': True})

    def api_post_mkdir(self, q):
        b = self.body
        path = norm(b.get('path'))
        if b.get('parents'):
            os.makedirs(path, exist_ok=bool(b.get('exist_ok')))
        else:
            os.mkdir(path)
        self.send_json({'ok': True, 'path': path})

    def api_post_mkfile(self, q):
        path = norm(self.body.get('path'))
        open(path, 'x').close()
        self.send_json({'ok': True, 'path': path})

    def api_post_rename(self, q):
        b = self.body
        path = norm(b.get('path'))
        name = str(b.get('name') or '').strip()
        if not name or name in ('.', '..') or '/' in name or (IS_WIN and '\\' in name):
            raise GCError('bad_name')
        new = os.path.join(os.path.dirname(path), name)
        if os.path.lexists(new) and not same_path(new, path) and not same_entry(path, new):   # kép.JPG → kép.jpg USB-n, SMB-n is
            raise GCError('exists', name)
        os.rename(path, new)
        self.send_json({'ok': True, 'path': new})

    def api_post_chmod(self, q):
        b = self.body
        mode = b.get('mode')
        if mode not in (None, ''):
            try:
                mode = int(str(mode), 8)
            except ValueError:
                raise GCError('bad_octal', str(mode))
        else:
            mode = None
        self.send_json(do_chmod(b.get('paths') or [], mode, bool(b.get('recursive')),
                                str(b.get('owner') or '').strip(), str(b.get('group') or '').strip(), self.lang))

    def api_post_copy(self, q):
        b = self.body
        sources = b.get('sources')
        if not isinstance(sources, list) or not sources:
            raise GCError('nothing_selected')
        dest = norm(b.get('dest'))
        move = bool(b.get('move'))
        policy = b.get('policy') or 'ask'
        if policy not in POLICIES:
            raise GCError('unknown_policy', str(policy))
        what = os.path.basename(str(sources[0]).rstrip('/\\')) if len(sources) == 1 else items_text(self.lang, len(sources))
        job = Job('move' if move else 'copy', '%s: %s → %s' % (self.t('job_move' if move else 'job_copy'), what, dest), self.lang)
        start_job(job, copy_job, sources, dest, move, policy)
        self.send_json({'id': job.id})

    def api_post_delete(self, q):
        paths = self.body.get('paths')
        if not isinstance(paths, list) or not paths:
            raise GCError('nothing_selected')
        what = os.path.basename(str(paths[0]).rstrip('/\\')) if len(paths) == 1 else items_text(self.lang, len(paths))
        job = Job('delete', '%s: %s' % (self.t('job_delete'), what), self.lang)
        start_job(job, delete_job, paths)
        self.send_json({'id': job.id})

    def _job(self):
        with JOBS_LOCK:
            j = JOBS.get(str(self.body.get('id')))
        if not j:
            raise GCError('no_such_job')
        return j

    def api_post_jobs_cancel(self, q):
        j = self._job()
        j.cancel = True
        j.answer = 'cancel'
        j.answer_ev.set()
        self.send_json({'ok': True})

    def api_post_jobs_answer(self, q):
        j = self._job()
        j.answer = self.body.get('policy')
        j.answer_ev.set()
        self.send_json({'ok': True})

    def api_post_jobs_dismiss(self, q):
        self._job().dismissed = True
        self.send_json({'ok': True})

    def api_put_upload(self, q):
        try:
            length = int(self.headers.get('Content-Length', ''))
        except ValueError:
            self.close_connection = True
            raise GCError('length_required')
        dest = norm(q.get('path'))
        policy = q.get('policy', 'overwrite')
        tmp = None
        try:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if os.path.lexists(dest):
                if policy == 'skip':
                    remaining = length
                    while remaining > 0:
                        chunk = self.rfile.read(min(1 << 20, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                    return self.send_json({'ok': True, 'skipped': True})
                if policy == 'rename':
                    dest = unique_name(dest)
                elif os.path.isdir(dest) and not os.path.islink(dest):
                    raise GCError('dir_exists', dest)
            tmp = dest + '.gcpart'
            with open(tmp, 'wb') as f:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        raise GCError('upload_interrupted')
                    f.write(chunk)
                    remaining -= len(chunk)
            os.replace(tmp, dest)
            tmp = None
            mt = q.get('mtime')
            if mt:
                try:
                    t = float(mt) / 1000.0
                    os.utime(dest, (t, t))
                except (ValueError, OSError):
                    pass
        except BaseException:
            self.close_connection = True
            raise
        finally:
            if tmp:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
        self.send_json({'ok': True, 'path': dest})


# ------------------------------------------------------------------ jelszó / password

PBKDF2_ITER = 240000


def auth_enabled():
    return bool(CONFIG['password'] or CONFIG['password_hash'])


def hash_password(pw):
    """pbkdf2_sha256:<iter>:<salt hex>:<hash hex> – csak hex és kettőspont, így biztonságosan mehet env fájlba."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, PBKDF2_ITER)
    return 'pbkdf2_sha256:%d:%s:%s' % (PBKDF2_ITER, salt.hex(), dk.hex())


def check_password(pw):
    if CONFIG['password_hash']:
        try:
            algo, it, salt, want = CONFIG['password_hash'].split(':')
            if algo != 'pbkdf2_sha256':
                return False
            dk = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), bytes.fromhex(salt), int(it))
            return hmac.compare_digest(dk.hex(), want.lower())
        except ValueError:
            return False
    return hmac.compare_digest(pw.encode('utf-8'), CONFIG['password'].encode('utf-8'))


# ------------------------------------------------------------------ frissítés-ellenőrzés / update check

UPDATE = {'at': 0.0, 'latest': None}
UPDATE_LOCK = threading.Lock()


def vtuple(v):
    return tuple(int(x) for x in re.findall(r'\d+', v or '')[:4])


def _fetch_latest():
    """A legújabb kiadott verzió a GitHubról. Elsőként a release API (nincs mögötte CDN-gyorsítótár, és
    akkor jelez, amikor a release oldal már kész); ha az nem megy (pl. API-korlát), a main ág VERSION fájlja."""
    hdr = {'User-Agent': 'GaboCommander/' + VERSION, 'Cache-Control': 'no-cache'}
    errors = []
    try:
        rq = urllib.request.Request('https://api.github.com/repos/%s/releases/latest' % CONFIG['repo'],
                                    headers=dict(hdr, Accept='application/vnd.github+json'))
        with urllib.request.urlopen(rq, timeout=6) as resp:
            latest = str(json.loads(resp.read(1 << 20).decode('utf-8')).get('tag_name') or '').lstrip('vV')
        if re.fullmatch(r'\d+(\.\d+){0,3}', latest):
            return latest
        errors.append('release tag: %r' % latest)
    except Exception as e:
        errors.append(repr(e))
    try:                      # a raw.githubusercontent.com 5 percig gyorsítótáraz: a paraméter ezt kerüli meg
        rq = urllib.request.Request('https://raw.githubusercontent.com/%s/main/VERSION?t=%d' % (CONFIG['repo'], time.time()),
                                    headers=hdr)
        with urllib.request.urlopen(rq, timeout=6) as resp:
            latest = resp.read(64).decode('utf-8', 'replace').strip()
        if re.fullmatch(r'\d+(\.\d+){0,3}', latest):
            return latest
        errors.append('VERSION: %r' % latest)
    except Exception as e:
        errors.append(repr(e))
    if CONFIG['verbose']:
        sys.stderr.write('update check failed: %s\n' % '; '.join(errors))
    return None


def check_update(force=False):
    """Óránként néz rá a GitHubra (hiba esetén 15 percenként); force: a menüből kért ellenőrzés, mindig friss."""
    if not CONFIG['update_check'] or not CONFIG['repo']:
        return {'enabled': False, 'current': VERSION}
    with UPDATE_LOCK:
        age = time.time() - UPDATE['at']
        if force and age > 5 or age > (3600 if UPDATE['latest'] else 900):
            latest = _fetch_latest()
            if latest:
                UPDATE['latest'] = latest
            UPDATE['at'] = time.time()
        latest = UPDATE['latest']
    return {'enabled': True, 'current': VERSION, 'latest': latest, 'repo': CONFIG['repo'],
            'newer': bool(latest and vtuple(latest) > vtuple(VERSION))}


# Frissítés a felületről: a kérésfájlt a gabo-commander-update.path systemd egység figyeli, és rootként
# lefuttatja a "gabo-commander update"-et (install.sh hozza létre). Az app maga nem kap root jogot.
UPD_REQUEST = '/var/lib/gabo-commander/update-request'
UPD_LOG = '/var/log/gabo-commander-update.log'
UPD_PATH_UNIT = '/etc/systemd/system/gabo-commander-update.path'


def self_update_ok():
    return (not IS_WIN and bool(CONFIG['update_check']) and os.path.isfile(UPD_PATH_UNIT)
            and os.access(os.path.dirname(UPD_REQUEST), os.W_OK))


def self_update_status():
    log, at = '', 0.0
    try:
        with open(UPD_LOG, 'rb') as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(0, f.tell() - 16384))
            log = f.read().decode('utf-8', 'replace')
            at = os.fstat(f.fileno()).st_mtime
    except OSError:
        pass
    m = re.search(r'^== exit (\d+)\s*$', log, re.M)
    return {'version': VERSION, 'pending': os.path.exists(UPD_REQUEST), 'log': log, 'log_at': at,
            'done': bool(m), 'code': int(m.group(1)) if m else None, 'now': time.time()}


class _StreamOut:
    """Csak írható kimenet a ZipFile-nak: a socketbe ír, a pozíciót számolja (seek nincs)."""

    def __init__(self, w):
        self.w, self.n = w, 0

    def write(self, b):
        self.w.write(b)
        self.n += len(b)
        return len(b)

    def tell(self):
        return self.n

    def flush(self):
        pass


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return sorted(ips) or ['127.0.0.1']


def main():
    for stream in (sys.stdout, sys.stderr):   # nem UTF-8-as konzolon se álljon le az ékezetek miatt
        try:
            stream.reconfigure(errors='replace')
        except (AttributeError, ValueError):
            pass
    env = os.environ.get
    ap = argparse.ArgumentParser(description='Gabo Commander %s – two-panel web file manager' % VERSION)
    ap.add_argument('--host', default=env('GC_HOST') or '0.0.0.0', help='listen address (GC_HOST, default: 0.0.0.0)')
    ap.add_argument('--port', type=int, default=int(env('GC_PORT') or DEFAULT_PORT),
                    help='port (GC_PORT, default: %d)' % DEFAULT_PORT)
    ap.add_argument('--password', default=env('GC_PASSWORD', ''), help='login password (GC_PASSWORD)')
    ap.add_argument('--lang', choices=sorted(MSG), default=env('GC_LANG') if env('GC_LANG') in MSG else 'en',
                    help='default UI language (GC_LANG)')
    ap.add_argument('--no-update-check', action='store_true', help='do not check GitHub for new versions')
    ap.add_argument('--hash-password', action='store_true', help='read a password from stdin, print its hash and exit')
    ap.add_argument('--version', action='version', version=VERSION)
    ap.add_argument('-v', '--verbose', action='store_true', help='log requests')
    a = ap.parse_args()
    if a.hash_password:
        pw = sys.stdin.readline().rstrip('\r\n')
        if not pw:
            sys.exit('empty password')
        print(hash_password(pw))
        return
    CONFIG['password'] = a.password
    CONFIG['password_hash'] = env('GC_PASSWORD_HASH', '').strip()
    CONFIG['verbose'] = a.verbose
    CONFIG['lang'] = a.lang
    CONFIG['update_check'] = not a.no_update_check and env('GC_UPDATE_CHECK', '1').strip().lower() not in ('0', 'no', 'false', 'off')
    CONFIG['repo'] = env('GC_REPO', DEFAULT_REPO).strip()
    sessions_load()

    http.server.ThreadingHTTPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer((a.host, a.port), Handler)
    srv.daemon_threads = True
    hosts = lan_ips() if a.host in ('0.0.0.0', '') else [a.host]
    L = CONFIG['lang']
    print(tr(L, 'running', VERSION))
    for h in hosts:
        print('   http://%s:%d/' % (h, a.port))
    print(tr(L, 'user', getpass.getuser() + (' (root!)' if IS_ROOT else '')))
    if not auth_enabled():
        print(tr(L, 'no_password'))
    sys.stdout.flush()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()
