# replit.md

## Overview

This project is a **City Landing Page Manager**, a full-stack web application designed for programmatic SEO. It allows the creation and management of location-based landing pages across various US cities using reusable content templates with dynamic placeholder substitution. The application features a public-facing website for browsing city locations and templated content, alongside an admin dashboard for comprehensive management of cities, content templates, and their assignments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application is built with **Next.js 16** (App Router), **React 18** (TypeScript), **Tailwind CSS 3** for styling, and **shadcn/ui** for UI components. Data fetching on the admin side is handled by **TanStack React Query**.

**Key Features:**

*   **Public-facing Pages:**
    *   Dynamic city landing pages (`/locations/[slug]`) generated from templates, featuring city-specific content, slideshows, contact info, and maps.
    *   A locations grid (`/locations`) with search, filter, and geo-detection capabilities.
    *   Custom pages (`/[slug]`) created via a Page Builder.
    *   Public press release/knowledge articles (`/discovery/knowledge/[slug]`) with full SEO support (JSON-LD, OpenGraph, dynamic sitemaps, robots.txt).
*   **Admin Dashboard:**
    *   Login and user authentication using JWT and httpOnly cookies.
    *   CRUD operations for cities, content templates, custom pages, and knowledge articles.
    *   Bulk operations for cities (CSV import, publish/unpublish, template assignment).
    *   A Page Builder for creating and managing custom pages with configurable content slides.
    *   A "Knowledge" section for managing press releases, including content studio for generation, template management, analytics, and coverage tracking.
    *   A Newsroom pipeline for AI-driven content generation, supporting both fixture-based testing and live OpenAI integration with versioned prompts (v1, v2, v3) and quality gates. v3 is **source-grounded**: the Researcher receives only fetched markdown from per-city seed URLs (extracted via `@mozilla/readability` + `turndown`), every fact must cite a `sourceUrl` from the allowed list, and the QC stage deducts heavily for ungrounded facts. Seed URLs are managed per city via `/api/admin/cities/[id]/research-sources`.
    *   Data store for managing file uploads.
*   **SEO Enhancements:** Server-Side Rendering (SSR), dynamic sitemap and robots.txt, canonical URLs, OpenGraph tags, and JSON-LD structured data are implemented across public pages.
*   **Authentication & Security:** JWT-based authentication with `scrypt` password hashing, httpOnly cookies, rate limiting for login attempts, input sanitization against XSS, SQL injection protection via Drizzle ORM, and comprehensive admin audit logging.
*   **Geocoding:** Integration with OpenCage API for automatic latitude/longitude population for cities.

**Data Storage:**
The application uses **PostgreSQL** as its database, accessed via **Drizzle ORM** and `drizzle-zod` for schema validation. Key database tables include `city_locations`, `content_templates`, `city_content_assignments`, `admin_users`, `admin_audit_log`, `custom_pages`, `page_slides`, `knowledge_articles`, `knowledge_article_versions`, `knowledge_generation_log`, `knowledge_campaigns`, `data_store_files`, `knowledge_templates`, and `city_research_sources` (per-city seed URLs for the source-grounded Newsroom Researcher).

## External Dependencies

*   **PostgreSQL**: Primary database for all application data.
*   **OpenCage API**: Used for geocoding services to auto-fill city latitude and longitude.
*   **OpenAI API**: Utilized for the Newsroom pipeline for AI-driven content generation, specifically with the `gpt-4o-mini` model.