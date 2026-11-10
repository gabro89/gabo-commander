#!/usr/bin/env bash
# Shortcut for / rövidítés ehhez:  sudo gabo-commander update
# (Installs first if it's not installed yet / ha még nincs telepítve, előbb telepít.)
set -euo pipefail
if [ -f /opt/gabo-commander/gabo-commander.sh ]; then
  exec bash /opt/gabo-commander/gabo-commander.sh update "$@"
fi
exec bash "$(cd "$(dirname "$0")" && pwd)/install.sh" "$@"
