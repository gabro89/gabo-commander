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
6. **Update notice**: whether the UI should tell you when a new version is out

The wizard also installs missing packages (`python3`, `git`), opens the port in `ufw`/`firewalld` if you ask it to,
and sets the program up as a **systemd service**. The service starts on every boot and is restarted
if it ever stops.

Then open `http://SERVER_IP:28090/` in the browser.

## Update

```bash
sudo gabo-commander update
```

This pulls the latest version from GitHub, prints what changed and restarts the service with your settings.
The current version is shown next to the logo in the UI. When a newer version is available on GitHub,
a green **"New version"** badge appears in the menu bar.

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
- **Drives** shown as icons at the top of each panel: `/`, home, USB disks, network shares (NFS/SMB/sshfs),
  with **free space** as a bar and percentage.
- Columns: name, extension, **size**, **modified**, **created** date, **permissions** (`rwxr-xr-x`) and owner.
  Click a column header to sort.
- **Selection**: Space, Insert, mouse (click, Ctrl+click, Shift+click, right-button drag), Num+ / Num− by pattern.
  Selected items are red. Pressing Space on a folder calculates its size.
- **Copy and move** (F5/F6) run in the background and show **speed**, **time left**
  and **estimated finish time**. If a file already exists at the target, it asks what to do.
- **Drag & drop**: dragging from panel to panel or onto a folder copies, with Shift it moves.
  Files and folders dropped from your computer are uploaded.
- F3 view, F4 text editor, F7 new folder, F8 delete, F9 **permissions** (chmod and chown), F2 rename,
  Ctrl+C/X/V. **F1** lists every shortcut.

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

1. Raise the number in the `VERSION` file (e.g. `1.1.0` → `1.2.0`) and add a section to `CHANGELOG.md`.
2. `git commit` and `git push` (optionally `git tag v1.2.0 && git push --tags`).
3. Servers show the update badge within a few hours. On the server, `sudo gabo-commander update` installs it.

## Files

| File | What it is |
|---|---|
| `server.py` | HTTP server and API; copy and delete jobs run on background threads |
| `static/` | the UI (HTML, JS, CSS, icon) without frameworks; translations in `static/i18n.js` |
| `install.sh` | setup wizard / reinstall as a systemd service |
| `gabo-commander.sh` | the `gabo-commander` management command (update, status, config…) |
| `VERSION`, `CHANGELOG.md` | version number and change history |
