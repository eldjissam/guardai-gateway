# GuardAI UI refinement patch

This patch fixes:
1. The guest composer horizontal alignment. It now uses left/right constraints and auto margins, avoiding a centering transform that Framer Motion can overwrite.
2. Authentication is now a dedicated full-page sign-in/sign-up screen, not a modal.
3. Sign-in places the form on the left and animated security visual on the right. Sign-up reverses the panels with a layout transition.
4. Mobile authentication stacks the visual header above the form and allows vertical scrolling on short screens.

## Files to replace

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`

## New file

- `frontend/src/auth-fixes.css`

## Apply

Copy these files into the matching paths in your local project, allowing overwrite for the two existing files. Then run:

```powershell
npm run typecheck
npm run build
npm run dev
```

The authentication forms are still UI-only placeholders. Supabase Auth will be integrated separately; the form currently shows an explicit notice instead of pretending to create an account.
