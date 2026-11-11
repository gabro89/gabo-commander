# Changelog · Változásnapló

<!-- Write new changes under "Unreleased"; release.sh turns it into the version heading.
     Az új változásokat az „Unreleased” alá írd; a release.sh alakítja verziószámos címmé. -->

## Unreleased

- Lynx-style navigation, can be turned on in the *View* menu: → enters the folder or archive, ← goes to the parent folder.
  · Lynx-navigáció, a *Nézet* menüben kapcsolható be: → belép a mappába vagy archívumba, ← a szülő mappába lép.

## 1.3.1 – 2026-11-11

- The new-version notice shows up within an hour of a release (it used to take up to 6 hours), and *Check for updates* always asks GitHub fresh.
  · Az új verzió jelzése egy órán belül megjelenik (eddig akár 6 óra volt), a *Frissítés keresése* pedig mindig frissen kérdez.

## 1.3.0 – 2026-11-11

- Multi-rename (Ctrl+M) like in Total Commander: mask, counter, date, search and replace (regex too), case, preview, undo.
  · Csoportos átnevezés (Ctrl+M), mint a TC-ben: minta, számláló, dátum, keresés-csere (regex is), kis/nagybetű, előnézet, visszavonás.
- Look inside archives (zip, tar.gz, tar.xz, tar.bz2) like folders: Enter / Ctrl+PgDn, F3, quick view, F5 extracts the selection.
  · Belenézés az archívumokba mappaként: Enter / Ctrl+PgDn, F3, gyorsnézet, F5 a kijelöltek kibontása.

## 1.2.0 – 2026-11-10

- Download folders and multiple items as one zip (Shift+F3). · Mappák és több elem letöltése egy zipként (Shift+F3).
- Pack / unpack: zip, tar.gz, tar.xz, tar.bz2 (Alt+F5 / Alt+F9). · Tömörítés / kicsomagolás: zip, tar.gz, tar.xz, tar.bz2 (Alt+F5 / Alt+F9).
- Filter in the panel (Ctrl+F). · Szűrő a panelen (Ctrl+F).
- Favorite folders, stored on the server (Ctrl+D). · Kedvenc mappák, a szerveren tárolva (Ctrl+D).
- Quick view of images, video, audio, text and PDF in the other panel (Ctrl+Q).
  · Gyorsnézet a másik panelen: kép, videó, hang, szöveg, PDF (Ctrl+Q).
- Dark theme (automatic, light, dark). · Sötét téma (automatikus, világos, sötét).
- Phone layout: one panel with A/B tabs, bigger rows, tap / long-press.
  · Telefonos nézet: egy panel A/B fülekkel, nagyobb sorok, koppintás / hosszú nyomás.
- Sign-ins survive restarts and updates; too many wrong passwords block the address for 15 minutes.
  · A bejelentkezés megmarad újraindítás és frissítés után; a sok hibás jelszó 15 percre letiltja a címet.

## 1.1.1 – 2026-11-10

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
