# Changelog · Változásnapló

<!-- Write new changes under "Unreleased"; release.sh turns it into the version heading.
     Az új változásokat az „Unreleased” alá írd; a release.sh alakítja verziószámos címmé. -->

## Unreleased

- MIT license. · MIT licenc.
- `release.sh`: one command to release a version (VERSION, CHANGELOG, commit, tag, push).
  · `release.sh`: egy paranccsal kiadható egy verzió (VERSION, CHANGELOG, commit, tag, push).
- Every version tag gets a GitHub Release page with its changelog.
  · Minden verziótaghez GitHub Release oldal készül a változásokkal.

## 1.1.0 – 2026-11-10

- English UI next to Hungarian; switch under *View → English / Magyar*. Server messages are translated too.
  · Angol felület a magyar mellett, a *Nézet → Magyar / English* menüben lehet váltani. A szerver üzenetei is fordítva.
- Setup wizard (`install.sh`), also as a one-liner: `curl … | sudo bash`.
  · Telepítő varázsló (`install.sh`), egy sorból is indítható: `curl … | sudo bash`.
- `gabo-commander` management command: `update`, `status`, `check`, `config`, `password`, `logs`, `uninstall`.
  · `gabo-commander` kezelő parancs: `update`, `status`, `check`, `config`, `password`, `logs`, `uninstall`.
- Version number in the UI, plus a notice when a new version is out on GitHub.
  · Verziószám a felületen, és jelzés, ha új verzió jelent meg a GitHubon.
- Default port: 28090. · Alapértelmezett port: 28090.
- Password stored as a PBKDF2 hash. · A jelszót PBKDF2-hashként tárolja.

## 1.0.0

- First version (not published). · Első változat (nem jelent meg).
