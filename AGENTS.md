# AGENTS.md

## Scope

This repository has two independent `pnpm` projects and no root workspace:

- `next-world-auth`: published TypeScript library for World mini app auth and payments
- `next-mini-app`: example Next.js app that consumes `next-world-auth`

Do not assume root-level `pnpm` commands will work. Run install, lint, build, and dev commands inside the relevant package directory.

## Repository Map

### `next-world-auth`

- Source lives in `src/`
- Public entrypoints are `src/index.ts` and `src/react.tsx`
- Server route handling is implemented in `src/handler.ts`
- Package build output is emitted to `dist/`
- `dist/` is generated; do not edit it by hand

### `next-mini-app`

- Next.js App Router app under `app/`
- `app/api/[...miniauth]/route.ts` delegates all auth routes to `WorldAuth({})`
- `app/layout.tsx` installs `WorldAuthProvider`
- `app/page.tsx` is the demo surface for wallet auth, World ID auth, location, and payments

## Install And Run

### Library

```bash
cd next-world-auth
pnpm install
pnpm lint
pnpm build
```

### Demo App

```bash
cd next-mini-app
pnpm install
pnpm lint
pnpm build
pnpm dev
```

## Important Working Notes

- The repo is not wired as a monorepo. `next-mini-app` depends on the published `next-world-auth@0.0.24`, not the local package source. Editing `next-world-auth` does not automatically change what `next-mini-app` runs unless you relink, publish, or change the dependency to a local path/workspace reference.
- If you change `next-world-auth/src/*`, regenerate `dist/` with `pnpm build` before considering the library update complete.
- Keep package-local style intact. The library mostly uses single quotes; the demo app mostly uses double quotes. There is no shared formatter config at the repo root.
- There are currently no automated tests in this repository. Validation is mainly `pnpm lint` and `pnpm build`.

## Environment Variables

The auth library reads these variables:

- `NEXT_PUBLIC_WLD_CLIENT_ID`
- `NEXT_PUBLIC_WLD_REDIRECT_URI`
- `WLD_CLIENT_ID`
- `WLD_CLIENT_SECRET`
- `WLD_SERVER`

`next-mini-app/.env` exists locally. Treat it as developer-local configuration and do not copy secrets into commits or docs.

## Known Sharp Edges

- `next-world-auth` lint currently scans generated `dist/` output as well as `src/`. If you touch lint config, exclude `dist/` so source issues are easier to see.
- `next-mini-app` production builds may need network access because `app/layout.tsx` imports `Geist` and `Geist_Mono` from `next/font/google`.
- The `/api/miniauth/augment` route in `next-world-auth/src/handler.ts` only accepts non-null objects even though the client API types allow `object | null`. Be careful when changing session cleanup behavior; null deletion is not wired through today.

## Recommended Validation After Changes

- For library-only changes: run `pnpm lint` and `pnpm build` in `next-world-auth`
- For demo-only changes: run `pnpm lint` and `pnpm build` in `next-mini-app`
- For auth flow changes: validate both packages, especially the catch-all route in `next-mini-app/app/api/[...miniauth]/route.ts` and the handlers in `next-world-auth/src/handler.ts`
