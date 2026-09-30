# 2D simulation view

This React and TypeScript app provides the flood GIS view at `/simulation/`.
FastAPI serves the built files from `frontend/dist/`. The simulation data
copied into the build lives in `public/data/`.

From this directory:

```powershell
npm ci
npm run dev
```

For a production build, run `npm run build`. From the repository root, use
`npm run build` to build both frontends and the Three.js dashboard dependencies.
Start the FastAPI service with `npm start` from the repository root.

The Vite development server proxies `/api` to FastAPI at `127.0.0.1:8050`.
Run `npm run lint` for the frontend lint check.
