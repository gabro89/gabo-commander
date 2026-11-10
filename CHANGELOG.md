# Changelog · Változásnapló

## 1.1.0 – 2026-11-10

- English UI next to Hungarian; switch under *View → English / Magyar*. Server messages are translated too.
  · Angol felület a magyar mellett, a *Nézet → Magyar / English* menüben lehet váltani. A szerver üzenetei is fordítva.
- Setup wizard (`install.sh`), also as a one-liner: `curl … | sudo bash`.
  · Telepítő varázsló (`install.sh`), egy sorból is indítható: `curl … | sudo bash`.
- `gabo-commander` management command: `update`, `status`, `check`, `config`, `password`, `logs`, `uninstall`.
  · `gabo-commander` kezelő parancs: `update`, `status`, `check`, `config`, `password`, `logs`, `uninstall`.
- Version number in the UI, plus a notice when a new version is out on GitHub.
  · Verziószám a felületen, és jelzés, ha új verzió jelent meg a GitHubon.
- New default port: 28090 (was 8090). · Új alapértelmezett port: 28090 (korábban 8090).
- Password stored as a PBKDF2 hash. · A jelszót PBKDF2-hashként tárolja.

## 1.0.0

- First version. · Első változat.
