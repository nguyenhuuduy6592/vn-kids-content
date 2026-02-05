# vn-kids-content

Vietnamese children's content manager (songs/poems/stories). React 19 + Vite + Tailwind CSS. Pure JavaScript (no TypeScript).

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to /dist
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Architecture

Single-file React app. All logic in `src/App.jsx` (~460 lines) including modal components, data management, and UI.

- `src/main.jsx` - Entry point, renders App
- `src/App.jsx` - Entire application (CRUD, search, filter, import/export, modals)
- `src/index.css` - Tailwind directives
- `src/App.css` - Unused legacy Vite template styles

## Key Patterns

- **Storage**: Dual backend - `window.storage` (Claude Artifacts) or `localStorage` (browser)
- **Sorting**: Vietnamese locale collation (`localeCompare` with `'vi'`)
- **Auto-save**: 500ms debounce, only saves when `content.length > 0`
- **Data format**: `{ version: 1, items: [...] }` with seed config for external loading
- **UI language**: All labels in Vietnamese

## Content Types

- `song` (Bài hát), `poem` (Đồng dao), `story` (Truyện)

## Gotchas

- Import uses `new Function('return ' + jsonText)` to parse JS object syntax (not just JSON) - intentional for flexibility
- Dark mode state is not persisted to localStorage - resets on reload
- `src/App.css` is unused leftover from Vite template
- `@types/react` installed but project uses plain JS, not TypeScript
- No test framework configured
