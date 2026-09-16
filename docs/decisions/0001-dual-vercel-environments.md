# ADR 0001: Two Vercel projects — internal dev, public prod

Date: 2026-09-16
Status: accepted

## Context

The site currently deploys to GitHub Pages only (`.github/workflows/pages.yml`), publishing
both the public play page (`play.html`, at the site root) and the workshop/studio page
(`index.html`, at `/studio/`). The studio is only hidden by an unlisted path — GitHub Pages
has no access control, so anyone who finds `/studio/` can open it (documented in `README.md`
and `CLAUDE.md`).

The request is to host on Vercel with two distinct environments: one internal-only for the
team, one public for players. Vercel was already listed in `README.md` as a "bring your own
host" option (`vercel deploy`), but nothing in the repo configured it.

The game is a static, buildless, framework-free site (one HTML file plus a Python script that
derives a second one — `tools/mk_play.py`). Whatever we add has to keep working with zero
build tooling for local play (`python3 -m http.server`) and must not change what
`node tools/t_*.js` exercises today.

## Decision

Add one shared build (`tools/vercel_build.sh`, mirroring the existing GitHub Pages build
exactly) and one `vercel.json` that both point Vercel at it. That build produces the same
`site/` layout GitHub Pages already serves: `site/index.html` = the public play page,
`site/studio/index.html` = the workshop.

Two separate Vercel projects are linked to this same repository (see
`docs/deploy-vercel.md` for the exact dashboard steps):

- **`multiverse-battler`** (prod, public) — Production Branch `main`. No auth gate. This is
  the one players get a link to.
- **`multiverse-battler-dev`** (dev, internal) — Production Branch `dev`. Gated by HTTP Basic
  Auth enforced in `middleware.js`, active only when that project's `DEV_BASIC_AUTH_USER` /
  `DEV_BASIC_AUTH_PASS` environment variables are set. The prod project never sets them, so
  the same middleware file is a no-op there.

The gate is implemented in-repo (Edge Middleware) rather than relying purely on Vercel's paid
"Deployment Protection" (Password Protection / Vercel Authentication), so "internal only"
does not depend on which Vercel plan is active. A team on a paid plan can still layer
Deployment Protection on top of the dev project for stronger guarantees (SSO, IP allowlists)
without touching this file.

## Consequences

- The same commit that is pushed to `main` (prod) can first be pushed to `dev` and previewed
  behind a password before promoting it — a real dev/prod split, not just two copies of the
  same public URL.
- GitHub Pages keeps working unchanged; Vercel is additive, not a replacement. Nothing in
  `.github/workflows/pages.yml` changed.
- Adding `middleware.js` at the repo root meant giving the repo a `package.json` so Vercel's
  bundler resolves it as an ES module (`"type": "module"`). That would have silently flipped
  every `.js` file in the repo to ES-module resolution, including `tools/*.js`, which are
  CommonJS (`require('./probe')`) and are what `node tools/t_*.js` runs. `tools/package.json`
  with `"type": "commonjs"` pins that subtree back, since Node resolves module type from the
  *nearest* `package.json` walking up from the file, not just the root one. Verified with
  `node --check` on every `tools/*.js` file and a real run of `node tools/t_conan.js` after
  the change.
- A new test, `tools/t_vercel_auth.js`, exercises `middleware.js` directly (pass-through when
  unset, 401 on missing/wrong/malformed credentials, pass on correct ones) without needing a
  live Vercel deployment or the CLI.
- Whoever owns the Vercel account still has to do the one-time dashboard work (create both
  projects, set the two env vars on the dev project, push the `dev` branch) — that part is
  outside what a repository change can do. Documented step by step in
  `docs/deploy-vercel.md`.

## Alternatives rejected

- **Vercel's built-in Password Protection / Vercel Authentication as the only gate** — rejected
  because both require a paid plan (Pro/Enterprise); making "internal only" depend on billing
  tier felt like the wrong default. Still fine as a belt-and-suspenders addition on top.
- **One Vercel project with preview deployments standing in for "dev"** — rejected because
  preview deployments are ephemeral, per-PR, and (depending on plan) not reliably gated;
  there would be no single stable internal URL for the team to bookmark.
- **Separate repos for dev and prod** — rejected; it would fork `index.html`/`play.html` and
  immediately violate the existing "one engine, `play.html` is generated from `index.html`"
  rule in `CLAUDE.md`.
- **A second output directory encoding dev vs. prod differences (e.g. dev bundles extra debug
  tooling)** — rejected; the two environments should serve byte-identical builds. The only
  difference is who is allowed to reach the dev URL, not what the site does.
