# HouseKeeping — Audit Response

_Date: April 21, 2026_

These are my thoughts on the System Audit Report dated April 21, 2026. No action has been taken — this is a triage/perspective document only.

---

## Overall

Solid report. The auditor read the actual disk state, ran the type checker, and grouped findings sensibly. Nothing in there is wrong or alarmist. Below is how I'd weight each item.

---

## Worth doing soon (real impact)

- **`verifySession()` signature mismatch (31 TS errors)** — Cosmetic at runtime, but it will bite the moment stricter CI is enabled or a future TypeScript upgrade enforces it. One-line fix that clears the noise so real errors stop hiding in a wall of red.
- **`migrate-data.ts` referencing dropped columns** — That script is broken. If anyone runs it, it will fail. Either delete the script or align it with the current schema.
- **`middleware.ts` → `proxy.ts` migration** — Next.js 16 only warns today; a future major will break it. The non-www → www 301 is critical for SEO, so we don't want that quietly dying.

---

## Worth doing eventually (hygiene, not urgent)

- **Dead Express / Vite / Wouter stack on disk** — `server/`, `client/`, `vite.config.ts`, root-level `components/` & `hooks/`, etc. are leftovers from the migration. They bloat the repo and confuse anyone (or any AI) trying to read the project. They are not actively breaking anything. The risk in deleting them is that something subtle in the deploy chain (`script/build.ts`, `.replit` config calling `dist/index.cjs`, the `tsx server/index.ts` shim) might still be loadbearing — needs a careful trace before ripping out.
- **`package.json` named `rest-express` with Express deps** — Cosmetically wrong, no functional harm. Cleanup pays off in smaller install times and clarity.
- **The literally-escaped `app/'\[slug\]'` folder** — If real on disk, probably a junk artifact from a shell escape gone wrong. Worth confirming and deleting.

---

## Probably wrong / overstated

- **Two PostCSS configs** — Worth checking which one Next is actually picking up; probably one is dead. Easy to verify.
- **`John/` directory** — That's the working folder (handover docs, specs, screenshots). It's been deliberately tracked. The auditor is right that it doesn't belong in a "clean" app repo, but in the current workflow it's intentional. Leave it alone.
- **Default admin credentials** — `admin` / `admin123` is fine for dev; the audit's note is correct that it should be rotated before broad public access. Not a bug, just a reminder.
- **`SESSION_SECRET` fallback** — Correct concern. A production hard-fail guard is a 3-line addition and good practice.

---

## Big-picture take

The platform itself is healthy and shipping. What the audit is really saying is: _the framework migration completed, but the cleanup phase never did._ That's extremely common and not dangerous, but it means the repo carries a layer of fossil code that makes onboarding slower and gives a false picture of the stack.

---

## Recommended one-afternoon cleanup

If prioritizing a single focused cleanup pass:

1. Fix `verifySession` signature.
2. Migrate `middleware.ts` → `proxy.ts`.
3. Delete the `migrate-data.ts` dead script.

That gets out of the deprecation runway and clears the type-check report. The bigger dead-stack purge is a separate, more careful job — worth doing but not while actively shipping content and city pages.

---

## Bottom line

Nothing in that report is a fire. It's a good "spring cleaning" list. Live functionality is intact.
