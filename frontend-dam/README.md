# PRALAYA landing page

This React app provides the landing page at `/` and links to the 2D flood view
at `/simulation/` and the engineering twin at `/twin/twin.html`. FastAPI serves
the built files from `frontend-dam/dist/`.

From this directory:

```powershell
npm ci
npm run dev
```

For a production build, run `npm run build`. From the repository root, run
`npm ci` then `npm run build`; the root build installs both frontend lockfiles
when their dependencies are absent and builds the Three.js dashboard dependencies.
Start the FastAPI service with `npm start` from the repository root.

The Vite development server proxies `/simulation`, `/twin`, `/api`, and `/ws`
to FastAPI at `127.0.0.1:8050`. Run `npm run lint` for the frontend lint check.
