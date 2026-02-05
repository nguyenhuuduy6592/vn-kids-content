# vn-kids-content

Vietnamese children's content manager (songs/poems/stories). React 19 + Vite + Tailwind CSS + Neon PostgreSQL. PWA-enabled. Deployed on Vercel.

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to /dist
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Environment

- `DATABASE_URL` - Neon PostgreSQL connection string (required for API functions)

## Architecture

Frontend SPA with Vercel serverless API backend.

### Frontend (`src/`)
- `src/main.jsx` - Entry point
- `src/App.jsx` - Entire UI (~920 lines): CRUD, search, filter, import/export, modals, edit-in-place
- `src/index.css` - Tailwind directives

### API (`api/`) - Vercel Serverless Functions
- `api/db.js` - Neon database connection (`@neondatabase/serverless`)
- `api/content.js` - GET/POST/PUT content (CRUD)
- `api/progress.js` - POST read count, favorite, archive toggles
- `api/seed.js` - POST bulk import
- `api/clear.js` - DELETE all data

## Key Patterns

- **Data flow**: API-first with localStorage as offline cache (24h expiry)
- **PWA**: Service worker via `vite-plugin-pwa`, prompt-based updates, offline support
- **Deduplication**: Items deduplicated by ID and by title+type on load and import
- **Sorting**: Vietnamese locale collation (`localeCompare` with `'vi'`)
- **Local save**: 500ms debounce to localStorage after state changes
- **Version**: `__APP_VERSION__` injected from `package.json` at build time
- **UI language**: All labels in Vietnamese

## Content Types

- `song` (Bài hát), `poem` (Đồng dao), `story` (Truyện)

## Gotchas

- Import uses `new Function('return ' + jsonText)` to parse JS object syntax (not just JSON) - intentional for flexibility
- Dark mode not persisted - resets on reload
- iOS clipboard: special handling with fallback paste input due to Safari permission model
- `@types/react` installed but project uses plain JS, not TypeScript
- No test framework configured
- API functions use Neon's tagged template literals for parameterized queries (not string interpolation)
- CORS headers set to `*` in all API handlers
