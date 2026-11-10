#!/usr/bin/env bash
# Gabo Commander – management command · kezelő parancs
# Installed as /usr/local/bin/gabo-commander by install.sh.   Usage: gabo-commander help

main() {
set -euo pipefail

DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ENV_FILE=/etc/gabo-commander.env
UNIT=/etc/systemd/system/gabo-commander.service
BIN=/usr/local/bin/gabo-commander
SERVICE=gabo-commander
SELF="$DIR/gabo-commander.sh"

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; N=$'\e[0m'; else B="" G="" Y="" R="" C="" N=""; fi

L=""
[ -r "$ENV_FILE" ] && L="$(sed -n 's/^GC_LANG=//p' "$ENV_FILE" 2>/dev/null | tail -n 1)"
if [ -z "$L" ]; then case "${LANG:-}${LC_ALL:-}" in hu*|*hu_HU*) L=hu ;; *) L=en ;; esac; fi
m()    { if [ "$L" = hu ]; then printf '%s' "$1"; else printf '%s' "$2"; fi; }
say()  { printf '%s\n' "$(m "$1" "$2")"; }
ok()   { printf '%s✓%s %s\n' "$G" "$N" "$(m "$1" "$2")"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$(m "$1" "$2")" >&2; }
die()  { printf '%s✗ %s%s\n' "$R" "$(m "$1" "$2")" "$N" >&2; exit 1; }

CMD="${1:-help}"
[ $# -gt 0 ] && shift

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || die "Rendszergazdaként futtasd." "Run it as root."
    exec sudo bash "$SELF" "$CMD" "$@"
  fi
}

version() { cat "$DIR/VERSION" 2>/dev/null || echo '?'; }
port()    { local p=""; [ -r "$ENV_FILE" ] && p="$(sed -n 's/^GC_PORT=//p' "$ENV_FILE" | tail -n 1)"; echo "${p:-28090}"; }

branch() {
  local b; b="$(git -C "$DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  [ -n "$b" ] && [ "$b" != HEAD ] && echo "$b" || echo main
}

case "$CMD" in
  version|-v|--version)
    printf 'Gabo Commander v%s\n' "$(version)"
    git -C "$DIR" log -1 --format="%h  %cd" --date=short 2>/dev/null || true
    ;;

  status)
    [ -r "$ENV_FILE" ] || [ ! -e "$ENV_FILE" ] || need_root "$@"   # a beállításfájl csak rootnak olvasható
    printf '%sGabo Commander v%s%s  (%s)\n' "$B" "$(version)" "$N" "$DIR"
    if systemctl is-active --quiet "$SERVICE"; then
      ok "Fut." "Running."
    else
      warn "Nem fut. Napló: sudo gabo-commander logs" "Not running. Log: sudo gabo-commander logs"
    fi
    if [ -r "$ENV_FILE" ]; then
      h="$(sed -n 's/^GC_HOST=//p' "$ENV_FILE" | tail -n 1)"; p="$(port)"
      if [ "${h:-0.0.0.0}" = 0.0.0.0 ]; then
        for ip in $(hostname -I 2>/dev/null || hostname); do case "$ip" in *:*) ;; *) echo "   http://$ip:$p/" ;; esac; done
      else
        echo "   http://$h:$p/"
      fi
    fi
    systemctl --no-pager --lines=0 status "$SERVICE" 2>/dev/null | sed -n '1,4p' || true
    ;;

  check)
    need_root "$@"
    br="$(branch)"
    git -C "$DIR" fetch -q origin "$br" || die "Nem érhető el a GitHub." "GitHub is not reachable."
    cur="$(version)"; new="$(git -C "$DIR" show "origin/$br:VERSION" 2>/dev/null || echo '?')"
    if [ "$(git -C "$DIR" rev-parse HEAD)" = "$(git -C "$DIR" rev-parse "origin/$br")" ]; then
      ok "Naprakész (v$cur)." "Up to date (v$cur)."
    else
      say "Telepítve: v$cur   Elérhető: v$new" "Installed: v$cur   Available: v$new"
      git -C "$DIR" log --oneline --no-decorate "HEAD..origin/$br" | head -n 20
      say "Frissítés: sudo gabo-commander update" "Update with: sudo gabo-commander update"
    fi
    ;;

  update|upgrade)
    need_root "$@"
    force=0; [ "${1:-}" = "--force" ] && force=1
    br="$(branch)"
    cur="$(version)"; old_rev="$(git -C "$DIR" rev-parse HEAD)"
    say "Frissítések keresése…" "Checking for updates…"
    git -C "$DIR" fetch -q origin "$br" || die "Nem érhető el a GitHub." "GitHub is not reachable."
    new_rev="$(git -C "$DIR" rev-parse "origin/$br")"
    if [ "$old_rev" = "$new_rev" ] && [ "$force" = 0 ]; then
      ok "Már a legújabb verzió fut (v$cur)." "Already on the latest version (v$cur)."
      exit 0
    fi
    if [ -n "$(git -C "$DIR" status --porcelain)" ]; then
      git -C "$DIR" stash push -q --include-untracked -m "gabo-commander update $(date '+%F %T')" || true
      warn "Helyi módosítások félretéve (git stash list)." "Local changes were stashed (git stash list)."
    fi
    git -C "$DIR" reset -q --hard "origin/$br"
    new="$(version)"
    if [ "$old_rev" != "$new_rev" ]; then
      say "Változások:" "Changes:"
      git -C "$DIR" log --oneline --no-decorate "$old_rev..$new_rev" 2>/dev/null | head -n 30 | sed 's/^/   /'
    fi
    bash "$DIR/install.sh" --apply
    ok "Frissítve: v$cur → v$new" "Updated: v$cur → v$new"
    ;;

  restart)
    need_root "$@"
    systemctl restart "$SERVICE" && ok "Újraindítva." "Restarted."
    ;;

  start|stop)
    need_root "$@"
    systemctl "$CMD" "$SERVICE"
    ;;

  logs|log)
    need_root "$@"
    exec journalctl -u "$SERVICE" -n 100 -f
    ;;

  config|setup)
    need_root "$@"
    exec bash "$DIR/install.sh" "$@"
    ;;

  password|passwd)
    need_root "$@"
    exec bash "$DIR/install.sh" --password
    ;;

  uninstall)
    need_root "$@"
    printf '%s' "$(m 'Biztosan eltávolítod a Gabo Commandert? [i/N]: ' 'Really uninstall Gabo Commander? [y/N]: ')"
    IFS= read -r a </dev/tty || a=""
    case "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" in y|yes|i|igen) ;; *) die "Megszakítva." "Cancelled." ;; esac
    systemctl disable --now "$SERVICE" >/dev/null 2>&1 || true
    rm -f "$UNIT" "$BIN"
    systemctl daemon-reload
    ok "Szolgáltatás eltávolítva." "Service removed."
    printf '%s' "$(m "A beállítások ($ENV_FILE) és a program ($DIR) is törlődjön? [i/N]: " "Also delete the settings ($ENV_FILE) and the program ($DIR)? [y/N]: ")"
    IFS= read -r a </dev/tty || a=""
    case "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" in
      y|yes|i|igen)
        rm -f "$ENV_FILE"
        [ "$DIR" = /opt/gabo-commander ] && rm -rf "$DIR"
        ok "Minden törölve." "Everything removed." ;;
      *) say "Megmaradt: $ENV_FILE és $DIR" "Kept: $ENV_FILE and $DIR" ;;
    esac
    say "A tűzfalszabályokat (ha voltak) kézzel töröld: sudo ufw status numbered" \
        "Remove firewall rules (if any) by hand: sudo ufw status numbered"
    ;;

  help|-h|--help|*)
    [ "$CMD" = help ] || [ "$CMD" = -h ] || [ "$CMD" = --help ] || warn "Ismeretlen parancs: $CMD" "Unknown command: $CMD"
    printf '%sGabo Commander v%s%s\n\n' "$B" "$(version)" "$N"
    say "Használat: gabo-commander <parancs>" "Usage: gabo-commander <command>"
    echo
    printf '  %s%-22s%s %s\n' \
      "$C" "status" "$N" "$(m 'fut-e, verzió, elérési cím' 'running?, version, address')" \
      "$C" "version" "$N" "$(m 'telepített verzió' 'installed version')" \
      "$C" "check" "$N" "$(m 'van-e új verzió a GitHubon' 'is there a new version on GitHub')" \
      "$C" "update [--force]" "$N" "$(m 'frissítés a legújabb verzióra és újraindítás' 'update to the latest version and restart')" \
      "$C" "config" "$N" "$(m 'a telepítő varázsló újra (felhasználó, port, jelszó…)' 'run the setup wizard again (user, port, password…)')" \
      "$C" "password" "$N" "$(m 'jelszó beállítása / módosítása / kikapcsolása' 'set / change / turn off the password')" \
      "$C" "restart | start | stop" "$N" "$(m 'szolgáltatás kezelése' 'control the service')" \
      "$C" "logs" "$N" "$(m 'napló (Ctrl+C: kilépés)' 'log (Ctrl+C to quit)')" \
      "$C" "uninstall" "$N" "$(m 'eltávolítás' 'uninstall')"
    echo
    say "A root jogot igénylő parancsok maguktól sudo-t kérnek." "Commands that need root ask for sudo automatically."
    ;;
esac
}

main "$@"; exit $?
