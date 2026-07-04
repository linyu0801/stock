# Frontend Rules — apps/web

## Architecture: FSD + Clean Architecture + Atomic Design

### FSD Layer Order (high → low; upper layers import lower, never reverse)
```
app/        ← providers, router, global CSS
pages/      ← route-level pages
widgets/    ← self-contained page sections (own data fetching)
features/   ← user-facing interactions (e.g., manage-groups)
entities/   ← business objects/models
shared/     ← generic UI, utils, hooks — NO business logic
```

### Atomic Design (within each layer that owns UI)
```
atoms/      ← single element, no business state, no external deps
molecules/  ← combine atoms, may have local UI state
organisms/  ← combine molecules, may use hooks/context
```

**Placement rules:**
- Shared across pages → `shared/ui/atoms|molecules|organisms/`
- Page-local only → `pages/<page>/atoms|molecules|organisms/`
- Widget-local → `widgets/<widget>/atoms|molecules|organisms/`
- `src/components/ui/` is a legacy shadcn remnant — do NOT add files there; use `shared/ui/atoms/`

### Clean Architecture
- `pages/` and `widgets/` depend on `features/` and `shared/`, never the reverse
- API calls live in `packages/api-client`; components never call `fetch` directly
- Business logic in features/entities, not in UI components

## Styling
- **Always `className`**. `style={{}}` only for values Tailwind cannot express (e.g., dynamic `gridTemplateColumns`)
- Tailwind v4: `@import "tailwindcss"` + `@theme inline` in CSS. No `postcss.config.js` needed.
- Taiwan stock colors: gain = `text-gain` / `bg-gain` (#FF4560 red), loss = `text-loss` / `bg-loss` (#00C896 green)
- Dark theme CSS vars: `--background`, `--card`, `--primary` (#7B6EF6), `--border`, etc.

## React / Hooks
- No `useEffect` for syncing derived state — derive directly in render
- No `useEffect` for focus — use `autoFocus` attribute
- `useCallback` only when the function is a dep in another hook (not "for performance")
- `useMemo` only for genuinely expensive computations
- `useRouterState` (NOT `useRouter`) for reactive current path in TanStack Router

## TanStack Router
- Navigation: `useNavigate()` → `navigate({ to: "/path/$param", params: { param: value } })`
- Active route detection: `useRouterState().location.pathname`

## Component Rules
- Always `const`, never `function` keyword for components
- Type with `React.FC<Props>` — define `type Props = {...}` above the component
- `export default` on its own line below the component body, never inline
- Named exports for atoms/molecules/organisms; default export for pages/widgets

```tsx
// correct
type Props = { label: string };

const StatBox: React.FC<Props> = ({ label }) => {
  return <div>{label}</div>;
};

export default StatBox;
```
