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

## 0. The `dev` branch already exists

Created once from `main`; nothing further needed here.

**Convention going forward: new work targets `dev`, not `main`.** Every regular pull
request should be opened with `dev` as its base branch. `main` only ever moves via a
separate, explicit **promotion** step — someone (or an instruction to Claude Code) saying
"promote `dev` to `main`" / "graduate this to prod." It is never a side effect of merging a
feature PR into `dev`.

A promotion is **whole-branch, not per-feature**: it brings across everything currently on
`dev` that `main` doesn't have yet (`git log main..dev` is the exact list), as one unit.
There is no built-in way to promote "PR #12 but not PR #13" other than cherry-picking by
hand, which leaves `dev` and `main` diverged until the held-back commit either lands later
or gets reverted from `dev`. Practical consequence: keep `dev` short-lived — land one
thing, promote, repeat — rather than letting several unrelated changes queue up on it
waiting on different readiness timelines.

Mechanically, a promotion is either:

```bash
# fast-forward (dev has not diverged from main in any way main itself changed)
git fetch origin dev main
git checkout main
git merge --ff-only origin/dev
git push origin main
```

or open a pull request `dev → main` and merge it — the safer default, since it gives CI a
run against the exact commit about to go live and leaves a record of when something shipped.

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

On Project A, also set (see "Gating `/studio/` on the public project" below):

- `STUDIO_BASIC_AUTH_USER` / `STUDIO_BASIC_AUTH_PASS` — separate credentials just for
  `/studio/`. Without these, `/studio/` on the public URL is reachable by anyone who knows
  the path — see the note below.

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
  user/pass you set above gets through — this already covers `/studio/` too, since the
  whole-site gate takes priority (see `middleware.js`). You don't need to also set
  `STUDIO_BASIC_AUTH_*` here.

Rotate either password by editing the env var in the dashboard (Settings → Environment
Variables) — no code change or redeploy required.

## Gating `/studio/` on the public project

`middleware.js` has **two independent gates**:

1. `DEV_BASIC_AUTH_USER`/`DEV_BASIC_AUTH_PASS` — gates the **whole site** when set. This is
   what Project B (dev) uses.
2. `STUDIO_BASIC_AUTH_USER`/`STUDIO_BASIC_AUTH_PASS` — gates **only `/studio/`** (and
   anything under it) when set, leaving `/` public. This is what Project A (prod) should use.

Without gate 2, `/studio/` on the public URL is only "unlisted" — nothing links to it, but
the page is still served in full to anyone who requests it directly (finds the path in this
repo's source, guesses it, gets it crawled by a search engine, etc.). It is **not** actually
private. Setting `STUDIO_BASIC_AUTH_USER`/`STUDIO_BASIC_AUTH_PASS` on Project A closes that
gap: `/` stays public and password-free, `/studio/*` requires the credentials.

Pick a **different** password from the dev site's — they're separate env vars, so there's no
reason to reuse one. `node tools/t_vercel_auth.js` exercises both gates without a live deploy.

## 2. Optional: stack Vercel's own protection on top

If the Vercel account is on a paid plan, Settings → Deployment Protection on the **dev**
project can additionally enable "Vercel Authentication" (restrict to people signed into the
Vercel team) or "Password Protection." These are independent of `middleware.js` and layer on
top of it — enabling them does not require touching any file in this repo.

## 3. Day to day

- Regular PRs target `dev`. Merging one auto-deploys to the internal URL behind the
  password — nothing further needed, no promotion implied.
- Promoting `dev` into `main` (see §0) auto-deploys to the public URL, no password. This is
  always a deliberate, explicit action, never automatic.
- Every branch/PR also gets a normal Vercel **preview** deployment on both projects; those
  follow whatever protection each project already has configured (Vercel's own preview
  protection settings), independent of this doc.

## Verifying locally before pushing

```bash
bash tools/vercel_build.sh   # builds site/ exactly like Vercel will
python3 -m http.server -d site 8000   # serve it: http://localhost:8000/ and /studio/
node tools/t_vercel_auth.js  # exercises middleware.js's auth logic directly, no deploy needed
```
