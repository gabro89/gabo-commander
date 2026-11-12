# Gabo Commander

**English** · [Magyar](README.hu.md)

A two-panel, Total Commander-style file manager that runs in the browser and manages the files of a Linux server.
It is a single Python file using **only the standard library**: no pip, no npm, no database.
It needs Python 3.8 or newer, which every current Linux distribution ships.

The interface is available in **English and Hungarian**: switch it under *View → English / Magyar*.

## Install

On the Linux server (Ubuntu, Debian, Raspberry Pi OS, Fedora, Arch… anything with systemd):

```bash
curl -fsSL https://raw.githubusercontent.com/gabro89/gabo-commander/main/install.sh | sudo bash
```

or from a clone:

```bash
git clone https://github.com/gabro89/gabo-commander.git
sudo bash gabo-commander/install.sh
```

The **setup wizard** asks a few questions. Press Enter to accept the default for each one:

1. **Language** of the wizard and the default language of the UI
2. **User** the program runs as. It sees and changes files with this user's permissions.
3. **Port**, default **28090**. The wizard checks that the port is free and suggests another one if it isn't.
4. **Where it is reachable from**: the whole network, or only localhost (behind a reverse proxy or SSH tunnel)
5. **Password**, stored as a PBKDF2 hash, never in plain text
6. **Updates**: whether the UI should tell you when a new version is out, and allow updating from there.
   Optionally **automatic updates**: new versions are installed by themselves every night between 4 and 5 am
   (log: `sudo journalctl -u gabo-commander-autoupdate`). Turn it on or off later with `sudo gabo-commander config`.

The wizard also installs missing packages (`python3`, `git`), opens the port in `ufw`/`firewalld` if you ask it to,
and sets the program up as a **systemd service**. The service starts on every boot and is restarted
if it ever stops.

Then open `http://SERVER_IP:28090/` in the browser.

To just **look at the wizard** without installing anything, run `bash install.sh --demo`. It asks every question,
then only lists what it would do. It needs no root or systemd, so it also runs in Git Bash on Windows.

## Update

```bash
sudo gabo-commander update
```

This pulls the latest version from GitHub, prints what changed and restarts the service with your settings.
The current version is shown next to the logo in the UI. When a newer version is available on GitHub,
a green **"New version"** badge appears in the menu bar. Click it and press **"Update now"** to update from the UI:
the server runs the same command, and the page reloads by itself.

The app does not get root rights for this. It only drops a request file into `/var/lib/gabo-commander`, which the
`gabo-commander-update.path` systemd unit watches; that runs `gabo-commander update` as root.
The log is in `/var/log/gabo-commander-update.log`. Turning off the update notice in the wizard turns this off too.
Older installations get it after one `sudo gabo-commander update`.

## Management command

| Command | What it does |
|---|---|
| `gabo-commander status` | is it running, version, address |
| `gabo-commander check` | is there a new version on GitHub |
| `sudo gabo-commander update` | update to the latest version and restart |
| `sudo gabo-commander config` | run the setup wizard again (user, port, password…) |
| `sudo gabo-commander password` | set / change / turn off the password |
| `sudo gabo-commander restart` | restart the service (`start` and `stop` also work) |
| `sudo gabo-commander logs` | follow the log |
| `sudo gabo-commander uninstall` | remove it |

Settings are stored in `/etc/gabo-commander.env` and the program in `/opt/gabo-commander`, which is a git clone.

For an unattended install: `sudo bash install.sh --yes --lang en --user gabor --port 28090`

## Features

- **Panel A and B**: switch between them with Tab or a click. The active panel has a blue header.
  The menu bar (F10), the icon toolbar and the F-key bar at the bottom work like in Total Commander.
- **Lynx-style navigation** (*View* menu, off by default): → enters the folder or archive under the cursor,
  ← goes to the parent folder.
- **Drives** shown as icons at the top of each panel: `/`, home, USB disks, network shares (NFS/SMB/sshfs),
  with **free space** as a bar and percentage.
- Columns: name, extension, **size**, **modified**, **created** date, **permissions** (`rwxr-xr-x`) and owner.
  Click a column header to sort.
- **Selection**: Space, Insert, mouse (Ctrl+click, Shift+click, right button, also dragging), Num+ / Num− by pattern.
  A plain left click only moves the cursor and keeps the selection, like in TC (*View → Left click selects* switches to Windows style).
  Selected items are red. Pressing Space on a folder calculates its size.
- **Copy and move** (F5/F6) run in the background and show **speed**, **time left**
  and **estimated finish time**. If a file already exists at the target, it asks what to do.
- **Drag & drop**: dragging from panel to panel or onto a folder copies, with Shift it moves.
  Files and folders dropped from your computer are uploaded.
- F3 view, F4 text editor, F7 new folder, F8 delete, F9 **permissions** (chmod and chown), F2 rename,
  Ctrl+C/X/V. **F1** lists every shortcut.
- **Download folders**: a folder or several selected items download as one zip (Shift+F3), built on the fly.
- **Look inside archives**: Enter opens a zip or tar(.gz/.xz/.bz2) like a folder, Ctrl+PgDn any zip/tar based
  file too (e.g. .jar, .docx). Inside, F3 and quick view work; F5, drag & drop or Ctrl+C / Ctrl+V extract the selection.
  Archives are read-only. Quick view of an archive lists its contents.
- **Multi-rename** (Ctrl+M), like in Total Commander: name mask (`[N]`, `[N2-5]`, `[E]`, `[C]` counter, `[d]` date,
  `[P]` parent folder, `[U]`/`[L]`/`[F]` case…), search and replace (regular expressions too), case conversion,
  live preview with conflict checks, manual editing of the names and undo.
- **Pack and unpack** (Alt+F5 / Alt+F9): zip, tar.gz, tar.xz, tar.bz2, in the background with progress.
  Unpacking skips paths that would escape the target folder.
- **Filter** (Ctrl+F): show only the items that contain the typed text or match a pattern (`*.jpg; *.png`).
- **Favorite folders** (Ctrl+D, or the ★ button): stored on the server, so they are the same on every device.
- **Quick view** (Ctrl+Q): the other panel previews the file under the cursor: image, video, audio, text, PDF.
- **Light and dark theme**: *View → Theme*. Automatic mode follows the system setting.
- **Columns**: the *Modified*, *Created*, *Perms* and *Owner* columns can be shown or hidden in the *View* menu (the setting is remembered).
- **Phone and tablet**: one panel at a time with A/B tabs, bigger rows. Tap a row to put the cursor on it,
  tap it again to open it, long-press to select.
- Sign-ins survive restarts and updates, and repeated wrong passwords are blocked for 15 minutes.

Try it without installing: `python3 server.py`, then open `http://SERVER_IP:28090/`.

## Permissions

The program accesses files with the permissions of the user it runs as.
Running as your own user, it can only read system files, which is the safe choice.
Running as root, it can see and change everything, but a wrong delete can also do more damage.

## Password and remote access

Use a password even on a home network: `sudo gabo-commander password`.

If you want to reach it from the internet, **do not open the port directly**. Two better options:

- **Tailscale** or a WireGuard VPN: the simplest and the most secure.
- A reverse proxy with HTTPS, e.g. Caddy: `commander.example.com { reverse_proxy localhost:28090 }`.
  In the wizard choose *Only from this machine (127.0.0.1)*, so the program can only be reached through the proxy.

## Releasing a new version (for the developer)

1. While developing, note the changes under `## Unreleased` in `CHANGELOG.md` (optional: if it is empty,
   the commit messages are used).
2. Release with one command (on Windows from Git Bash):
   ```bash
   ./release.sh            # patch: 1.1.0 → 1.1.1   (also: minor, major, or an exact 1.4.0; --dry-run to preview)
   ```
   It updates `VERSION` and `CHANGELOG.md`, commits, creates the `vX.Y.Z` tag and pushes everything.
   GitHub Actions then creates the release page under *Releases*.
3. Servers show the update badge within a day (*Help → Check for updates…* shows it right away). On the server, `sudo gabo-commander update` installs it.

## Files

| File | What it is |
|---|---|
| `server.py` | HTTP server and API; copy and delete jobs run on background threads |
| `static/` | the UI (HTML, JS, CSS, icon) without frameworks; translations in `static/i18n.js` |
| `install.sh` | setup wizard / reinstall as a systemd service |
| `gabo-commander.sh` | the `gabo-commander` management command (update, status, config…) |
| `VERSION`, `CHANGELOG.md` | version number and change history |
| `release.sh` | releases a new version (developer tool) |

## License

[MIT](LICENSE)
