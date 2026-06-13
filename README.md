# Koa Builder — Modular Reef Builder

An interactive, browser-based tool for designing modular artificial-reef
structures. Stack reef modules, tune the current/flow simulation, inspect the
build in an orbiting 3D-style view, and save your designs.

## Live demo

If you enable **GitHub Pages** for this repo (Settings → Pages → Deploy from
branch → `main` / root), it will be served at:

```
https://<your-username>.github.io/<repo-name>/
```

No build step is required — `index.html` is the entry point and runs as-is.

## Running locally

Because the app loads `.jsx` files, opening `index.html` directly from the
file system (`file://`) may be blocked by the browser. Serve it over a tiny
local web server instead:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve
```

Then open <http://localhost:8000>.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Entry point — styles + script loading order |
| `reef-app.jsx` | Top-level React app and layout |
| `reef-views.jsx` | Build stage, kit rail, spec / BOM panels |
| `reef-orbit.jsx` | Orbiting "CAD" view of the structure |
| `reef-data.js` | Module catalog and design data |
| `reef-flow.js` | Current / flow simulation logic |
| `tweaks-panel.jsx` | In-app tweak controls |

## How it works

The app uses React and Babel loaded from a CDN and transpiles the JSX in the
browser, so there is **no bundler, no `npm install`, and no compile step**.
Just static files.

## Tech

- React 18 (CDN)
- Babel Standalone (in-browser JSX)
- Plain CSS, no framework
