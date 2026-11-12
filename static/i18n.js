/* Gabo Commander – fordítások / translations (hu, en) */
'use strict';

const LANGS = { hu: 'Magyar', en: 'English' };

const I18N = {
  hu: {
    bytes: '{0} bájt',
    server_unreachable: 'A szerver nem érhető el',
    login_title: 'Bejelentkezés', login_btn: 'Belépés', password: 'Jelszó',
    ok: 'OK', cancel: 'Mégse', close: 'Bezár', close_esc: 'Bezárás (Esc)',
    n_items: '{0} elem',
    quoted: '„{0}”',
    and_more: '… és még {0} elem',

    col_n: 'Név', col_e: 'Kit.', col_s: 'Méret', col_m: 'Módosítva', col_b: 'Létrehozva', col_p: 'Jogok', col_o: 'Tulajdonos',
    t_drive: 'Meghajtó választás (Alt+F1 / Alt+F2)', t_usage: 'Foglaltság', t_root: 'Gyökérmappa (Ctrl+\\)',
    t_home: 'Saját mappa', t_up: 'Szülő mappa (Backspace)', t_path: 'Kattints az útvonal beírásához',
    parent_dir: 'Szülő mappa',
    disk_free: '{0} szabad / {1} ({2}% foglalt)',
    free_of: '{0} szabad / {1}',
    quick_search: 'Gyorskeresés', quick_esc: 'Esc: kilépés',
    status: '{0} / {1} kijelölve · {2} / {3} fájl · {4} / {5} mappa',

    /* gombsor, F-gombok */
    tb_refresh: 'Frissítés (Ctrl+R)', tb_hidden: 'Rejtett fájlok mutatása (Ctrl+H)', tb_swap: 'Panelek cseréje (Ctrl+U)',
    tb_same: 'A másik panelen is ez a mappa (Ctrl+=)', tb_mkdir: 'Új mappa (F7)', tb_newfile: 'Új szövegfájl (Shift+F4)',
    tb_edit: 'Szerkesztés (F4)', tb_chmod: 'Jogosultságok (F9)', tb_selpat: 'Csoport kijelölése (Num +)',
    tb_unselpat: 'Csoport kijelölésének törlése (Num −)', tb_invert: 'Kijelölés megfordítása (Num *)',
    tb_sizes: 'Az összes mappa méretének kiszámítása (Alt+Shift+Enter)',
    tb_upload: 'Feltöltés a gépedről (vagy húzd rá a fájlokat a panelre)', tb_download: 'Letöltés a gépedre (Shift+F3)',
    tb_help: 'Billentyűparancsok (F1)', tb_logout: 'Kijelentkezés',
    fk_rename: 'F2 Átnevez', fk_view: 'F3 Nézet', fk_edit: 'F4 Szerkeszt', fk_copy: 'F5 Másol', fk_move: 'F6 Áthelyez',
    fk_mkdir: 'F7 Új mappa', fk_del: 'F8 Töröl', fk_chmod: 'F9 Jogok',

    /* másolás, ütközés */
    pol_ask: 'Rákérdez', pol_overwrite: 'Felülír', pol_skip: 'Kihagy', pol_newer: 'Felülír, ha a forrás újabb', pol_rename: 'Átnevez – „név (2)”',
    copy_title: 'Másolás (F5)', move_title: 'Áthelyezés / átnevezés (F6)', copy_btn: 'Másol', move_btn: 'Áthelyez',
    copy_to: '{0} másolása ide:', move_to: '{0} áthelyezése ide:',
    if_exists: 'Ha a cél már létezik:',
    copy_hint: 'Egy elemnél új nevet is megadhatsz. Relatív útvonal a forrásmappához képest értendő.',

    del_title: 'Törlés (F8)', del_btn: 'Törlés',
    del_one: 'Biztosan <b>véglegesen</b> törlöd ezt az elemet? (Nincs lomtár!)',
    del_many: 'Biztosan <b>véglegesen</b> törlöd ezt a(z) {0} elemet? (Nincs lomtár!)',

    mkdir_title: 'Új mappa (F7)', create_btn: 'Létrehoz', mkdir_label: 'Új mappa neve (alkönyvtárak is: a/b/c):',
    mkdir_exists: 'Ilyen nevű elem már van itt – írj be másik nevet.',
    newfile_title: 'Új fájl (Shift+F4)', newfile_btn: 'Létrehoz és szerkeszt', newfile_label: 'Új fájl neve:', newfile_default: 'uj.txt',
    rename_title: 'Átnevezés (F2 / Shift+F6)', rename_btn: 'Átnevez', rename_label: 'Új név:',
    download_nofile: 'Válassz ki fájlt (mappát még nem lehet letölteni).',

    saved: 'Mentve: {0}',
    unsaved_confirm: 'Mentetlen változások vannak. Bezárod mentés nélkül?',
    edit_title: 'Szerkesztés – {0}', edit_keys: 'Ctrl+S: mentés · Esc: bezárás',
    save_btn: 'Mentés (Ctrl+S)', save_close_btn: 'Mentés és bezárás',

    perm_owner: 'Tulajdonos', perm_group: 'Csoport', perm_others: 'Mások',
    perm_r: 'Olvasás', perm_w: 'Írás', perm_x: 'Futtatás', perm_octal: 'Oktális',
    chmod_title: 'Jogosultságok (F9) – {0}', apply_btn: 'Alkalmaz',
    chmod_recursive: 'Almappákra és fájlokra is (rekurzív)',
    chmod_rec_hint: 'Rekurzív módban a mappák futtatási (x) jogot kapnak, ahol olvasási jog van.',
    chmod_root_hint: 'Tulajdonos/csoport váltáshoz a szervernek rootként kell futnia.',
    bad_octal: 'Hibás oktális jog: {0}',
    n_errors_first: '{0} hiba: {1}',
    chmod_done: '{0} elem jogosultsága módosítva',

    selpat_title: 'Csoport kijelölése (Num +)', unselpat_title: 'Kijelölés törlése (Num −)',
    select_btn: 'Kijelöl', unselect_btn: 'Töröl', pattern_label: 'Minta (pl. *.jpg; *.png):', pattern_dirs: 'Mappákra is',

    clip_copied: '{0} elem másolva – Ctrl+V a beillesztéshez',
    clip_cut: '{0} elem kivágva – Ctrl+V a beillesztéshez',

    home_drive: 'Saját mappa ({0})',
    drive_title_L: 'Meghajtó – bal panel', drive_title_R: 'Meghajtó – jobb panel',

    /* súgó */
    help_title: 'Billentyűparancsok',
    h_move: 'Mozgás a listában (Shift-tel: kijelölés közben)', h_enter_k: 'Enter / dupla klikk', h_enter: 'Mappa megnyitása, fájl megnézése',
    h_up: 'Szülő mappa', h_tab: 'Váltás a két panel között', h_space: 'Kijelölés (mappánál a méretet is kiszámolja)',
    h_insert: 'Kijelölés méretszámítás nélkül', h_selall: 'Mindent kijelöl / kijelölés törlése',
    h_num: 'Csoport kijelölése / törlése / kijelölés megfordítása',
    h_mouse_k: 'Klikk, Ctrl+klikk, Shift+klikk, jobb gomb', h_mouse: 'Klikk: kurzor (a kijelölés marad); Ctrl+klikk: kijelölés; Shift+klikk: tartomány; jobb gomb (húzva is): kijelölés, mint a TC-ben',
    h_type_k: 'Betűk gépelése', h_type: 'Gyorskeresés a névre',
    h_rename: 'Átnevezés', h_view: 'Nézet (új lapon) / letöltés (mappa vagy több elem: zip)', h_edit: 'Szerkesztés / új szövegfájl',
    h_copy: 'Másolás / áthelyezés a másik panelre', h_mkdir: 'Új mappa / törlés', h_chmod: 'Jogosultságok, tulajdonos (chmod / chown)',
    h_clip: 'Fájlok vágólapra / kivágás / beillesztés az aktív panelre', h_drives: 'Meghajtóválasztó a bal / jobb panelhez',
    h_menu: 'Menüsor (nyilakkal, Enterrel)', h_hist: 'Vissza / előre a mappa-előzményekben',
    h_misc: 'Frissítés, rejtett fájlok, panelcsere, azonos mappa', h_root: 'Gyökérmappa',
    h_sizes: 'Az összes mappa méretének kiszámítása',
    h_drag_k: 'Húzás egérrel', h_drag: 'Másolás a másik panelre / mappára; Shift-tel áthelyezés. A gépedről ráhúzott fájlok feltöltődnek.',

    about_title: 'Névjegy', about_desc: 'Kétpaneles fájlkezelő böngészőből.', about_server: 'Szerver: {0}',
    about_version: 'Verzió: {0}', about_latest: 'Legújabb a GitHubon: {0}', about_uptodate: 'Ez a legújabb verzió.',
    about_nocheck: 'A frissítés-ellenőrzés ki van kapcsolva.', about_checkfail: 'Nem sikerült ellenőrizni a frissítést.',
    upd_badge: 'Új verzió: {0}', upd_badge_t: 'Elérhető egy új verzió – kattints a részletekért',
    upd_title: 'Frissítés elérhető', upd_body: 'A Gabo Commander új verziója jelent meg: <b>{1}</b> (most: {0}).',
    upd_howto: 'Frissítés a szerveren, egy paranccsal:', upd_changes: 'Változások', upd_later: 'Később',
    upd_now: 'Frissítés most', upd_self: 'Innen is frissítheted: a szerver letölti az új verziót és újraindul, közben pár másodpercig nem érhető el.',
    upd_or: 'Vagy a szerveren, egy paranccsal:',
    upd_noself: 'Ha ezzel a paranccsal egyszer frissítesz, utána már innen, egy kattintással is lehet.',
    upd_running_title: 'Frissítés', upd_running: '{0} telepítése… Ha kész, az oldal magától újratöltődik.',
    upd_restarting: 'A szerver újraindul…', upd_done: 'Kész: {0}. Újratöltés…',
    upd_failed: 'A frissítés nem sikerült. A napló:',
    upd_timeout: 'A frissítés túl sokáig tart. A szerveren: sudo gabo-commander status',

    /* menü */
    m_files: 'Fájlok', m_mark: 'Jelölés', m_commands: 'Parancsok', m_view: 'Nézet', m_help: 'Súgó',
    mi_rename: 'Átnevezés', mi_view: 'Nézet', mi_edit: 'Szerkesztés', mi_newfile: 'Új szövegfájl', mi_copy: 'Másolás',
    mi_move: 'Áthelyezés', mi_mkdir: 'Új mappa', mi_del: 'Törlés', mi_chmod: 'Jogosultságok, tulajdonos…',
    mi_upload: 'Feltöltés a gépről…', mi_download: 'Letöltés a gépre', mi_logout: 'Kijelentkezés',
    mi_selpat: 'Csoport kijelölése…', mi_unselpat: 'Csoport kijelölésének törlése…', mi_selall: 'Mindet kijelöli',
    mi_selnone: 'Kijelölés törlése', mi_invert: 'Kijelölés megfordítása', mi_sizes: 'Mappaméretek kiszámítása',
    mi_refresh: 'Frissítés', mi_swap: 'Panelek cseréje', mi_same: 'Azonos mappa a másik panelen',
    mi_root: 'Gyökérmappa', mi_home: 'Saját mappa', mi_up: 'Szülő mappa',
    mi_drvL: 'Meghajtó – bal panel…', mi_drvR: 'Meghajtó – jobb panel…',
    mi_hidden: 'Rejtett fájlok', mi_sort_n: 'Rendezés név szerint', mi_sort_e: 'Rendezés kiterjesztés szerint',
    mi_sort_s: 'Rendezés méret szerint', mi_sort_m: 'Rendezés dátum szerint',
    mi_col_m: 'Oszlop: Módosítva', mi_col_b: 'Oszlop: Létrehozva', mi_col_p: 'Oszlop: Jogok', mi_col_o: 'Oszlop: Tulajdonos',
    mi_keys: 'Billentyűparancsok', mi_about: 'Névjegy', mi_update: 'Frissítés keresése…',
    lang_t: 'Nyelv / Language',

    /* feladatok */
    more_jobs: '+ még {0} feladat',
    j_scanning: 'felmérés…', j_waiting: 'döntésre vár',
    j_files: ' · {0} / {1} fájl', j_items: ' · {0} / {1} elem',
    j_scan: 'Felmérés: {0} elem, {1}…', j_ask: 'Ütközés: válassz a felugró ablakban.',
    j_left: 'hátra: {0}', j_eta: 'kész ≈ {0}', j_rate: '{0} elem/s',
    j_done_bytes: 'Kész: {0}, {1} fájl, {2} alatt (átlag {3}/s)', j_done: 'Kész{0}, {1} alatt',
    j_error: 'Befejezve, {0} hibával{1}', j_cancelled: 'Megszakítva',
    j_close: 'Bezárás', j_cancel: 'Megszakítás', j_n_errors: '{0} hiba',
    conflict_title: 'A cél már létezik', conflict_body: '{0} fájl már létezik a célhelyen:',
    c_overwrite_all: 'Mindet felülír', c_newer: 'Ha újabb', c_skip: 'Kihagy', c_rename: 'Átnevez', c_overwrite: 'Felülír',
    cancel_title: 'Megszakítás', cancel_btn: 'Megszakít', continue_btn: 'Folytat', cancel_q: 'Megszakítod?',
    login_required: 'Bejelentkezés szükséges', network_error: 'Hálózati hiba', aborted: 'Megszakítva',
    up_conflict_title: 'Feltöltés – a cél már létezik', up_conflict_body: '{0} elem már létezik itt: {1}',
    up_title: 'Feltöltés: {0} → {1}',

    /* szűrő, kedvencek, gyorsnézet, tömörítés, téma */
    tb_filter: 'Szűrő (Ctrl+F)', tb_qview: 'Gyorsnézet a másik panelen (Ctrl+Q)', tb_fav: 'Kedvenc mappák (Ctrl+D)',
    tb_pack: 'Tömörítés (Alt+F5)', tb_unpack: 'Kicsomagolás (Alt+F9)',
    filter_ph: 'Szűrő: névrészlet vagy minta, pl. *.jpg', filter_close: 'Szűrő kikapcsolása (Esc)', filter_count: '{0} / {1}',
    mi_filter: 'Szűrő…', mi_qview: 'Gyorsnézet', mi_fav: 'Kedvenc mappák…', mi_favadd: 'Mappa felvétele a kedvencek közé',
    mi_pack: 'Tömörítés…', mi_unpack: 'Kicsomagolás…',
    mi_theme_auto: 'Téma: automatikus', mi_theme_light: 'Téma: világos', mi_theme_dark: 'Téma: sötét',
    fav_title: 'Kedvenc mappák', fav_add_btn: 'Ez a mappa is', fav_added: 'Felvéve a kedvencek közé: {0}',
    fav_exists: 'Ez a mappa már a kedvencek között van.', fav_remove: 'Eltávolítás (Delete)',
    fav_hint: 'Enter: megnyitás · Delete: eltávolítás · minden eszközödön ugyanezek látszanak',
    fav_empty: 'Még nincs kedvenc mappa. Az „Ez a mappa is” gombbal veheted fel az aktuálisat.',
    pack_title: 'Tömörítés (Alt+F5)', pack_btn: 'Tömörít', pack_what: '{0} tömörítése ide:', pack_format: 'Formátum:',
    unpack_title: 'Kicsomagolás (Alt+F9)', unpack_btn: 'Kicsomagol', unpack_to: '{0} kicsomagolása ide:',
    unpack_subdir: 'Archívumonként külön mappába (az archívum nevével)',
    unpack_none: 'Válassz ki archívumot (zip, tar, tar.gz, tar.xz, tar.bz2).',
    qv_dir: 'Mappa – Space: a méretének kiszámítása', qv_dir_size: 'Mappa, mérete: {0}',
    h_pack: 'Tömörítés / kicsomagolás (zip, tar.gz, tar.xz)', h_filter: 'Szűrő: csak a szövegrészt tartalmazó vagy mintára illő elemek (Esc: ki)',
    h_fav: 'Kedvenc mappák', h_qview: 'Gyorsnézet: kép, videó, hang, szöveg, PDF a másik panelen',

    /* csoportos átnevezés */
    mi_multirename: 'Csoportos átnevezés…', tb_multirename: 'Csoportos átnevezés (Ctrl+M)',
    h_multirename: 'Csoportos átnevezés: minta, számláló, dátum, keresés-csere (regex is), kis/nagybetű',
    mr_title: 'Csoportos átnevezés (Ctrl+M) – {0} elem',
    mr_mask: 'Névminta:', mr_ext: 'Kiterjesztés:', mr_ins: 'Beszúrás:',
    mr_search: 'Keresés:', mr_replace: 'Csere erre:',
    mr_regex: 'Reguláris kifejezés ($1 a cserében)', mr_cs: 'Kis/nagybetű számít', mr_first: 'Csak az első találat',
    mr_case: 'Kis- és nagybetűk:', mr_case_keep: 'változatlan', mr_case_lower: 'mind kisbetű', mr_case_upper: 'MIND NAGYBETŰ',
    mr_case_first: 'Első betű nagy', mr_case_words: 'Minden Szó Nagybetűvel',
    mr_counter: 'Számláló [C]:', mr_start: 'Kezdet', mr_step: 'Lépés', mr_digits: 'Jegyek',
    mr_old: 'Régi név', mr_new: 'Új név',
    mr_btn: 'Átnevez', mr_reset: 'Alaphelyzet', mr_edit: 'Nevek szerkesztése…', mr_undo: 'Visszavonás ({0})',
    mr_stat: '{0} elem · {1} változik', mr_stat_err: '{0} hiba – javítsd, különben nem indul',
    mr_err_dup: 'ismétlődő név', mr_err_exists: 'már létezik', mr_err_bad: 'érvénytelen név', mr_err_long: 'túl hosszú',
    mr_bad_re: 'Hibás reguláris kifejezés: {0}',
    mr_manual: 'Kézzel szerkesztett lista – a szabályok most nem számítanak.', mr_manual_off: 'Vissza a szabályokhoz',
    mr_edit_title: 'Új nevek – soronként egy', mr_edit_hint: '{0} sor kell, ugyanabban a sorrendben, mint a listában.',
    mr_edit_count: 'A sorok száma ({0}) nem egyezik az elemek számával ({1}).',
    mr_done: '{0} elem átnevezve', mr_undone: 'Visszavonva: {0} elem',
    mr_help_t: 'Helyettesítők',
    mr_help: '<b>[N]</b> név (kiterjesztés nélkül) · <b>[N2-5]</b> a 2–5. karakter · <b>[N2,3]</b> 3 karakter a 2.-tól · <b>[N3-]</b> a 3.-tól a végéig · <b>[N-3-]</b> az utolsó 3 karakter'
      + '<br><b>[E]</b> kiterjesztés (ugyanígy: [E1-2]) · <b>[P]</b> szülőmappa neve · <b>[G]</b> a nagyszülőé'
      + '<br><b>[C]</b> számláló a lenti beállítással · <b>[C10+5:3]</b> 10-től, ötösével, 3 jegyen'
      + '<br><b>[d]</b> módosítás dátuma (ÉÉÉÉ-HH-NN) · <b>[t]</b> ideje (óó.pp.mm) · <b>[Y] [y] [M] [D] [h] [m] [s]</b> év, hónap, nap, óra, perc, mp'
      + '<br><b>[U]</b> NAGYBETŰ, <b>[L]</b> kisbetű, <b>[F]</b> Szavak Elején Nagy, <b>[n]</b> változatlan – innentől a minta végéig'
      + '<br><b>[[]</b> és <b>[]]</b>: szögletes zárójel · sima keresésnél több szó is lehet | jellel: <i>a|b</i> → <i>x|y</i>',

    /* archívum böngészése */
    arc_readonly: 'Az archívum csak olvasható – F5-tel (vagy húzással) bonthatod ki a kijelölteket.',
    arc_status: 'archívum, csak olvasható – F5: kibontás',
    arc_nozip: 'Archívumból egyszerre egy fájl tölthető le. Mappát vagy több elemet F5-tel bonts ki.',
    extract_title: 'Kibontás (F5)', extract_btn: 'Kibont', extract_to: '{0} kibontása ide:',
    qv_arc: '{0} fájl, {1} mappa a gyökérben · kibontva {2}', qv_arc_enter: 'Enter: belenézés',
    mi_lynx: 'Lynx-navigáció (nyilakkal be / ki)', lynx_on: 'Lynx-navigáció bekapcsolva: → belép a mappába, ← a szülő mappába',
    lynx_off: 'Lynx-navigáció kikapcsolva',
    mi_leftsel: 'Bal klikk kijelöl (Windows-stílus)',
    leftsel_on: 'Windows-stílus: a bal klikk kijelöl, és törli a korábbi kijelölést',
    leftsel_off: 'TC-stílus: a bal klikk csak a kurzort viszi, a kijelölés marad (jelölés: jobb gomb, Ctrl+klikk)',
    h_lynx: 'Lynx-navigáció (Nézet menü, alapból ki): ← szülő mappa, → belépés a mappába vagy archívumba',
    h_arc_k: 'Enter / Ctrl+PgDn', h_arc: 'Belenézés egy archívumba (zip, tar…), mint egy mappába; Ctrl+PgDn: bármely fájl (pl. .jar, .docx). F5: kibontás',
  },

  en: {
    bytes: '{0} bytes',
    server_unreachable: 'The server cannot be reached',
    login_title: 'Sign in', login_btn: 'Sign in', password: 'Password',
    ok: 'OK', cancel: 'Cancel', close: 'Close', close_esc: 'Close (Esc)',
    n_items: n => (n === 1 ? '1 item' : `${n} items`),
    quoted: '“{0}”',
    and_more: n => `… and ${n} more`,

    col_n: 'Name', col_e: 'Ext', col_s: 'Size', col_m: 'Modified', col_b: 'Created', col_p: 'Perms', col_o: 'Owner',
    t_drive: 'Choose drive (Alt+F1 / Alt+F2)', t_usage: 'Usage', t_root: 'Root folder (Ctrl+\\)',
    t_home: 'Home folder', t_up: 'Parent folder (Backspace)', t_path: 'Click to type a path',
    parent_dir: 'Parent folder',
    disk_free: '{0} free of {1} ({2}% used)',
    free_of: '{0} free of {1}',
    quick_search: 'Quick search', quick_esc: 'Esc: exit',
    status: (a, b, c, d, e, f) => `${a} / ${b} selected · ${c} / ${d} files · ${e} / ${f} folders`,

    tb_refresh: 'Refresh (Ctrl+R)', tb_hidden: 'Show hidden files (Ctrl+H)', tb_swap: 'Swap panels (Ctrl+U)',
    tb_same: 'Same folder in the other panel (Ctrl+=)', tb_mkdir: 'New folder (F7)', tb_newfile: 'New text file (Shift+F4)',
    tb_edit: 'Edit (F4)', tb_chmod: 'Permissions (F9)', tb_selpat: 'Select group (Num +)',
    tb_unselpat: 'Unselect group (Num −)', tb_invert: 'Invert selection (Num *)',
    tb_sizes: 'Calculate the size of all folders (Alt+Shift+Enter)',
    tb_upload: 'Upload from your computer (or drop files onto a panel)', tb_download: 'Download to your computer (Shift+F3)',
    tb_help: 'Keyboard shortcuts (F1)', tb_logout: 'Sign out',
    fk_rename: 'F2 Rename', fk_view: 'F3 View', fk_edit: 'F4 Edit', fk_copy: 'F5 Copy', fk_move: 'F6 Move',
    fk_mkdir: 'F7 New folder', fk_del: 'F8 Delete', fk_chmod: 'F9 Perms',

    pol_ask: 'Ask', pol_overwrite: 'Overwrite', pol_skip: 'Skip', pol_newer: 'Overwrite if the source is newer', pol_rename: 'Rename – “name (2)”',
    copy_title: 'Copy (F5)', move_title: 'Move / rename (F6)', copy_btn: 'Copy', move_btn: 'Move',
    copy_to: 'Copy {0} to:', move_to: 'Move {0} to:',
    if_exists: 'If the target already exists:',
    copy_hint: 'For a single item you can also give a new name. Relative paths are relative to the source folder.',

    del_title: 'Delete (F8)', del_btn: 'Delete',
    del_one: 'Delete this item <b>permanently</b>? (There is no trash!)',
    del_many: 'Delete these {0} items <b>permanently</b>? (There is no trash!)',

    mkdir_title: 'New folder (F7)', create_btn: 'Create', mkdir_label: 'New folder name (subfolders too: a/b/c):',
    mkdir_exists: 'An item with this name is already here – type another name.',
    newfile_title: 'New file (Shift+F4)', newfile_btn: 'Create and edit', newfile_label: 'New file name:', newfile_default: 'new.txt',
    rename_title: 'Rename (F2 / Shift+F6)', rename_btn: 'Rename', rename_label: 'New name:',
    download_nofile: 'Select a file (folders cannot be downloaded yet).',

    saved: 'Saved: {0}',
    unsaved_confirm: 'There are unsaved changes. Close without saving?',
    edit_title: 'Edit – {0}', edit_keys: 'Ctrl+S: save · Esc: close',
    save_btn: 'Save (Ctrl+S)', save_close_btn: 'Save and close',

    perm_owner: 'Owner', perm_group: 'Group', perm_others: 'Others',
    perm_r: 'Read', perm_w: 'Write', perm_x: 'Execute', perm_octal: 'Octal',
    chmod_title: 'Permissions (F9) – {0}', apply_btn: 'Apply',
    chmod_recursive: 'Apply to subfolders and files too (recursive)',
    chmod_rec_hint: 'In recursive mode folders get execute (x) permission wherever they have read permission.',
    chmod_root_hint: 'Changing the owner/group requires the server to run as root.',
    bad_octal: 'Invalid octal mode: {0}',
    n_errors_first: (n, m) => `${n} error${n === 1 ? '' : 's'}: ${m}`,
    chmod_done: n => `Permissions changed on ${n} item${n === 1 ? '' : 's'}`,

    selpat_title: 'Select group (Num +)', unselpat_title: 'Unselect group (Num −)',
    select_btn: 'Select', unselect_btn: 'Unselect', pattern_label: 'Pattern (e.g. *.jpg; *.png):', pattern_dirs: 'Include folders',

    clip_copied: n => `${n} item${n === 1 ? '' : 's'} copied – Ctrl+V to paste`,
    clip_cut: n => `${n} item${n === 1 ? '' : 's'} cut – Ctrl+V to paste`,

    home_drive: 'Home folder ({0})',
    drive_title_L: 'Drive – left panel', drive_title_R: 'Drive – right panel',

    help_title: 'Keyboard shortcuts',
    h_move: 'Move in the list (with Shift: select while moving)', h_enter_k: 'Enter / double click', h_enter: 'Open folder, view file',
    h_up: 'Parent folder', h_tab: 'Switch between the two panels', h_space: 'Select (for folders it also calculates the size)',
    h_insert: 'Select without size calculation', h_selall: 'Select all / clear selection',
    h_num: 'Select group / unselect group / invert selection',
    h_mouse_k: 'Click, Ctrl+click, Shift+click, right button', h_mouse: 'Click: cursor (the selection stays); Ctrl+click: select; Shift+click: range; right button (also dragging): select like in TC',
    h_type_k: 'Typing letters', h_type: 'Quick search by name',
    h_rename: 'Rename', h_view: 'View (in a new tab) / download (folder or several items: zip)', h_edit: 'Edit / new text file',
    h_copy: 'Copy / move to the other panel', h_mkdir: 'New folder / delete', h_chmod: 'Permissions, owner (chmod / chown)',
    h_clip: 'Copy / cut files to the clipboard / paste into the active panel', h_drives: 'Drive menu for the left / right panel',
    h_menu: 'Menu bar (arrows, Enter)', h_hist: 'Back / forward in folder history',
    h_misc: 'Refresh, hidden files, swap panels, same folder', h_root: 'Root folder',
    h_sizes: 'Calculate the size of all folders',
    h_drag_k: 'Mouse drag', h_drag: 'Copy to the other panel / a folder; with Shift: move. Files dropped from your computer are uploaded.',

    about_title: 'About', about_desc: 'Two-panel file manager in the browser.', about_server: 'Server: {0}',
    about_version: 'Version: {0}', about_latest: 'Latest on GitHub: {0}', about_uptodate: 'This is the latest version.',
    about_nocheck: 'Update checking is turned off.', about_checkfail: 'Could not check for updates.',
    upd_badge: 'New version: {0}', upd_badge_t: 'A new version is available – click for details',
    upd_title: 'Update available', upd_body: 'A new version of Gabo Commander is out: <b>{1}</b> (current: {0}).',
    upd_howto: 'Update on the server with one command:', upd_changes: 'Changes', upd_later: 'Later',
    upd_now: 'Update now', upd_self: 'You can update from here: the server downloads the new version and restarts, so it is unreachable for a few seconds.',
    upd_or: 'Or on the server with one command:',
    upd_noself: 'After you update once with this command, you can update from here with one click.',
    upd_running_title: 'Updating', upd_running: 'Installing {0}… The page reloads by itself when it is done.',
    upd_restarting: 'The server is restarting…', upd_done: 'Done: {0}. Reloading…',
    upd_failed: 'The update failed. The log:',
    upd_timeout: 'The update is taking too long. On the server: sudo gabo-commander status',

    m_files: 'Files', m_mark: 'Mark', m_commands: 'Commands', m_view: 'View', m_help: 'Help',
    mi_rename: 'Rename', mi_view: 'View', mi_edit: 'Edit', mi_newfile: 'New text file', mi_copy: 'Copy',
    mi_move: 'Move', mi_mkdir: 'New folder', mi_del: 'Delete', mi_chmod: 'Permissions, owner…',
    mi_upload: 'Upload from computer…', mi_download: 'Download to computer', mi_logout: 'Sign out',
    mi_selpat: 'Select group…', mi_unselpat: 'Unselect group…', mi_selall: 'Select all',
    mi_selnone: 'Clear selection', mi_invert: 'Invert selection', mi_sizes: 'Calculate folder sizes',
    mi_refresh: 'Refresh', mi_swap: 'Swap panels', mi_same: 'Same folder in the other panel',
    mi_root: 'Root folder', mi_home: 'Home folder', mi_up: 'Parent folder',
    mi_drvL: 'Drive – left panel…', mi_drvR: 'Drive – right panel…',
    mi_hidden: 'Hidden files', mi_sort_n: 'Sort by name', mi_sort_e: 'Sort by extension',
    mi_sort_s: 'Sort by size', mi_sort_m: 'Sort by date',
    mi_col_m: 'Column: Modified', mi_col_b: 'Column: Created', mi_col_p: 'Column: Perms', mi_col_o: 'Column: Owner',
    mi_keys: 'Keyboard shortcuts', mi_about: 'About', mi_update: 'Check for updates…',
    lang_t: 'Language / Nyelv',

    more_jobs: n => `+ ${n} more task${n === 1 ? '' : 's'}`,
    j_scanning: 'scanning…', j_waiting: 'waiting for you',
    j_files: ' · {0} / {1} files', j_items: ' · {0} / {1} items',
    j_scan: 'Scanning: {0} items, {1}…', j_ask: 'Conflict: choose in the dialog.',
    j_left: 'left: {0}', j_eta: 'done ≈ {0}', j_rate: '{0} items/s',
    j_done_bytes: (a, n, d, s) => `Done: ${a}, ${n} file${n === 1 ? '' : 's'} in ${d} (avg. ${s}/s)`, j_done: 'Done{0} in {1}',
    j_error: (n, f) => `Finished with ${n} error${n === 1 ? '' : 's'}${f}`, j_cancelled: 'Cancelled',
    j_close: 'Close', j_cancel: 'Cancel', j_n_errors: n => `${n} error${n === 1 ? '' : 's'}`,
    conflict_title: 'The target already exists',
    conflict_body: n => (n === 1 ? '1 file already exists at the target:' : `${n} files already exist at the target:`),
    c_overwrite_all: 'Overwrite all', c_newer: 'If newer', c_skip: 'Skip', c_rename: 'Rename', c_overwrite: 'Overwrite',
    cancel_title: 'Cancel', cancel_btn: 'Cancel task', continue_btn: 'Continue', cancel_q: 'Cancel this task?',
    login_required: 'Sign-in required', network_error: 'Network error', aborted: 'Cancelled',
    up_conflict_title: 'Upload – the target already exists',
    up_conflict_body: (n, d) => `${n} item${n === 1 ? ' already exists' : 's already exist'} in: ${d}`,
    up_title: 'Upload: {0} → {1}',

    tb_filter: 'Filter (Ctrl+F)', tb_qview: 'Quick view in the other panel (Ctrl+Q)', tb_fav: 'Favorite folders (Ctrl+D)',
    tb_pack: 'Pack (Alt+F5)', tb_unpack: 'Unpack (Alt+F9)',
    filter_ph: 'Filter: part of the name or a pattern, e.g. *.jpg', filter_close: 'Turn off the filter (Esc)', filter_count: '{0} / {1}',
    mi_filter: 'Filter…', mi_qview: 'Quick view', mi_fav: 'Favorite folders…', mi_favadd: 'Add folder to favorites',
    mi_pack: 'Pack…', mi_unpack: 'Unpack…',
    mi_theme_auto: 'Theme: automatic', mi_theme_light: 'Theme: light', mi_theme_dark: 'Theme: dark',
    fav_title: 'Favorite folders', fav_add_btn: 'Add this folder', fav_added: 'Added to favorites: {0}',
    fav_exists: 'This folder is already a favorite.', fav_remove: 'Remove (Delete)',
    fav_hint: 'Enter: open · Delete: remove · the same list on all your devices',
    fav_empty: 'No favorite folders yet. Add the current one with “Add this folder”.',
    pack_title: 'Pack (Alt+F5)', pack_btn: 'Pack', pack_what: 'Pack {0} into:', pack_format: 'Format:',
    unpack_title: 'Unpack (Alt+F9)', unpack_btn: 'Unpack', unpack_to: 'Unpack {0} to:',
    unpack_subdir: 'Into a separate folder per archive (named after it)',
    unpack_none: 'Select an archive (zip, tar, tar.gz, tar.xz, tar.bz2).',
    qv_dir: 'Folder – Space: calculate its size', qv_dir_size: 'Folder, size: {0}',
    h_pack: 'Pack / unpack (zip, tar.gz, tar.xz)', h_filter: 'Filter: show only items containing the text or matching a pattern (Esc: off)',
    h_fav: 'Favorite folders', h_qview: 'Quick view: image, video, audio, text, PDF in the other panel',

    mi_multirename: 'Multi-rename…', tb_multirename: 'Multi-rename (Ctrl+M)',
    h_multirename: 'Multi-rename: mask, counter, date, search and replace (regex too), upper/lower case',
    mr_title: n => `Multi-rename (Ctrl+M) – ${n} item${n === 1 ? '' : 's'}`,
    mr_mask: 'Name mask:', mr_ext: 'Extension:', mr_ins: 'Insert:',
    mr_search: 'Search for:', mr_replace: 'Replace with:',
    mr_regex: 'Regular expression ($1 in the replacement)', mr_cs: 'Match case', mr_first: 'First match only',
    mr_case: 'Upper / lower case:', mr_case_keep: 'unchanged', mr_case_lower: 'all lowercase', mr_case_upper: 'ALL UPPERCASE',
    mr_case_first: 'First letter uppercase', mr_case_words: 'Each Word Capitalized',
    mr_counter: 'Counter [C]:', mr_start: 'Start', mr_step: 'Step', mr_digits: 'Digits',
    mr_old: 'Old name', mr_new: 'New name',
    mr_btn: 'Rename', mr_reset: 'Reset', mr_edit: 'Edit names…', mr_undo: 'Undo ({0})',
    mr_stat: (n, c) => `${n} item${n === 1 ? '' : 's'} · ${c} will change`,
    mr_stat_err: n => `${n} problem${n === 1 ? '' : 's'} – fix ${n === 1 ? 'it' : 'them'} to start`,
    mr_err_dup: 'duplicate name', mr_err_exists: 'already exists', mr_err_bad: 'invalid name', mr_err_long: 'too long',
    mr_bad_re: 'Invalid regular expression: {0}',
    mr_manual: 'Manually edited list – the rules are not used now.', mr_manual_off: 'Back to the rules',
    mr_edit_title: 'New names – one per line', mr_edit_hint: '{0} lines are needed, in the same order as in the list.',
    mr_edit_count: 'The number of lines ({0}) does not match the number of items ({1}).',
    mr_done: n => `${n} item${n === 1 ? '' : 's'} renamed`, mr_undone: n => `Undone: ${n} item${n === 1 ? '' : 's'}`,
    mr_help_t: 'Placeholders',
    mr_help: '<b>[N]</b> name (without extension) · <b>[N2-5]</b> characters 2–5 · <b>[N2,3]</b> 3 characters from the 2nd · <b>[N3-]</b> from the 3rd to the end · <b>[N-3-]</b> the last 3 characters'
      + '<br><b>[E]</b> extension (also [E1-2]) · <b>[P]</b> parent folder name · <b>[G]</b> grandparent folder name'
      + '<br><b>[C]</b> counter with the settings below · <b>[C10+5:3]</b> from 10, step 5, 3 digits'
      + '<br><b>[d]</b> modification date (YYYY-MM-DD) · <b>[t]</b> time (hh.mm.ss) · <b>[Y] [y] [M] [D] [h] [m] [s]</b> year, month, day, hour, minute, second'
      + '<br><b>[U]</b> UPPERCASE, <b>[L]</b> lowercase, <b>[F]</b> Each Word Capitalized, <b>[n]</b> unchanged – from there to the end of the mask'
      + '<br><b>[[]</b> and <b>[]]</b>: square brackets · plain search takes several words separated by |: <i>a|b</i> → <i>x|y</i>',

    arc_readonly: 'Archives are read-only – press F5 (or drag) to extract the selection.',
    arc_status: 'archive, read-only – F5: extract',
    arc_nozip: 'From an archive you can download one file at a time. Extract folders or several items with F5.',
    extract_title: 'Extract (F5)', extract_btn: 'Extract', extract_to: 'Extract {0} to:',
    qv_arc: (f, d, s) => `${f} file${f === 1 ? '' : 's'}, ${d} folder${d === 1 ? '' : 's'} at the top · ${s} unpacked`,
    qv_arc_enter: 'Enter: look inside',
    mi_lynx: 'Lynx-style navigation (arrows in / out)', lynx_on: 'Lynx-style navigation on: → enters the folder, ← goes to the parent',
    lynx_off: 'Lynx-style navigation off',
    mi_leftsel: 'Left click selects (Windows style)',
    leftsel_on: 'Windows style: left click selects and clears the previous selection',
    leftsel_off: 'TC style: left click only moves the cursor, the selection stays (select: right button, Ctrl+click)',
    h_lynx: 'Lynx-style navigation (View menu, off by default): ← parent folder, → into the folder or archive',
    h_arc_k: 'Enter / Ctrl+PgDn', h_arc: 'Look inside an archive (zip, tar…) like a folder; Ctrl+PgDn: any file (e.g. .jar, .docx). F5: extract',
  },
};

function pickLang(serverDefault) {
  let l = null;
  try { l = JSON.parse(localStorage.getItem('gc.lang')); } catch (e) { /* privát mód / private mode */ }
  if (I18N[l]) return l;
  if (I18N[serverDefault]) return serverDefault;
  return /^hu\b/i.test(navigator.language || '') ? 'hu' : 'en';
}

let LANG = pickLang(null);

/* t('key', arg0, arg1…) – a {0}, {1} helyére az argumentumok kerülnek; a függvény értékű kulcsok többes számot kezelnek */
function t(key, ...args) {
  let s = I18N[LANG] && I18N[LANG][key];
  if (s == null) s = I18N.en[key] != null ? I18N.en[key] : key;
  if (typeof s === 'function') return s(...args);
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[i] != null ? args[i] : '')) : s;
}

function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}
