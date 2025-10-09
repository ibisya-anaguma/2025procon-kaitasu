# Repository Guidelines

## Project Structure & Module Organization
- `src/app` contains the Next.js App Router tree; feature folders (`shopping/`, `shortcut/`, `mypage/`) deliver routed pages, while `app/api/` hosts server handlers that call Firebase Admin or helper scripts. `public/` serves static assets.
- `src/data` holds curated JSON such as `foodData.json`; regenerate the contents via the jobs pipeline rather than editing by hand.
- `src/jobs` provides data-ingest tooling: the Selenium-based `scraper/` collects product feeds, and `foodDataUpdate/` reshapes nutrition datasets for the app.

## Build, Test, and Development Commands
- `npm install` synchronises root dependencies; repeat inside `src/jobs/scraper` before running its Firebase helper.
- `npm run dev` serves the app at `http://localhost:3000` with hot reload.
- `npm run build` creates the production bundle; follow it with `npm run start` to smoke-test the output locally.
- `npm run lint` applies the Next.js ESLint rules.
- `python3 src/jobs/scraper/scraper.py --help` surfaces scraper options when refreshing `all_products.json` or narrowing genre ranges.

## Coding Style & Naming Conventions
- Default to TypeScript with 2-space indentation; replace legacy tabbed blocks when you touch them.
- Name React components and hooks in PascalCase, helper functions and variables in camelCase, and keep directories lowercase with hyphens or underscores that match the current tree.
- Share cross-cutting utilities through `src/lib`; inline comments only when behaviour is non-obvious.

## Testing Guidelines
- No automated suite ships yet; add co-located `*.test.tsx` files using Jest + React Testing Library (preferred) when you modify UI or API code.
- Mock Firebase Admin in tests to avoid live traffic, and dry-run data jobs against a narrow genre sample (`--genre-min 10 --genre-max 12`) before committing regenerated JSON.

## Commit & Pull Request Guidelines
- Follow the short, imperative commit pattern seen in history (`add auth`, `fix api structure`); add a scope suffix when clarity helps (`add shopping cart api`).
- Keep commits focused—do not mix scraper refreshes with frontend changes unless the diff is inseparable.
- Pull requests should include a concise summary, testing notes (`npm run lint`, manual checks), any linked issue, and screenshots or console output for UI changes.

## Security & Configuration Tips
- Store secrets in `.env.local`; required keys include `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (escape newlines as shown in `src/lib/middleware.ts`). Never commit service-account JSON—pass credentials via environment variables or CI secrets and document any temporary files you generate.
