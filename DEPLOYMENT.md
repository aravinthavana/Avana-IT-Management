# Production deployment

The Vercel project uses `frontend` as its root, `npm run build` as the build command,
and `dist` as its output directory. All production API calls use relative `/api/*`
URLs through the rewrite in `frontend/vercel.json`. Production builds deliberately
ignore `VITE_API_URL`, so the existing Render URL in Vercel does not bypass the proxy.
For local development, `VITE_API_URL` can override `http://localhost:8080`.

The Render service uses `backend` as its root, `npm install && npm run build` as
its build command, and `node dist/index.js` as its start command. Configure its
health check as `/api/health` (`/health` is also supported). `/api/users` requires
authentication and is unsuitable as a health check.

The start command does not change the database schema. Review and apply schema
changes separately. This security fix does not require a Prisma schema change.

Keep `NODE_ENV=production` and
`FRONTEND_URL=https://avana-it-management.vercel.app` on Render. Cookies and CSRF
headers use the same origin through Vercel; no cross-site cookie setting is needed.

Before pushing to `main` (which triggers deployment), run:

```powershell
cd backend
node --test tests/security-regressions.test.cjs
npm run build
cd ../frontend
npx tsc --noEmit
npm run build
```

After deployment, verify sign-in, a protected read, and an authenticated update
through the Vercel hostname. Test account disabling and license removal only on an
explicitly authorized test account. Failed cloud actions must leave offboarding
in progress, and failed HR pushes must leave the notification pending.
