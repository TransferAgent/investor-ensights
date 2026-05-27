# F8 — Persona Wizard Author Defaults (Nice-to-Have, Deferred)

**Status:** Deferred 2026-05-27 per Conductor decision. Not blocking. Pick up any time.

## Origin

Final unshipped gate from the E-E-A-T Author Rollout (gates F1–F7 shipped 2026-05-27). The rollout normalized every existing article + tenant + city row to:

- `author_name = 'John Reynolds'`
- `publisher_name = 'Investor Ensights'`
- `city.email = 'info@investorensights.com'`
- `city.phone_number = '(800) 684-8034'`

But the **Persona Wizard** (`app/admin/personas/new`) still lets a Conductor seed a new tenant with whatever values they hand-type in Step 1. Nothing stops a future tenant from drifting again.

## What F8 hardens

In `app/admin/personas/new` (Step 1 — Identity):

1. Auto-fill `author_name` field with `"John Reynolds"` as a default value.
2. Auto-fill `publisher_name` field with `"Investor Ensights"` as a default value.
3. Keep both fields **editable** (per Conductor decision: "could be different as I add staff").
4. Add a small inline help text under each: *"Platform default. Change only if assigning this persona to a different staff author."*

In `POST /api/admin/personas` (server):

5. If the request omits `author_name` or `publisher_name` entirely, server falls back to the platform defaults rather than rejecting.

## What F8 does NOT do

- Does **not** change the render-time author identity. The article renderer ignores `tenants.author_name` entirely and always renders John Reynolds via `PLATFORM_AUTHOR` in `lib/author-config.ts`. See `.agents/memory/article-author-rendering.md` for why.
- Does **not** touch existing tenants — they're already correct as of F5.
- Does **not** change the City Batch step or Haylo step.

## When you'd actually need F8

The day a real second author joins the masthead. Workflow then is:

1. Add the new author profile (name, title, avatar, social URL, bio) to `KNOWN_AUTHORS` in `lib/author-config.ts`.
2. Drop the avatar in `public/`.
3. Switch the renderer from `const author = PLATFORM_AUTHOR` to `const author = resolveAuthor({ articleAuthorName: article.authorName, articlePublisherName: article.publisherName })` — the helper is already built and includes a mixed-identity guard for unknown names.
4. Use the Wizard (with F8's defaults in place) to assign new tenants to the new author.

## Estimated effort

~30 min total. Two file edits (`app/admin/personas/new/page.tsx` form defaults + `app/api/admin/personas/route.ts` server fallback). No DB migration, no script, no deploy gate beyond a normal release.

## Pointer to context

- E-E-A-T rollout decisions and DB state: `replit.md` (Gotchas + sitemap canary)
- Render-time vs DB decoupling: `.agents/memory/article-author-rendering.md`
- The deprecated per-persona email script (do not resurrect): `scripts/fix-persona-emails.deprecated.ts`
