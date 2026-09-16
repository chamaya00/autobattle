# Deploying to Vercel: internal dev + public prod

Two Vercel **projects**, same repo, same build. They end up serving byte-identical sites;
the only difference is who can reach each URL. See `docs/decisions/0001-dual-vercel-environments.md`
for why it's built this way.

| | Project name (suggested) | Production branch | Who can open it |
|---|---|---|---|
| **Prod** | `multiverse-battler` | `main` | anyone — this is the public link |
| **Dev**  | `multiverse-battler-dev` | `dev` | your team only, behind a password |

Both projects read `vercel.json` at the repo root, which runs `tools/vercel_build.sh` and
publishes the `site/` directory it produces (public play page at `/`, workshop at `/studio/`
— the same layout GitHub Pages already serves). Nothing in the repo differs between the two
environments; everything below happens in the Vercel dashboard.

## 0. Create the `dev` branch (once)

```bash
git checkout main
git pull
git checkout -b dev
git push -u origin dev
```

From then on: merge to `dev` first to preview on the internal URL, then merge/fast-forward
`dev` into `main` (or open a PR from `dev` → `main`) to promote to the public URL.

## 1. Import the repo twice

In the [Vercel dashboard](https://vercel.com/new), **Add New → Project**, import
`chamaya00/autobattle` — do this **twice**, once per project below. Vercel allows the same
GitHub repo to back more than one project.

### Project A — prod (public)

- Name: `multiverse-battler` (or whatever you want the `.vercel.app` subdomain to be).
- Framework Preset: **Other** (the repo's `vercel.json` already sets `"framework": null`,
  so this should auto-detect).
- Production Branch: Settings → Git → **`main`**.
- Environment Variables: none needed. Leaving `DEV_BASIC_AUTH_USER` / `DEV_BASIC_AUTH_PASS`
  unset here is what keeps this project public — see `middleware.js`.
- Deploy. The public play page is now at `https://multiverse-battler.vercel.app/`
  (add a custom domain under Settings → Domains if you have one).

### Project B — dev (internal only)

- Name: `multiverse-battler-dev`.
- Framework Preset: **Other**, same as above.
- Production Branch: Settings → Git → **`dev`**.
- Settings → Environment Variables, add for the **Production** environment:
  - `DEV_BASIC_AUTH_USER` — a username for the team (e.g. `team`).
  - `DEV_BASIC_AUTH_PASS` — a real password/passphrase. Treat it like a credential — do not
    commit it anywhere; Vercel stores it encrypted and only injects it at request time.
- Deploy (push to `dev` if nothing has landed there yet — Vercel needs at least one commit on
  the production branch to build). Every request to
  `https://multiverse-battler-dev.vercel.app/*` now gets an HTTP Basic Auth prompt; only the
  user/pass you set above gets through. Change either value in the dashboard any time to
  rotate credentials — no redeploy needed, `middleware.js` reads them at request time.

Rotate the password by editing the env var in the dashboard (Settings → Environment
Variables → edit `DEV_BASIC_AUTH_PASS`) — no code change or redeploy required.

## 2. Optional: stack Vercel's own protection on top

If the Vercel account is on a paid plan, Settings → Deployment Protection on the **dev**
project can additionally enable "Vercel Authentication" (restrict to people signed into the
Vercel team) or "Password Protection." These are independent of `middleware.js` and layer on
top of it — enabling them does not require touching any file in this repo.

## 3. Day to day

- Push/merge to `dev` → auto-deploys to the internal URL behind the password.
- Push/merge (or fast-forward) `dev` into `main` → auto-deploys to the public URL, no
  password.
- Every branch/PR also gets a normal Vercel **preview** deployment on both projects; those
  follow whatever protection each project already has configured (Vercel's own preview
  protection settings), independent of this doc.

## Verifying locally before pushing

```bash
bash tools/vercel_build.sh   # builds site/ exactly like Vercel will
python3 -m http.server -d site 8000   # serve it: http://localhost:8000/ and /studio/
node tools/t_vercel_auth.js  # exercises middleware.js's auth logic directly, no deploy needed
```
