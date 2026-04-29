# replit.md

## Overview

This project is a **City Landing Page Manager**, a full-stack web application designed for programmatic SEO. It enables the creation and management of location-based landing pages for various US cities using reusable content templates with dynamic placeholder substitution. The application provides a public-facing website for browsing city locations and templated content, as well as an admin dashboard for managing cities, content templates, and their assignments. Its core purpose is to automate content generation and deployment for location-specific marketing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application is built with **Next.js 16** (App Router), **React 18** (TypeScript), **Tailwind CSS 3** for styling, and **shadcn/ui** for UI components. Data fetching on the admin side is handled by **TanStack React Query**.

**UI/UX Decisions:**
The public-facing site features dynamic city landing pages and a locations grid with search, filter, and geo-detection. Custom pages can be created via a Page Builder, and public press release/knowledge articles have full SEO support (JSON-LD, OpenGraph, dynamic sitemaps, robots.txt). The admin dashboard provides comprehensive CRUD operations and management tools. Styling leverages Tailwind CSS and shadcn/ui components for a consistent and modern interface.

**Technical Implementations & Feature Specifications:**

*   **Public-facing Pages:**
    *   Dynamic city landing pages (`/locations/[slug]`) with city-specific content, slideshows, contact info, and maps.
    *   Locations grid (`/locations`) with search, filter, and geo-detection.
    *   Custom pages (`/[slug]`) created via an integrated Page Builder.
    *   Public press release/knowledge articles (`/discovery/knowledge/[slug]`) with SEO optimizations.
*   **Admin Dashboard:**
    *   User authentication with JWT and httpOnly cookies.
    *   CRUD for cities, content templates, custom pages, and knowledge articles.
    *   Bulk operations for cities (CSV import, publish/unpublish, template assignment).
    *   Page Builder for custom pages with configurable content slides.
    *   "Knowledge" section for managing press releases, including a content studio with a 5-agent pipeline (Researcher, Data Analyst, Local Copywriter, SEO QC, Internal Linker) for content generation and management.
    *   **Newsroom Auto-Scheduler:** Configurable scheduler for drip publishing using the 5-agent pipeline, selecting eligible `haylo_articles` and `city_locations` for pairing and publishing.
    *   **Pair-Agent Orchestration (`pairAgentOrchestrator.ts`):** The "Pair" Newsroom flow runs a Haylo essay through the full 5-agent pipeline in polish mode (prompt version `v4`) instead of the prior glue+grade shortcut. The Copywriter receives `hayloSeed` (title, bodyHtml, dateline, topicSlug) via `extras` and is instructed to preserve the Haylo body's structure, polish the title, normalize emphasis, and emit a single clean dateline. Verdicts: PASS ≥75 → publishes to `knowledge_articles`, WARN 50-74 → review queue, FAIL <50 → blocked. Dry-run path bypasses LLMs and falls through to the legacy `processPair` mock.
    *   **City Research Auto-Seeder (`cityResearchAutoSeeder.ts`):** Before each Pair run, `ensureCitySources(citySlug)` checks for enabled rows in `city_research_sources`; if none exist, derives candidate URLs from city/state metadata (Wikipedia, city.gov, Chamber, Crunchbase), probes them, and caches productive ones via `INSERT … ON CONFLICT DO NOTHING`. Idempotent and never stalls on dead URLs.
    *   Data store for managing file uploads.
    *   **Admin Users management (`/admin/settings/admins`):** Self-service page to list admins, create new admins, change any admin's password (12-char min), and delete admins. Backed by `app/api/admin/users` (GET/POST) and `app/api/admin/users/[id]` (PATCH/DELETE). All endpoints require `verifySession`. Self-delete is blocked. Last-admin delete is blocked atomically inside a Postgres transaction (`SELECT … FOR UPDATE` on `admin_users` then conditional delete) to defeat TOCTOU races. POST/PATCH/DELETE are rate-limited per session via `checkRateLimit` (5 / 15 min window). Passwords are hashed with the existing scheme (`randomBytes(16).toString("hex") + ":" + scryptSync(pw, salt, 64).toString("hex")`); plaintext is never logged or returned. Audit log records `create`, `update` (`{field:"password"}`), and `delete` actions on `admin_user`. Dev-side seeding helper: `scripts/upsert-super-admin.ts` (env: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY`, `ADMIN_PURGE_OTHERS`).
    *   **Haylo Library (`/admin/haylo`):** Allows ingestion of Haylo Lab essays via paste-in or file-drop, with duplicate detection, status management (`ready`/`draft`/`retired`), and sandboxed previews.
*   **SEO Enhancements:** Server-Side Rendering (SSR), dynamic sitemap and robots.txt, canonical URLs, OpenGraph tags, and JSON-LD structured data.
*   **Authentication & Security:** JWT-based authentication with `scrypt` hashing, httpOnly cookies, rate limiting, input sanitization, SQL injection protection via Drizzle ORM, and admin audit logging.
*   **Geocoding:** Integration with OpenCage API for automatic latitude/longitude population.

**System Design Choices:**

*   **Database:** PostgreSQL, accessed via Drizzle ORM and `drizzle-zod`.
*   **Content Generation Pipeline:** The Newsroom pipeline uses a refined 5-agent model for generating press releases, focusing on source-grounded content. This pipeline has been optimized for cost and speed, including parallel execution of certain stages.
*   **Haylo Content Integration:** Specific adjustments were made to correctly parse and style Halo Lab's HTML format, preserving key elements like `<strong>` tags and `answer-block` paragraphs while stripping redundant `<h1>` tags for optimal display on public pages.
*   **Performance Tuning:** The live pipeline model was upgraded to `gpt-4.1-nano` for improved speed and cost efficiency. Pipeline stages are grouped for parallel execution where dependencies allow.

## External Dependencies

*   **PostgreSQL**: Primary database.
*   **OpenCage API**: Geocoding services for city latitude/longitude.
*   **OpenAI API**: Used for the Newsroom content generation pipeline, specifically leveraging the `gpt-4.1-nano` model for live content generation and `gpt-4o-mini` for the dry-run path.