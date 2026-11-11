#!/usr/bin/env bash
# Gabo Commander – install / setup wizard  ·  telepítő és beállító varázsló
#
#   One-liner / egy sorban:
#     curl -fsSL https://raw.githubusercontent.com/gabro89/gabo-commander/main/install.sh | sudo bash
#
#   From a clone / klónból:
#     git clone https://github.com/gabro89/gabo-commander.git && sudo bash gabo-commander/install.sh
#
#   Non-interactive / kérdések nélkül:
#     sudo bash install.sh --yes --lang en --user gabor --port 28090
#
#   Options: --yes  --lang hu|en  --user NAME  --port N  --host ADDR  --no-update-check
#            --apply      (rewrite service from the saved settings, no questions – used by "gabo-commander update")
#            --password   (only set / change / remove the password)
#
# The program lives in /opt/gabo-commander as a git clone, so "sudo gabo-commander update" can pull new versions.
# A program a /opt/gabo-commander mappába kerül git-klónként, így a "sudo gabo-commander update" frissíteni tudja.

main() {
set -euo pipefail
umask 022

REPO_URL_DEFAULT="https://github.com/gabro89/gabo-commander.git"
BRANCH="${GC_BRANCH:-main}"
DEST=/opt/gabo-commander
ENV_FILE=/etc/gabo-commander.env
UNIT=/etc/systemd/system/gabo-commander.service
UPD_UNIT=/etc/systemd/system/gabo-commander-update.service
UPD_PATH=/etc/systemd/system/gabo-commander-update.path
UPD_LOG=/var/log/gabo-commander-update.log
BIN=/usr/local/bin/gabo-commander
SERVICE=gabo-commander
DEFAULT_PORT=28090

ORIG_ARGS=("$@")
MODE=wizard
ASSUME_YES=0
OPT_USER="" OPT_PORT="" OPT_HOST="" OPT_LANG="" OPT_UPD=""
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1 ;;
    --apply) MODE=apply; ASSUME_YES=1 ;;
    --password) MODE=password ;;
    --user) OPT_USER="${2:-}"; shift ;;
    --port) OPT_PORT="${2:-}"; shift ;;
    --host) OPT_HOST="${2:-}"; shift ;;
    --lang) OPT_LANG="${2:-}"; shift ;;
    --no-update-check) OPT_UPD=0 ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]:-/dev/null}" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option / ismeretlen kapcsoló: $1" >&2; exit 2 ;;
  esac
  shift
done

# ------------------------------------------------------------------ megjelenítés / output
if [ -t 1 ]; then
  B=$'\e[1m'; D=$'\e[2m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; N=$'\e[0m'
else
  B="" D="" G="" Y="" R="" C="" N=""
fi
L=en
case "${OPT_LANG:-}" in hu|en) L="$OPT_LANG" ;; esac
if [ -z "${OPT_LANG:-}" ]; then
  if [ -r "$ENV_FILE" ] && grep -q '^GC_LANG=hu' "$ENV_FILE" 2>/dev/null; then L=hu
  elif [ -r "$ENV_FILE" ] && grep -q '^GC_LANG=en' "$ENV_FILE" 2>/dev/null; then L=en
  else case "${LANG:-}${LC_ALL:-}" in hu*|*hu_HU*) L=hu ;; esac
  fi
fi

m()     { if [ "$L" = hu ]; then printf '%s' "$1"; else printf '%s' "$2"; fi; }
say()   { printf '%s\n' "$(m "$1" "$2")"; }
info()  { printf '%s→%s %s\n' "$C" "$N" "$(m "$1" "$2")"; }
ok()    { printf '%s✓%s %s\n' "$G" "$N" "$(m "$1" "$2")"; }
warn()  { printf '%s!%s %s\n' "$Y" "$N" "$(m "$1" "$2")" >&2; }
die()   { printf '%s✗ %s%s\n' "$R" "$(m "$1" "$2")" "$N" >&2; exit 1; }
title() { printf '\n%s%s%s\n' "$B" "$(m "$1" "$2")" "$N"; }

HAVE_TTY=0
if [ "$ASSUME_YES" = 0 ] && { : </dev/tty; } 2>/dev/null; then HAVE_TTY=1; fi
if [ "$ASSUME_YES" = 0 ] && [ "$HAVE_TTY" = 0 ]; then
  die "Nincs terminál a kérdésekhez. Futtasd terminálból, vagy add meg: --yes" \
      "No terminal for the questions. Run it from a terminal, or pass --yes"
fi

# ask VAR "kérdés" "question" default
ask() {
  local __v=$1 __def=${4:-} __a=""
  if [ "$ASSUME_YES" = 1 ]; then printf -v "$__v" '%s' "$__def"; return; fi
  printf '%s%s%s [%s]: ' "$B" "$(m "$2" "$3")" "$N" "$__def" >/dev/tty
  IFS= read -r __a </dev/tty || __a=""
  printf -v "$__v" '%s' "${__a:-$__def}"
}
# yesno "kérdés" "question" y|n   → 0 = igen/yes
yesno() {
  local def=$3 a=""
  if [ "$ASSUME_YES" = 1 ]; then [ "$def" = y ]; return; fi
  while :; do
    printf '%s%s%s [%s]: ' "$B" "$(m "$1" "$2")" "$N" "$(m "$([ "$def" = y ] && echo I/n || echo i/N)" "$([ "$def" = y ] && echo Y/n || echo y/N)")" >/dev/tty
    IFS= read -r a </dev/tty || a=""
    a="$(printf '%s' "${a:-$def}" | tr '[:upper:]' '[:lower:]')"
    case "$a" in y|yes|i|igen) return 0 ;; n|no|nem) return 1 ;; esac
  done
}
# choose VAR default "opt1" "opt2" ...   (a lehetőségek már lefordítva) → VAR = 1..n
choose() {
  local __v=$1 __def=$2 __a="" i; shift 2
  if [ "$ASSUME_YES" = 1 ]; then printf -v "$__v" '%s' "$__def"; return; fi
  i=1; for o in "$@"; do printf '   %s%d)%s %s\n' "$B" "$i" "$N" "$o" >/dev/tty; i=$((i + 1)); done
  while :; do
    printf '%s%s%s [%s]: ' "$B" "$(m 'Választás' 'Choice')" "$N" "$__def" >/dev/tty
    IFS= read -r __a </dev/tty || __a=""
    __a=${__a:-$__def}
    if [[ "$__a" =~ ^[0-9]+$ ]] && [ "$__a" -ge 1 ] && [ "$__a" -le $# ]; then printf -v "$__v" '%s' "$__a"; return; fi
  done
}
ask_secret() {   # ask_secret VAR "kérdés" "question"
  local __v=$1 __a=""
  printf '%s%s%s: ' "$B" "$(m "$2" "$3")" "$N" >/dev/tty
  stty -echo </dev/tty 2>/dev/null || true
  IFS= read -r __a </dev/tty || __a=""
  stty echo </dev/tty 2>/dev/null || true
  printf '\n' >/dev/tty
  printf -v "$__v" '%s' "$__a"
}

# ------------------------------------------------------------------ alapellenőrzések / basic checks
SELF="${BASH_SOURCE[0]:-}"
SRC=""
if [ -n "$SELF" ] && [ -f "$SELF" ] && [ -f "$(dirname "$SELF")/server.py" ]; then
  SRC="$(cd "$(dirname "$SELF")" && pwd -P)"
fi

if [ "$(id -u)" -ne 0 ]; then
  if [ -n "$SRC" ] && command -v sudo >/dev/null 2>&1; then
    exec sudo bash "$SRC/install.sh" ${ORIG_ARGS[@]+"${ORIG_ARGS[@]}"}
  fi
  die "Rendszergazdaként kell futtatni:  ... | sudo bash" "Must be run as root:  ... | sudo bash"
fi
if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
  die "Ehhez systemd kell (Ubuntu, Debian, Fedora, Arch… mind ilyen). Kézi indítás: python3 server.py" \
      "systemd is required (Ubuntu, Debian, Fedora, Arch… all have it). To run manually: python3 server.py"
fi

# a git ne utasítsa el a más tulajdonában lévő forrásmappát (pl. /home/gabor/gabo-commander)
GITCFG="$(mktemp)"
printf '[safe]\n\tdirectory = *\n' >"$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG"
trap 'rm -f "$GITCFG"; stty echo </dev/tty 2>/dev/null || true' EXIT

# ------------------------------------------------------------------ meglévő beállítások / existing settings
env_get() {   # a mentett érték idézőjelek nélkül
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'
}
unit_get() { [ -f "$UNIT" ] && sed -n "s/^$1//p" "$UNIT" | tail -n 1 || true; }

CUR_USER="$(unit_get 'User=')"
CUR_PORT="$(env_get GC_PORT)"
CUR_HOST="$(env_get GC_HOST)"
CUR_LANG="$(env_get GC_LANG)"
CUR_UPD="$(env_get GC_UPDATE_CHECK)"
PW_LINES=""
[ -f "$ENV_FILE" ] && PW_LINES="$(grep -E '^GC_PASSWORD(_HASH)?=' "$ENV_FILE" || true)"
HAS_PW=0; [ -n "$PW_LINES" ] && HAS_PW=1
INSTALLED=0; [ -f "$UNIT" ] && INSTALLED=1

if [ "$MODE" = apply ] && [ "$INSTALLED" = 0 ]; then
  die "Még nincs telepítve. Futtasd: sudo bash $DEST/install.sh" "Not installed yet. Run: sudo bash $DEST/install.sh"
fi

# ------------------------------------------------------------------ nyelv / language
if [ "$MODE" = wizard ]; then
  printf '\n%s Gabo Commander %s\n' "$B" "$N"
  if [ -z "$OPT_LANG" ] && [ "$ASSUME_YES" = 0 ]; then
    printf '%sNyelv / Language%s\n' "$B" "$N" >/dev/tty
    choose li "$([ "${CUR_LANG:-$L}" = hu ] && echo 1 || echo 2)" "Magyar" "English"
    [ "$li" = 1 ] && L=hu || L=en
  fi
  say "Telepítő varázsló – Enterrel elfogadod a [zárójelben] lévő alapértéket." \
      "Setup wizard – press Enter to accept the default shown in [brackets]."
fi

# ------------------------------------------------------------------ csomagok / packages
pkg_install() {
  if command -v apt-get >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null; then dnf install -y -q "$@"
  elif command -v yum >/dev/null; then yum install -y -q "$@"
  elif command -v pacman >/dev/null; then pacman -Sy --noconfirm --needed "$@"
  elif command -v zypper >/dev/null; then zypper --non-interactive install "$@"
  elif command -v apk >/dev/null; then apk add --no-cache "$@"
  else return 1
  fi
}
need=()
command -v python3 >/dev/null 2>&1 || need+=(python3)
command -v git >/dev/null 2>&1 || need+=(git)
if [ ${#need[@]} -gt 0 ]; then
  info "Hiányzó csomagok telepítése: ${need[*]}" "Installing missing packages: ${need[*]}"
  pkg_install "${need[@]}" || die "Nem sikerült telepíteni: ${need[*]} – telepítsd kézzel, majd futtasd újra." \
                                  "Could not install: ${need[*]} – install them manually, then run this again."
fi
python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))' ||
  die "Python 3.8 vagy újabb kell (most: $(python3 -V 2>&1))." "Python 3.8 or newer is required (found: $(python3 -V 2>&1))."
PYTHON="$(command -v python3)"

# ------------------------------------------------------------------ program a /opt-ba (git-klón) / program into /opt (git clone)
prepare_source() {
  [ "$SRC" = "$DEST" ] && return 0
  local origin="" tmp="$DEST.new.$$" src_git=0
  if [ -n "$SRC" ] && [ "$(cd "$(git -C "$SRC" rev-parse --show-toplevel 2>/dev/null || echo /nonexistent)" 2>/dev/null && pwd -P)" = "$SRC" ] &&
     git -C "$SRC" rev-parse HEAD >/dev/null 2>&1; then
    src_git=1
    origin="$(git -C "$SRC" remote get-url origin 2>/dev/null || true)"
  fi
  [ -n "$origin" ] || origin="$REPO_URL_DEFAULT"
  rm -rf "$tmp"
  if [ "$src_git" = 1 ]; then
    info "Program másolása ide: $DEST" "Copying the program to $DEST"
    git clone -q --no-hardlinks "$SRC" "$tmp"
    git -C "$tmp" remote set-url origin "$origin"
    git -C "$tmp" fetch -q origin 2>/dev/null ||
      warn "A GitHub most nem érhető el – a frissítés később működni fog." "GitHub is not reachable right now – updates will work later."
    local br; br="$(git -C "$tmp" rev-parse --abbrev-ref HEAD)"
    git -C "$tmp" branch -q --set-upstream-to="origin/$br" 2>/dev/null || true
  else
    info "Letöltés: $origin" "Downloading: $origin"
    git clone -q --branch "$BRANCH" "$origin" "$tmp" || die "Nem sikerült letölteni: $origin" "Download failed: $origin"
  fi
  if [ -e "$DEST" ]; then
    if [ -d "$DEST/.git" ]; then
      rm -rf "$DEST"
    else   # nem tőlünk származó mappa: nem töröljük, csak félretesszük
      local bak; bak="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
      mv "$DEST" "$bak"
      info "A már létező $DEST mappa ide került: $bak" "The existing $DEST folder was moved to: $bak"
    fi
  fi
  mv "$tmp" "$DEST"
}
if [ "$MODE" = wizard ]; then
  prepare_source
fi
[ -f "$DEST/server.py" ] || die "Nem található: $DEST/server.py" "Not found: $DEST/server.py"
VERSION="$(cat "$DEST/VERSION" 2>/dev/null || echo '?')"

ORIGIN_URL="$(git -C "$DEST" remote get-url origin 2>/dev/null || true)"
REPO_SLUG="$(printf '%s' "$ORIGIN_URL" | sed -nE 's#^(https?://|ssh://git@|git@)github\.com[:/]([^/]+/[^/]+)$#\2#p' | sed 's/\.git$//')"

# ------------------------------------------------------------------ segédek / helpers
port_in_use() {   # 0 = más program használja a portot
  local p=$1
  "$PYTHON" - "$p" <<'PY' && return 1
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(('0.0.0.0', int(sys.argv[1])))
except OSError:
    sys.exit(1)
finally:
    s.close()
PY
  # foglalt – de lehet, hogy épp mi használjuk
  if [ "$p" = "${CUR_PORT:-}" ] && systemctl is-active --quiet "$SERVICE" 2>/dev/null; then return 1; fi
  return 0
}
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
free_port_from() { local p=$1; while port_in_use "$p"; do p=$((p + 1)); done; echo "$p"; }

make_hash() {   # stdin: jelszó → stdout: hash
  "$PYTHON" "$DEST/server.py" --hash-password
}

ask_password() {   # beállítja: PW_LINES
  local choice pw pw2
  if [ "$HAS_PW" = 1 ]; then
    say "Jelenleg van jelszó beállítva." "A password is currently set."
    choose choice 1 "$(m 'Megtartom' 'Keep it')" "$(m 'Új jelszót adok meg' 'Set a new password')" "$(m 'Jelszó kikapcsolása' 'Turn the password off')"
    case "$choice" in 1) return 0 ;; 3) PW_LINES=""; return 0 ;; esac
  else
    say "Jelszó nélkül bárki használhatja, aki eléri a portot (a belső hálón is!)." \
        "Without a password anyone who can reach the port can use it (on the local network too!)."
    if ! yesno "Beállítasz jelszót? (ajánlott)" "Set a password? (recommended)" y; then PW_LINES=""; return 0; fi
  fi
  while :; do
    ask_secret pw "Jelszó" "Password"
    [ -n "$pw" ] || { warn "Üres jelszó nem lehet." "The password cannot be empty."; continue; }
    ask_secret pw2 "Jelszó még egyszer" "Password again"
    [ "$pw" = "$pw2" ] && break
    warn "A két jelszó nem egyezik, próbáld újra." "The passwords do not match, try again."
  done
  PW_LINES="GC_PASSWORD_HASH=$(printf '%s\n' "$pw" | make_hash)"
}

write_env() {
  local tmp; tmp="$(mktemp)"
  {
    echo "# Gabo Commander – $(m 'beállítások (módosítás: sudo gabo-commander config)' 'settings (change with: sudo gabo-commander config)')"
    echo "GC_LANG=$NEW_LANG"
    echo "GC_HOST=$NEW_HOST"
    echo "GC_PORT=$NEW_PORT"
    echo "GC_UPDATE_CHECK=$NEW_UPD"
    echo "GC_REPO=$REPO_SLUG"
    [ -z "$PW_LINES" ] || printf '%s\n' "$PW_LINES"
    if [ -f "$ENV_FILE" ]; then   # a kézzel hozzáadott egyéb sorok maradnak
      grep -vE '^(GC_LANG|GC_HOST|GC_PORT|GC_UPDATE_CHECK|GC_REPO|GC_PASSWORD|GC_PASSWORD_HASH)=|^# Gabo Commander' "$ENV_FILE" || true
    fi
  } >"$tmp"
  install -m 600 -o root -g root "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}

write_service() {
  cat >"$UNIT" <<EOF
[Unit]
Description=Gabo Commander (web file manager)
Documentation=https://github.com/${REPO_SLUG:-gabro89/gabo-commander}
After=network-online.target
Wants=network-online.target

[Service]
User=$NEW_USER
EnvironmentFile=-$ENV_FILE
Environment=PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
StateDirectory=gabo-commander
StateDirectoryMode=0700
ExecStart=$PYTHON $DEST/server.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
  cat >"$BIN" <<EOF
#!/bin/sh
# Gabo Commander – $(m 'kezelő parancs' 'management command')
exec bash $DEST/gabo-commander.sh "\$@"
EOF
  chmod 755 "$BIN"
  write_updater
}

# Frissítés a felületről: az app (a saját jogaival) csak egy kérésfájlt tesz a StateDirectory-ba;
# a .path egység erre elindítja a rootként futó, egyetlen dolgot tudó frissítő szolgáltatást.
# A napló root tulajdonú helyre kerül (a felhasználó mappájába root nem ír – symlinkes trükk ellen).
# In-app update: the app only drops a request file; the .path unit starts the root-only updater.
write_updater() {
  if [ "$NEW_UPD" != 1 ]; then
    systemctl disable --now gabo-commander-update.path >/dev/null 2>&1 || true
    rm -f "$UPD_UNIT" "$UPD_PATH"
    return 0
  fi
  cat >"$UPD_UNIT" <<EOF
[Unit]
Description=Gabo Commander update (requested from the web UI)

[Service]
Type=oneshot
Environment=HOME=/root
ExecStartPre=-/bin/rm -f /var/lib/gabo-commander/update-request
ExecStart=/bin/sh -c '{ date; bash $DEST/gabo-commander.sh update; echo "== exit \$\$?"; } >$UPD_LOG 2>&1'
EOF
  cat >"$UPD_PATH" <<EOF
[Unit]
Description=Gabo Commander – waits for an update request from the web UI

[Path]
PathExists=/var/lib/gabo-commander/update-request
Unit=gabo-commander-update.service

[Install]
WantedBy=multi-user.target
EOF
}

start_service() {
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1
  systemctl restart "$SERVICE"
  if [ -f "$UPD_PATH" ]; then systemctl enable --now gabo-commander-update.path >/dev/null 2>&1 || true; fi
  local h=127.0.0.1 i
  case "$NEW_HOST" in 0.0.0.0|127.0.0.1|::|"") ;; *) h="$NEW_HOST" ;; esac
  for i in $(seq 1 20); do
    if "$PYTHON" -c 'import socket,sys; socket.create_connection((sys.argv[1], int(sys.argv[2])), 1).close()' "$h" "$NEW_PORT" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  warn "A szolgáltatás nem indult el. Napló:" "The service did not start. Log:"
  journalctl -u "$SERVICE" -n 25 --no-pager >&2 || true
  exit 1
}

show_urls() {
  local ips ip
  if [ "$NEW_HOST" = 0.0.0.0 ] || [ "$NEW_HOST" = "::" ]; then
    ips="$(hostname -I 2>/dev/null || true)"
    for ip in $ips; do
      case "$ip" in *:*) ;; *) printf '     %shttp://%s:%s/%s\n' "$B$G" "$ip" "$NEW_PORT" "$N" ;; esac
    done
    [ -n "$ips" ] || printf '     %shttp://%s:%s/%s\n' "$B$G" "$(hostname)" "$NEW_PORT" "$N"
  else
    printf '     %shttp://%s:%s/%s\n' "$B$G" "$NEW_HOST" "$NEW_PORT" "$N"
    if [ "$NEW_HOST" = 127.0.0.1 ]; then
      say "     Távolról SSH-alagúttal:  ssh -L $NEW_PORT:127.0.0.1:$NEW_PORT $(hostname)  → http://localhost:$NEW_PORT/" \
          "     Remotely via SSH tunnel: ssh -L $NEW_PORT:127.0.0.1:$NEW_PORT $(hostname)  → http://localhost:$NEW_PORT/"
    fi
  fi
}

# ------------------------------------------------------------------ csak jelszó / password only
if [ "$MODE" = password ]; then
  [ "$INSTALLED" = 1 ] || die "Még nincs telepítve." "Not installed yet."
  NEW_USER="$CUR_USER"; NEW_PORT="${CUR_PORT:-$DEFAULT_PORT}"; NEW_HOST="${CUR_HOST:-0.0.0.0}"
  NEW_LANG="${CUR_LANG:-$L}"; NEW_UPD="${CUR_UPD:-1}"
  ask_password
  write_env
  systemctl restart "$SERVICE"
  if [ -n "$PW_LINES" ]; then ok "Jelszó beállítva." "Password set."; else ok "Jelszó kikapcsolva." "Password turned off."; fi
  exit 0
fi

# ------------------------------------------------------------------ kérdések / questions
NEW_LANG="${OPT_LANG:-${CUR_LANG:-$L}}"
[ "$MODE" = wizard ] && [ -z "$OPT_LANG" ] && NEW_LANG="$L"
DEF_USER="${OPT_USER:-${CUR_USER:-${SUDO_USER:-}}}"
if [ -z "$DEF_USER" ] || [ "$DEF_USER" = root ] && [ -z "$OPT_USER" ] && [ -z "$CUR_USER" ]; then
  DEF_USER="$(getent passwd 1000 | cut -d: -f1 || true)"
  [ -n "$DEF_USER" ] || DEF_USER=root
fi
NEW_USER="$DEF_USER"
NEW_PORT="${OPT_PORT:-${CUR_PORT:-$DEFAULT_PORT}}"
NEW_HOST="${OPT_HOST:-${CUR_HOST:-0.0.0.0}}"
NEW_UPD="${OPT_UPD:-${CUR_UPD:-1}}"

if [ "$MODE" = wizard ]; then
  # 1. felhasználó
  title "1/5  Melyik felhasználó nevében fusson?" "1/5  Which user should it run as?"
  say "A program annak a felhasználónak a jogaival lát és módosít fájlokat." \
      "The program sees and changes files with this user's permissions."
  if [ "$ASSUME_YES" = 0 ] && [ -z "$OPT_USER" ]; then
    opts=()
    [ "$DEF_USER" != root ] && opts+=("$DEF_USER  $(m '(ajánlott: a rendszerfájlokat csak olvasni tudja)' '(recommended: system files are read-only)')")
    opts+=("root  $(m '(mindenhez hozzáfér – egy rossz törlés is nagyobb kárt okoz)' '(full access – a wrong delete can do more damage)')")
    opts+=("$(m 'Másik felhasználó…' 'Another user…')")
    choose uc 1 "${opts[@]}"
    if [ "$DEF_USER" = root ]; then uc=$((uc + 1)); fi
    case "$uc" in
      1) NEW_USER="$DEF_USER" ;;
      2) NEW_USER=root ;;
      3) while :; do
           ask NEW_USER "Felhasználónév" "User name" ""
           id "$NEW_USER" >/dev/null 2>&1 && break
           warn "Nincs ilyen felhasználó: $NEW_USER" "No such user: $NEW_USER"
         done ;;
    esac
  fi
  id "$NEW_USER" >/dev/null 2>&1 || die "Nincs ilyen felhasználó: $NEW_USER" "No such user: $NEW_USER"

  # 2. port
  title "2/5  Port" "2/5  Port"
  say "Egyedi portot javaslok, hogy ne ütközzön más programmal ($DEFAULT_PORT)." \
      "A distinctive port is suggested so it won't clash with other programs ($DEFAULT_PORT)."
  if [ -z "$OPT_PORT" ] && port_in_use "$NEW_PORT"; then
    sug="$(free_port_from "$NEW_PORT")"
    warn "A(z) $NEW_PORT port foglalt, javaslat: $sug" "Port $NEW_PORT is in use, suggestion: $sug"
    NEW_PORT="$sug"
  fi
  while :; do
    ask NEW_PORT "Port" "Port" "$NEW_PORT"
    if ! valid_port "$NEW_PORT"; then warn "Érvénytelen port." "Invalid port."; [ "$ASSUME_YES" = 1 ] && exit 1; continue; fi
    if [ "$NEW_PORT" -lt 1024 ] && [ "$NEW_USER" != root ]; then
      warn "1024 alatti portot csak root használhat. Válassz nagyobbat." "Ports below 1024 need root. Choose a higher one."
      [ "$ASSUME_YES" = 1 ] && exit 1; continue
    fi
    if port_in_use "$NEW_PORT"; then
      warn "A(z) $NEW_PORT portot már használja valami." "Port $NEW_PORT is already in use."
      [ "$ASSUME_YES" = 1 ] && exit 1; NEW_PORT="$(free_port_from "$NEW_PORT")"; continue
    fi
    break
  done

  # 3. elérés
  title "3/5  Honnan lehessen elérni?" "3/5  Where should it be reachable from?"
  hc=1
  case "$NEW_HOST" in 0.0.0.0) hc=1 ;; 127.0.0.1) hc=2 ;; *) hc=3 ;; esac
  if [ "$ASSUME_YES" = 0 ] && [ -z "$OPT_HOST" ]; then
    choose hc "$hc" \
      "$(m 'A hálózatról (minden címen figyel: 0.0.0.0)' 'From the network (listen on all addresses: 0.0.0.0)')" \
      "$(m 'Csak erről a gépről (127.0.0.1) – fordított proxy vagy SSH-alagút mögé' 'Only from this machine (127.0.0.1) – behind a reverse proxy or SSH tunnel')" \
      "$(m 'Megadott címen…' 'A specific address…')"
    case "$hc" in
      1) NEW_HOST=0.0.0.0 ;;
      2) NEW_HOST=127.0.0.1 ;;
      3) ask NEW_HOST "Cím (IP)" "Address (IP)" "$([ "$NEW_HOST" = 0.0.0.0 ] || [ "$NEW_HOST" = 127.0.0.1 ] && echo '' || echo "$NEW_HOST")" ;;
    esac
  fi

  # 4. jelszó
  title "4/5  Jelszó" "4/5  Password"
  if [ "$ASSUME_YES" = 0 ]; then ask_password; fi

  # 5. frissítés-ellenőrzés
  title "5/5  Frissítések" "5/5  Updates"
  say "A felület óránként megnézi a GitHubon, van-e új verzió, és jelzi (csak a verziószámot tölti le)." \
      "The UI checks GitHub every hour for a new version and shows a notice (it only downloads the version number)."
  say "Ilyenkor a felületről egy kattintással frissíthető is (ugyanaz, mint a sudo gabo-commander update)." \
      "It can then also be updated from the UI with one click (same as sudo gabo-commander update)."
  if [ -z "$OPT_UPD" ]; then
    if yesno "Jelezze, ha van új verzió, és lehessen a felületről frissíteni?" "Notify about new versions and allow updating from the UI?" "$([ "$NEW_UPD" = 0 ] && echo n || echo y)"; then NEW_UPD=1; else NEW_UPD=0; fi
  fi

  # összegzés
  title "Összegzés" "Summary"
  printf '   %-16s %s\n' "$(m 'Verzió' 'Version')" "$VERSION" \
    "$(m 'Mappa' 'Folder')" "$DEST" \
    "$(m 'Felhasználó' 'User')" "$NEW_USER" \
    "Port" "$NEW_PORT" \
    "$(m 'Cím' 'Address')" "$NEW_HOST" \
    "$(m 'Nyelv' 'Language')" "$NEW_LANG" \
    "$(m 'Jelszó' 'Password')" "$([ -n "$PW_LINES" ] && m 'van' 'yes' || m 'nincs' 'none')" \
    "$(m 'Frissítésjelzés' 'Update notice')" "$([ "$NEW_UPD" = 1 ] && m 'be' 'on' || m 'ki' 'off')"
  echo
  yesno "Mehet a telepítés?" "Proceed with the installation?" y || die "Megszakítva." "Cancelled."
else
  # --apply / --yes: régi telepítésből átvett vagy alapértékek
  [ -n "$NEW_USER" ] && id "$NEW_USER" >/dev/null 2>&1 || die "Nincs ilyen felhasználó: $NEW_USER" "No such user: $NEW_USER"
  valid_port "$NEW_PORT" || die "Érvénytelen port: $NEW_PORT" "Invalid port: $NEW_PORT"
fi
case "$NEW_LANG" in hu|en) ;; *) NEW_LANG=en ;; esac
L="$NEW_LANG"

# ------------------------------------------------------------------ telepítés / install
[ "$MODE" = apply ] || info "Szolgáltatás beállítása…" "Setting up the service…"
write_env
write_service
start_service

if [ "$MODE" = apply ]; then
  ok "Gabo Commander v$VERSION fut (port $NEW_PORT)." "Gabo Commander v$VERSION is running (port $NEW_PORT)."
  exit 0
fi

# ------------------------------------------------------------------ tűzfal / firewall
if [ "$NEW_HOST" != 127.0.0.1 ]; then
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    title "Tűzfal (ufw)" "Firewall (ufw)"
    if [ "$ASSUME_YES" = 1 ]; then
      say "Az ufw aktív. Ha nem éred el:  sudo ufw allow from 192.168.0.0/16 to any port $NEW_PORT proto tcp" \
          "ufw is active. If you can't reach it:  sudo ufw allow from 192.168.0.0/16 to any port $NEW_PORT proto tcp"
    else
      choose fw 1 \
        "$(m 'Engedélyezés a belső hálózatról (192.168.x, 10.x, 172.16-31.x)' 'Allow from the local network (192.168.x, 10.x, 172.16-31.x)')" \
        "$(m 'Engedélyezés mindenhonnan' 'Allow from anywhere')" \
        "$(m 'Nem nyúlok a tűzfalhoz' "Don't touch the firewall")"
      case "$fw" in
        1) for net in 192.168.0.0/16 10.0.0.0/8 172.16.0.0/12; do
             ufw allow from "$net" to any port "$NEW_PORT" proto tcp comment 'Gabo Commander' >/dev/null
           done; ok "ufw: engedélyezve a belső hálózatról." "ufw: allowed from the local network." ;;
        2) ufw allow "$NEW_PORT/tcp" comment 'Gabo Commander' >/dev/null; ok "ufw: engedélyezve." "ufw: allowed." ;;
      esac
    fi
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    title "Tűzfal (firewalld)" "Firewall (firewalld)"
    if yesno "Megnyissam a(z) $NEW_PORT/tcp portot?" "Open port $NEW_PORT/tcp?" y; then
      firewall-cmd --permanent --add-port="$NEW_PORT/tcp" >/dev/null && firewall-cmd --reload >/dev/null
      ok "firewalld: port megnyitva." "firewalld: port opened."
    fi
  fi
fi

# ------------------------------------------------------------------ kész / done
title "Kész! Gabo Commander v$VERSION fut." "Done! Gabo Commander v$VERSION is running."
say "   Nyisd meg a böngészőben:" "   Open it in your browser:"
show_urls
echo
say "   A szerver újraindítása után magától elindul. Hasznos parancsok:" \
    "   It starts automatically after a reboot. Useful commands:"
printf '     %-34s %s\n' \
  "sudo gabo-commander update" "$(m 'frissítés a legújabb verzióra' 'update to the latest version')" \
  "gabo-commander status" "$(m 'fut-e, verzió, cím' 'running?, version, address')" \
  "sudo gabo-commander config" "$(m 'ez a varázsló újra (port, jelszó…)' 'this wizard again (port, password…)')" \
  "sudo gabo-commander password" "$(m 'jelszó módosítása' 'change the password')" \
  "sudo gabo-commander logs" "$(m 'napló' 'log')" \
  "gabo-commander help" "$(m 'az összes parancs' 'all commands')"
if [ -z "$PW_LINES" ] && [ "$NEW_HOST" != 127.0.0.1 ]; then
  echo
  warn "Nincs jelszó: csak megbízható belső hálózaton használd! Beállítás: sudo gabo-commander password" \
       "No password: use it only on a trusted local network! Set one: sudo gabo-commander password"
fi
}

main "$@"; exit $?
