---
name: Article author rendering is decoupled from DB
description: Why app/discovery/knowledge/[slug]/page.tsx renders John Reynolds regardless of article.author_name, and how to add new staff bylines later.
---

The article renderer at `app/discovery/knowledge/[slug]/page.tsx` displays the byline, the bio box, and the JSON-LD `Person` schema using `PLATFORM_AUTHOR` from `lib/author-config.ts`. It does NOT read `article.author_name` for any rendering purpose. The DB column is preserved as data-hygiene (normalized to "John Reynolds" platform-wide) but is intentionally ignored at render time.

**Why:** the Conductor's brand model is "Investor Ensights is always the author, regardless of which persona's content is being pushed." Mixing `article.author_name` into the byline produced two bad failure modes during the E-E-A-T rollout: (1) articles with `author_name='Investor Ensights'` rendered "By Investor Ensights | ..., Investor Ensights" — visually redundant and bypassed the Person schema; (2) a future tenant assigning `author_name='Jane Doe'` would have rendered Jane's name attached to John's avatar, Facebook profile, and bio — a mixed-identity correctness failure for E-E-A-T.

**How to apply:** to add new staff bylines later, do NOT just edit a tenant's `author_name` in the DB. Instead:
1. Add the new author's full profile (name, title, avatar path, social URL, bio) to the `KNOWN_AUTHORS` registry in `lib/author-config.ts`.
2. Drop their avatar into `public/`.
3. Switch the renderer back from `const author = PLATFORM_AUTHOR` to per-row resolution via the already-built `resolveAuthor({ articleAuthorName, articlePublisherName })`.
4. That helper already has the mixed-identity guard: unknown names render as "byline-only" (suppress avatar/social/bio) instead of attaching the wrong person's identity.

The `resolveAuthor` function is preserved (unused but exported) for this exact future path. Do not delete it.
