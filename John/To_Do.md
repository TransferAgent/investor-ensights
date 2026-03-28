# Knowledge Page — Walkthrough To-Do

## Tabs Covered
- **Articles** — Campaign folders, expand/collapse, bulk actions (Publish, Unpublish, Archive, Restore), status filters
- **Content Studio** — Template picker, city selector, preview, apply with campaign name

## Tabs Not Yet Walked Through

### 1. Templates
Where you manage the actual PR templates (create new ones, edit existing). This is where you'd go to make the two templates have different content.

### 2. Analytics
Shows publishing metrics: how many published this month, how many are Google Discover eligible, average freshness score, and pending count.

### 3. Coverage
A city-by-city map showing which cities have press releases and which don't. Helps you spot gaps in your coverage across all 150+ cities.

## Other Features Not Yet Explored

### 4. Bulk Generate Button (top right)
Generates articles from a template across all cities at once.

### 5. Generate Local Vibe Button (top right)
Creates AI-generated local-flavor drafts for specific cities.

### 6. Freshness Badges
Each article shows how fresh/stale it is. These were empty during walkthrough — worth investigating.

### 7. Version History
Every article tracks publish/archive snapshots so you can see what changed.

### 8. Individual Article Actions
Edit, Re-Generate, View live page, per-article publish/unpublish/archive/restore.

## Known Issues
- Both PR templates currently have identical content — legacy Privacy-First articles were overwritten with Hash-256 content
- Freshness badges not displaying — needs investigation

---

## Full Feature & Gate Table

| # | Feature / Gate | Status | Notes |
|---|---|---|---|
| 1 | Templates Tab | Built, not walked through | Create, edit, delete PR templates |
| 2 | Analytics Tab | Built, not walked through | Published count, Discover eligibility, freshness score |
| 3 | Coverage Tab | Built, not walked through | City-by-city PR coverage map, gap detection |
| 4 | Freshness Badges | Built, not working | Empty in article rows — needs investigation |
| 5 | Version History | Built, not walked through | Per-article publish/archive snapshot trail |
| 6 | Generate Local Vibe | Built, not walked through | AI-generated unique city-flavor drafts |
| 7 | Bulk Generate | Built, not walked through | One-click template application to all cities |
| 8 | Individual Re-Generate | Built, not walked through | Per-article re-generation from template |
| 9 | Edit Article Inline | Built, not walked through | Edit headline, body, SEO fields per article |
| 10 | OG Image Validation | Built, not walked through | Publish gate — requires valid OG image before going live |
| 11 | Duplicate Content Fix | Known issue | Both templates have identical body content |
| 12 | Cities Template H1 | Known issue, deferred | H1 Header Pattern changes not persisting after save |
| 13 | Halo HTML Training | Future (4-8 weeks) | Teach Halo to write templates with placeholders |
| 14 | Halo API Integration | Future (after #13) | Autopilot: 80% AI / 20% Human |

---

## Roadmap
1. **Now** — Launch and monitor Google with current PR content
2. **4-8 weeks** — Teach Halo proper HTML with placeholders
3. **After Halo HTML** — Build API integration for autopilot (80% AI / 20% Human)
