# World Cup Bracket Visualizer

A Next.js + TypeScript World Cup knockout bracket with React Three Fiber visuals, Supabase-backed anonymous predictions, and a protected bracket refresh route.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and add Supabase keys when you want persistence:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
REFRESH_SECRET=
```

Without Supabase env vars the app runs with seeded knockout placeholder data and local browser storage for predictions.

## Database

Apply `supabase/migrations/001_initial.sql` to a Supabase project, then enable anonymous auth in Supabase Auth settings.

## Refreshing Bracket Data

`/api/refresh-bracket` expects either:

- `Authorization: Bearer $REFRESH_SECRET`
- `x-refresh-secret: $REFRESH_SECRET`

GitHub Actions calls the route every 30 minutes through `.github/workflows/refresh-bracket.yml`.

Configure these repository secrets:

- `APP_URL`: production app URL, without a trailing slash
- `REFRESH_SECRET`: the same value configured in the deployed app environment

The workflow can also be run manually from the Actions tab.

## Scripts

```bash
npm run test
npm run typecheck
npm run build
```
