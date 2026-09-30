# 2D simulation view

This React and TypeScript app provides the flood GIS view at `/simulation/`.
FastAPI serves the built files from `frontend/dist/`. The simulation data
copied into the build lives in `public/data/`.

From this directory:

```powershell
npm ci
npm run dev
```

For a production build, run `npm run build`. From the repository root, run
`npm ci` then `npm run build`; the root build installs both frontend lockfiles
when their dependencies are absent and builds the Three.js dashboard dependencies.
Start the FastAPI service with `npm start` from the repository root.

When no completed Machhu-II run exists, the view offers a baseline simulation
using the configured project data. It shows solver status and loads the saved
result when the run completes.

The Vite development server proxies `/api` to FastAPI at `127.0.0.1:8050`.
Run `npm run lint` for the frontend lint check.
