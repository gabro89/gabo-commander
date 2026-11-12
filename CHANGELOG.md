# Changelog · Változásnapló

<!-- Write new changes under "Unreleased"; release.sh turns it into the version heading.
     Az új változásokat az „Unreleased” alá írd; a release.sh alakítja verziószámos címmé. -->

## Unreleased

- Installer demo: `bash install.sh --demo` walks through the wizard without changing anything (also in Git Bash on Windows).
  The summary table no longer shifts at accented words.
  · Telepítő demó: a `bash install.sh --demo` végigmegy a varázslón, de semmit nem módosít (Windowson Git Bashből is).
  Az összegző táblázat nem csúszik el az ékezetes szavaknál.
- The server checks GitHub for a new version once a day instead of every hour (*Help → Check for updates…* still checks right away).
  · A szerver óránként helyett naponta egyszer nézi meg a GitHubon, van-e új verzió (a *Súgó → Frissítés keresése…* továbbra is azonnal ellenőriz).
- The browser asks about updates only when you open the page or log in, not every hour.
  · A böngésző csak megnyitáskor / belépéskor kérdez rá a frissítésre, óránként nem.
- Installer: new look (header, step indicator, framed summary and address) and an optional **automatic update**
  every night between 4 and 5 am (`sudo gabo-commander config` to turn it on).
  · Telepítő: új külső (fejléc, lépésjelző, keretes összegzés és cím), és kérésre **automatikus frissítés**
  éjszakánként 4 és 5 óra között (bekapcsolás: `sudo gabo-commander config`).

## 1.5.5 – 2026-11-12

- New: the Modified, Created, Perms and Owner columns can be shown or hidden in the *View* menu.
  · Új: a Módosítva, Létrehozva, Jogok és Tulajdonos oszlop a *Nézet* menüben ki- és bekapcsolható.

## 1.5.4 – 2026-11-12

- Left click only moves the cursor and keeps the selection, like in Total Commander (select with the right button, Ctrl+click,
  Shift+click). The old behavior: *View → Left click selects (Windows style)*.
  · A bal klikk csak a kurzort viszi, a kijelölés megmarad, mint a Total Commanderben (jelölés: jobb gomb, Ctrl+klikk,
  Shift+klikk). A régi viselkedés: *Nézet → Bal klikk kijelöl (Windows-stílus)*.

## 1.5.3 – 2026-11-11

- An unreachable network drive (NFS, SMB) no longer blocks the drive bar or ties up the server: it waits at most 1.5 s and shows the last known size.
  · Egy elérhetetlen hálózati meghajtó (NFS, SMB) nem akasztja meg a meghajtósávot és a szervert: legfeljebb 1,5 mp-et vár, és az utolsó ismert méretet mutatja.
- Background tabs ask the server less often. · A háttérben lévő lap ritkábban kérdezi a szervert.
- Code cleanup: duplicated code merged (dark theme CSS, file type detection, dialogs, patterns). · Kódtisztítás: összevont ismétlődő részek (sötét téma, fájltípus, ablakok, minták).

## 1.5.2 – 2026-11-11

- Moving a file onto its own hardlink removes just the source name, and the target keeps the content. Copying onto it has nothing to do.
  Deleting one hardlink still leaves the other one intact.
  · Ha egy fájlt a saját hardlinkjére helyezel át, csak a forrás neve törlődik, a cél tartalma megmarad; másolásnál nincs teendő.
  Egy hardlink törlése továbbra is épen hagyja a másikat.

## 1.5.1 – 2026-11-11

- Fix: going up from a folder no longer jumps to the top of the list; the cursor stays visible on the folder you left.
  · Javítás: mappából kilépve a lista nem ugrik a tetejére, a kurzor látszik azon a mappán, ahonnan jöttél.
- Fix: right-button drag selection no longer skips rows when the mouse moves fast, and scrolls the list at its edges.
  · Javítás: a jobb gombos húzásos kijelölés gyors mozgásnál sem hagy ki sorokat, és a lista szélén görget.
- Fix: moving or overwriting a file onto itself through another path (symlinked folder, hardlink) could empty and delete it.
  · Javítás: ha egy fájlt más úton (symlinkelt mappa, hardlink) önmagára helyeztél át vagy írtál felül, kiürülhetett és törlődhetett.
- Overwriting while copying and saving in the editor go through a temporary file: a full disk or a cancel no longer leaves a broken file.
  · Másoláskor a felülírás és a szerkesztő mentése ideiglenes fájlon át történik: betelt lemez vagy megszakítás nem hagy csonka fájlt.
- Fix: renaming that only changes upper/lower case works on USB, SMB and exFAT drives too.
  · Javítás: a csak kis/nagybetűt változtató átnevezés USB-n, SMB-n és exFAT-on is működik.
- Stuck connections (e.g. a paused video in quick view) are closed after 2 minutes, so they don't keep deleted files open.
  · Az elakadt kapcsolatokat (pl. szüneteltetett videó a gyorsnézetben) 2 perc után lezárja, így nem tartanak nyitva törölt fájlokat.

## 1.5.0 – 2026-11-11

- Update from the UI: *Update now* in the new-version dialog. The app gets no root rights: a systemd unit runs `gabo-commander update`.
  Available after one more `sudo gabo-commander update`.
  · Frissítés a felületről: *Frissítés most* az új verzió ablakában. Az app nem kap root jogot: egy systemd egység futtatja a
  `gabo-commander update`-et. Egy újabb `sudo gabo-commander update` után érhető el.

## 1.4.0 – 2026-11-11

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
