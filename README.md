# RGB Color Picker

Single-page RGB color picker built with vanilla HTML, CSS, and JavaScript.

## Features

- Hex input with shorthand and partial-state handling
- Manual RGB inputs with live synchronization
- HSV picker with hue slider and saturation/value panel
- Fine-grained RGB grid browsing by plane and step
- Recent colors, favorites, and palette export
- HSL / HSV / RGB / Hex display and copy actions
- EyeDropper support with graceful fallback
- Theme toggle, basic PWA support, and local persistence

## Live Workflow

1. Pick a hue.
2. Refine saturation and value in the 2D panel.
3. Use the local RGB grid for precise adjustments.
4. Copy, favorite, or export the result as needed.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

Open `http://127.0.0.1:4173/index.html` in your browser.

## Test

Run the Playwright test suite:

```bash
npm test
```

## Project Structure

- `index.html` - single-page layout
- `style.css` - responsive styling
- `script.js` - color logic and interactions
- `tests/` - Playwright checks
- `manifest.webmanifest` - PWA manifest
- `service-worker.js` - offline cache support

## Notes

- The app is static and does not require a backend.
- Favorites are persisted in `localStorage`.
- Exported palette files include `JSON`, `TXT`, and `CSS` variable formats.
