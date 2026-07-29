# Deriv Trading Bot

A visual trading-bot builder on the Deriv WebSocket API. Drag-and-drop strategy building with Blockly, SmartCharts integration, automated strategy execution, and a dashboard with tutorials.

## Stack

- **Frontend:** React + TypeScript, Rsbuild (not Next.js)
- **Charts:** `@deriv-com/smartcharts-champion`
- **Strategy editor:** Blockly
- **Styling:** SASS + CSS variables (generated from `brand.config.json`)

## Running the app

```bash
npm run dev        # dev server on port 5000 (Replit workflow)
npm run build      # production build → dist/
```

The Replit workflow `Start application` runs `./node_modules/.bin/rsbuild dev --port 5000` and hot-reloads on changes.

## Environment variables / secrets

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DERIV_APP_ID` | ✅ Yes | Deriv App ID — enables OAuth login/WS connections |
| `NEXT_PUBLIC_DERIV_ENV` | No | `production` or `staging` (default: production) |
| `NEXT_PUBLIC_DERIV_REFERRAL_LINK` | No | Affiliate referral link |
| `GD_CLIENT_ID` / `GD_APP_ID` / `GD_API_KEY` | No | Google Drive integration for saving/loading strategies |

> Variables are **baked in at build time** via `rsbuild.config.ts` `source.define`. After changing a secret, restart the workflow to rebuild.

## Branding

Edit `brand.config.json` to change colors, fonts, and app name. Run `npm run generate:brand-css` to apply (runs automatically on `npm install`, `npm run dev`, `npm run build`).

Drop a `public/logo.<png|jpg|jpeg|webp>` to set a custom header logo/favicon.

## User preferences

- Keep project's existing Rsbuild + React Router structure (not Next.js).
