# Gabo Commander

[English](README.md) · **Magyar**

Kétpaneles, Total Commander-szerű fájlkezelő, ami böngészőből fut, és egy Linux szerver fájljait kezeli.
Egyetlen Python-fájl, és **csak a standard könyvtárat használja**: nincs pip, nincs npm, nincs adatbázis.
Python 3.8 vagy újabb kell hozzá, és ez minden mai Linuxon alapból fent van.

A felület **magyarul és angolul** is elérhető, a *Nézet → Magyar / English* menüben lehet váltani.

## Telepítés

A Linux szerveren (Ubuntu, Debian, Raspberry Pi OS, Fedora, Arch… bármi, amin systemd van):

```bash
curl -fsSL https://raw.githubusercontent.com/gabro89/gabo-commander/main/install.sh | sudo bash
```

vagy klónból:

```bash
git clone https://github.com/gabro89/gabo-commander.git
sudo bash gabo-commander/install.sh
```

A **telepítő varázsló** néhány kérdést tesz fel, mindegyiknél Enterrel elfogadhatod az alapértéket:

1. **Nyelv**: a varázsló nyelve és a felület alapnyelve
2. **Felhasználó**, akinek a nevében a program fut: az ő jogaival látja és módosítja a fájlokat
3. **Port**, alapból **28090**. A varázsló megnézi, hogy szabad-e, és ha nem, másikat javasol.
4. **Honnan érhető el**: az egész hálózatról, vagy csak a gépről (fordított proxy vagy SSH-alagút mögött)
5. **Jelszó**: PBKDF2-hashként tárolja, sosem nyílt szövegként
6. **Frissítések**: szóljon-e a felület, ha új verzió jelent meg, és lehessen-e onnan frissíteni

A varázsló a hiányzó csomagokat (`python3`, `git`) is felteszi, kérésre megnyitja a portot az `ufw`/`firewalld`
tűzfalon, és **systemd szolgáltatásként** állítja be a programot. Így **a szerver minden újraindítása után
magától elindul**, és ha valamiért leállna, újraindul.

Ezután a böngészőben a `http://SZERVER_IP:28090/` címen éred el.

## Frissítés

```bash
sudo gabo-commander update
```

Letölti a legújabb verziót a GitHubról, kiírja, mi változott, és a beállításaid megtartásával újraindítja a szolgáltatást.
A felületen a logó mellett látszik a verziószám. Ha a GitHubon újabb verzió van, a menüsorban megjelenik
egy zöld **„Új verzió”** jelvény. Rákattintva a **„Frissítés most”** gombbal a felületről is frissíthetsz:
a szerver ugyanezt a parancsot futtatja le, majd az oldal magától újratöltődik.

A felületről indított frissítéshez az app nem kap root jogot. Csak egy kérésfájlt tesz a
`/var/lib/gabo-commander` mappába, amit a `gabo-commander-update.path` systemd egység figyel, és ez rootként
lefuttatja a `gabo-commander update`-et. A napló: `/var/log/gabo-commander-update.log`.
Ha a varázslóban kikapcsolod a frissítésjelzést, ez is kikapcsol. Régebbi telepítésen egy
`sudo gabo-commander update` után lesz elérhető.

## Kezelő parancs

| Parancs | Mit csinál |
|---|---|
| `gabo-commander status` | fut-e, verzió, elérési cím |
| `gabo-commander check` | van-e új verzió a GitHubon |
| `sudo gabo-commander update` | frissítés a legújabb verzióra és újraindítás |
| `sudo gabo-commander config` | a telepítő varázsló újra (felhasználó, port, jelszó…) |
| `sudo gabo-commander password` | jelszó beállítása / módosítása / kikapcsolása |
| `sudo gabo-commander restart` | újraindítás (`start`, `stop` is van) |
| `sudo gabo-commander logs` | napló követése |
| `sudo gabo-commander uninstall` | eltávolítás |

A beállítások a `/etc/gabo-commander.env` fájlban vannak, a program a `/opt/gabo-commander` mappában (git-klón).

Kérdések nélküli telepítés: `sudo bash install.sh --yes --lang hu --user gabor --port 28090`

## Tudja

- **A és B panel**, Tab-bal vagy kattintással lehet váltani köztük. Az aktív panel fejléce kék.
  A menüsor (F10), az ikonos gombsor és az alsó F-gombsor is a Total Commanderhez hasonló.
- **Lynx-navigáció** (*Nézet* menü, alapból ki): → belép a kurzor alatti mappába vagy archívumba,
  ← a szülő mappába lép.
- **Meghajtók** ikonokkal a panel tetején: `/`, saját mappa, USB-lemezek, hálózati meghajtók (NFS/SMB/sshfs),
  mellettük a **szabad hely** csíkkal és százalékkal.
- Oszlopok: név, kiterjesztés, **méret**, **módosítás**, **létrehozás dátuma**, **jogok** (`rwxr-xr-x`) és tulajdonos.
  Az oszlopfejlécre kattintva rendez.
- **Kijelölés**: Space, Insert, egér (klikk, Ctrl+klikk, Shift+klikk, jobb gomb húzva), Num+ / Num− minta szerint.
  A kijelölt elemek pirosak. Mappán Space-t nyomva kiszámolja a mappa méretét.
- **Másolás és áthelyezés** (F5/F6) háttérben fut, közben látszik a **sebesség**, a **hátralévő idő**
  és a **várható befejezés időpontja**. Ha a célban már van ilyen fájl, rákérdez.
- **Drag & drop**: panelről panelre vagy mappára húzva másol, Shift-tel áthelyez.
  A gépedről ráhúzott fájlokat és mappákat feltölti.
- F3 nézet, F4 szövegszerkesztő, F7 új mappa, F8 törlés, F9 **jogosultságok** (chmod és chown), F2 átnevezés,
  Ctrl+C/X/V. A teljes billentyűlista az **F1**-re jön elő.
- **Mappák letöltése**: egy mappa vagy több kijelölt elem egyetlen zipként töltődik le (Shift+F3), menet közben készül.
- **Tömörítés és kicsomagolás** (Alt+F5 / Alt+F9): zip, tar.gz, tar.xz, tar.bz2, háttérben, folyamatjelzővel.
  Kicsomagoláskor a célmappából kivezető útvonalakat kihagyja.
- **Belenézés az archívumokba**: Enterrel egy zip vagy tar(.gz/.xz/.bz2) mappaként nyílik meg, Ctrl+PgDn-nel
  bármely zip/tar alapú fájl is (pl. .jar, .docx). Benne F3 / gyorsnézet működik, F5-tel, húzással vagy
  Ctrl+C / Ctrl+V-vel a kijelöltek kibonthatók. Az archívum csak olvasható. A gyorsnézet egy archívum tartalmát is mutatja.
- **Csoportos átnevezés** (Ctrl+M), mint a Total Commanderben: névminta (`[N]`, `[N2-5]`, `[E]`, `[C]` számláló,
  `[d]` dátum, `[P]` szülőmappa, `[U]`/`[L]`/`[F]` kis- és nagybetű…), keresés és csere (reguláris kifejezéssel is),
  kis/nagybetű-átalakítás, élő előnézet ütközésjelzéssel, kézi szerkesztés és visszavonás.
- **Szűrő** (Ctrl+F): csak a beírt szövegrészt tartalmazó vagy mintára illő elemek látszanak (`*.jpg; *.png`).
- **Kedvenc mappák** (Ctrl+D vagy a ★ gomb): a szerveren tárolódnak, így minden eszközödön ugyanazok.
- **Gyorsnézet** (Ctrl+Q): a másik panelen előnézet a kurzor alatti fájlról: kép, videó, hang, szöveg, PDF.
- **Világos és sötét téma**: *Nézet → Téma*, automatikus módban a rendszer beállítását követi.
- **Telefon és tablet**: egyszerre egy panel A/B fülekkel, nagyobb sorok. Koppintás: kurzor,
  újabb koppintás: megnyitás, hosszan nyomva: kijelölés.
- A bejelentkezés megmarad újraindítás és frissítés után is, a sok hibás jelszót pedig 15 percre letiltja.

Kipróbálás telepítés nélkül: `python3 server.py --lang hu`, majd `http://SZERVER_IP:28090/`.

## Jogosultságok

A program annak a felhasználónak a jogaival fér hozzá a fájlokhoz, akinek a nevében fut.
Ha a saját felhasználóddal fut, a rendszerfájlokat csak olvasni tudja, és ez így biztonságos.
Rootként mindent lát és módosíthat, viszont ilyenkor egy rossz törlés is komolyabb kárt okoz.

## Jelszó és távoli elérés

Belső hálón is érdemes jelszót beállítani: `sudo gabo-commander password`.

Ha internetről is el akarod érni, **ne nyisd ki közvetlenül a portot**. Két jobb megoldás:

- **Tailscale** vagy WireGuard VPN: ez a legegyszerűbb és a legbiztonságosabb.
- Fordított proxy HTTPS-sel, például Caddy: `commander.domain.hu { reverse_proxy localhost:28090 }`.
  A varázslóban válaszd a *Csak erről a gépről (127.0.0.1)* lehetőséget, így a program csak a proxy felől érhető el.

## Új verzió kiadása (fejlesztőknek)

1. Fejlesztés közben a változásokat a `CHANGELOG.md` `## Unreleased` része alá írd. Ez nem kötelező:
   ha üresen marad, a commitüzenetekből készül a lista.
2. Kiadás egy paranccsal (Windowson Git Bashből):
   ```bash
   ./release.sh            # patch: 1.1.0 → 1.1.1   (vagy: minor, major, pontos szám pl. 1.4.0; --dry-run: csak megmutatja)
   ```
   Átírja a `VERSION`-t és a `CHANGELOG.md`-t, commitol, létrehozza a `vX.Y.Z` taget, és mindent feltölt.
   Utána a GitHub Actions elkészíti a kiadás oldalát a *Releases* alatt.
3. A szervereken néhány órán belül megjelenik a frissítésjelzés. A szerveren a `sudo gabo-commander update` telepíti.

## Fájlok

| Fájl | Mi ez |
|---|---|
| `server.py` | HTTP szerver és API, a másolási és törlési feladatok háttérszálakon |
| `static/` | a felület (HTML, JS, CSS, ikon), keretrendszer nélkül; a fordítások a `static/i18n.js`-ben |
| `install.sh` | telepítő varázsló / újratelepítés systemd szolgáltatásként |
| `gabo-commander.sh` | a `gabo-commander` kezelő parancs (update, status, config…) |
| `VERSION`, `CHANGELOG.md` | verziószám és változásnapló |
| `release.sh` | új verzió kiadása (fejlesztői eszköz) |

## Licenc

[MIT](LICENSE)
