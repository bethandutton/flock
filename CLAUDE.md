# Flock

A small macOS desktop app for running **a whole flock of terminals side by side in one window** — rename and describe each one, resize or reorder them, switch between a compact scrolling layout and a fixed grid, and theme it your way.

This file explains how the project is put together so anyone (human or Claude Code) can find their way around quickly.

---

## Vocabulary

The codebase is themed around a flock of sheep. Three words carry the model:

- **Pen** — one terminal (a header + its shell). Formerly "tab" / "lane".
- **Field** — the area that holds all the pens (`#field`).
- **Flock** — the app itself, and the bridge the renderer talks to (`window.flock`).

Keep this language when adding code — it's part of the project's character.

---

## Running it

```bash
npm install     # installs deps and rebuilds node-pty for Electron (postinstall)
npm start       # launches the app
```

Requirements: Node, and Xcode Command Line Tools (node-pty compiles natively).

There is **no build step or bundler** — the renderer loads plain `.js`/`.css` and the
xterm library straight from `node_modules`. Edit a file, restart with `npm start`.

---

## Architecture

Standard Electron split, kept deliberately small:

| File | Process | Responsibility |
|------|---------|----------------|
| `main.js` | Main | Window, app menu, spawns a real shell per pen via **node-pty**, preferences file, the CPU/memory sampler, and the folder picker. |
| `preload.js` | Bridge | The only channel between renderer and main. Exposes a locked-down `window.flock` API over IPC (contextIsolation is on, nodeIntegration is off). |
| `renderer.js` | Renderer | All the UI: pens, the field, themes, preferences, layouts, reordering, the title/description editor. |
| `index.html` | Renderer | Markup for the titlebar, field, welcome screen, editor and preferences panels. |
| `styles.css` | Renderer | Every style, driven entirely by CSS variables so a theme can restyle the whole app. |

Data flow for a keystroke: xterm (`renderer`) → `window.flock.sendInput` (`preload`) →
`pty-input` (`main`) → the shell. Shell output flows back the other way via `pty-data`.

### Terminals

Each pen owns an xterm.js instance in the renderer and a matching **node-pty** shell in
main, keyed by a pen id (`p1`, `p2`, …). The shell is told `TERM=xterm-256color` and
`COLORTERM=truecolor` so full-colour TUIs (e.g. Claude Code) render correctly.

---

## Theming

Themes live in the `THEMES` object in `renderer.js`. Each theme has two parts:

- `ui` — a map of CSS custom properties (`--bg`, `--accent`, `--accent-hover`, …) applied
  to `:root`. **Every colour in the app, including hover and active states, comes from a
  variable** — never hard-code a colour in `styles.css`.
- `term` — the xterm palette (background, foreground, cursor, 16 ANSI colours).

Built-in themes: **Meadow** (the charcoal + green default), **Dark**, **Light**, **Grass**,
**High Contrast**, and **Custom** (the user picks background/header/text/accent; hovers and
muted tones are derived with the colour helpers at the top of `renderer.js`).

To add a theme: add an entry to `THEMES` with both `ui` and `term`, plus a `swatch` (three
colours) for its Preferences card.

---

## Layouts

Two modes, chosen in Preferences:

- **Compact** — resizable columns with horizontal scroll. Drag a header sideways to reorder;
  drag the right edge of a pen to resize.
- **Fixed** — a non-resizable CSS grid, 1–3 rows × 1–5 columns. Each empty cell has its own
  New/Open buttons to start a terminal there.

`renderField()` is the single place that (re)draws the field for the current mode; it
re-parents the persistent `.pen` elements rather than recreating terminals.

---

## Preferences & persistence

Preferences open from the app menu (**Flock → Preferences…**, ⌘,). They're saved as JSON to
the OS app-data folder — **not** localStorage:

```
~/Library/Application Support/Flock/prefs.json
```

`main.js` reads/writes this file over the `get-prefs` / `save-prefs` IPC channels. Saved
values: theme, custom colours, layout, grid size, terminal font, and the activity-bar toggle.

---

## Conventions

- **Vanilla JS**, no framework, no bundler. Keep it dependency-light.
- **British English** in copy, comments and commit messages.
- All styling through **CSS variables** and existing classes — no inline one-off colours.
- Security: keep `contextIsolation: true` and `nodeIntegration: false`; the renderer only
  ever reaches main through the `window.flock` bridge in `preload.js`.
- Comment the **why**, not the what.

---

## Assets

- `assets/icon.png` / `assets/icon.icns` — the app icon (committed).
- `assets/icon.iconset/` — intermediate frames used to build the `.icns` (git-ignored).
