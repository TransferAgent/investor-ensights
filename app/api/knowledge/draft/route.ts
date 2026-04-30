import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { createHash } from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";
const ROBOTS_BEAST = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

const DRAFT_RATE_LIMIT = 10;
const DRAFT_WINDOW_MS = 60 * 1000;
const draftAttempts = new Map<string, { count: number; resetAt: number }>();

function checkDraftRateLimit(actorKey: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = draftAttempts.get(actorKey);
  if (!entry || now > entry.resetAt) {
    draftAttempts.set(actorKey, { count: 1, resetAt: now + DRAFT_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= DRAFT_RATE_LIMIT) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_FIELDS = ["status", "published", "archived", "datePublished", "dateModified"];
const ALLOWED_HTML_TAGS = ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br"];

function validatePayload(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (FORBIDDEN_FIELDS.some((f) => body[f] !== undefined)) {
    errors.push("Forbidden fields detected: status, published, archived, datePublished, dateModified cannot be set");
  }

  if (!body.slug || typeof body.slug !== "string") {
    errors.push("slug is required");
  } else {
    const slug = body.slug.toLowerCase().trim();
    if (slug.length < 5 || slug.length > 120) {
      errors.push("slug must be 5-120 characters");
    }
    if (!SLUG_REGEX.test(slug)) {
      errors.push("slug must be lowercase alphanumeric with hyphens (e.g. my-press-release)");
    }
  }

  if (!body.locale || body.locale !== "en-US") {
    errors.push("locale must be 'en-US'");
  }

  if (!body.seo || typeof body.seo !== "object") {
    errors.push("seo object is required");
  } else {
    if (!body.seo.title || typeof body.seo.title !== "string") {
      errors.push("seo.title is required");
    } else if (body.seo.title.length < 10 || body.seo.title.length > 80) {
      errors.push("seo.title must be 10-80 characters");
    }
    if (!body.seo.description || typeof body.seo.description !== "string") {
      errors.push("seo.description is required");
    } else if (body.seo.description.length < 50 || body.seo.description.length > 200) {
      errors.push("seo.description must be 50-200 characters");
    }
    if (body.seo.ogImageUrl && typeof body.seo.ogImageUrl === "string") {
      if (!body.seo.ogImageUrl.startsWith("https://")) {
        errors.push("seo.ogImageUrl must be an absolute HTTPS URL");
      }
    }
  }

  if (!body.article || typeof body.article !== "object") {
    errors.push("article object is required");
  } else {
    if (!body.article.headline || typeof body.article.headline !== "string") {
      errors.push("article.headline is required");
    } else if (body.article.headline.length < 10 || body.article.headline.length > 140) {
      errors.push("article.headline must be 10-140 characters");
    }
    if (!body.article.bodyHtml || typeof body.article.bodyHtml !== "string") {
      errors.push("article.bodyHtml is required");
    } else {
      if (body.article.bodyHtml.length < 600) {
        errors.push("article.bodyHtml must be at least 600 characters (prevents thin content)");
      }
      const strippedText = body.article.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const sentences = strippedText.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
      if (sentences.length < 8) {
        errors.push("Content too thin — minimum 8 sentences required.");
      }
      if (/<script[\s>]/i.test(body.article.bodyHtml)) {
        errors.push("article.bodyHtml must not contain <script> tags");
      }
      if (/\bon\w+\s*=/i.test(body.article.bodyHtml)) {
        errors.push("article.bodyHtml must not contain inline event handlers (e.g. onclick, onerror)");
      }
      if (/javascript\s*:/i.test(body.article.bodyHtml)) {
        errors.push("article.bodyHtml must not contain javascript: URLs");
      }
      if (/<iframe[\s>]/i.test(body.article.bodyHtml)) {
        errors.push("article.bodyHtml must not contain <iframe> tags");
      }
    }

    if (body.article?.headline && typeof body.article.headline === "string" && body.slug) {
      const headlineLower = body.article.headline.toLowerCase();
      const slugParts = body.slug.toLowerCase().split("-");
      const keywords = ["cap table", "equity", "startup", "founders", "shareholders", "vesting", "safe", "convertible note", "dilution", "ownership"];
      const hasKeyword = keywords.some(kw => headlineLower.includes(kw));
      const hasCityRef = slugParts.some((part: string) => part.length > 2 && headlineLower.includes(part));
      if (!hasKeyword && !hasCityRef) {
        errors.push("Headline must reference the city or an Investor Ensights keyword.");
      }
    }

    if (body.article?.boilerplateHtml && typeof body.article.boilerplateHtml === "string") {
      if (body.article.boilerplateHtml.length < 50) {
        errors.push("Boilerplate too short — minimum 50 characters.");
      }
    }
  }

  if (!body.attribution || typeof body.attribution !== "object") {
    errors.push("attribution object is required");
  } else {
    if (!body.attribution.authorName || typeof body.attribution.authorName !== "string") {
      errors.push("attribution.authorName is required");
    }
    if (body.attribution.publisherName && body.attribution.publisherName !== "Investor Ensights") {
      errors.push("attribution.publisherName must be 'Investor Ensights'");
    }
  }

  if (body.seo?.ogImageUrl === undefined || body.seo?.ogImageUrl === null || body.seo?.ogImageUrl === "") {
    errors.push("WARNING: seo.ogImageUrl is missing — image is recommended for Google Article structured data");
  }

  return { valid: errors.filter((e) => !e.startsWith("WARNING:")).length === 0, errors };
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rateLimitKey = `draft_${session.username}`;
  const rateCheck = checkDraftRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { valid, errors } = validatePayload(body);
  if (!valid) {
    return NextResponse.json({ ok: false, errors: errors.filter((e) => !e.startsWith("WARNING:")) }, { status: 400 });
  }

  const slug = body.slug.toLowerCase().trim();
  const canonicalUrl = `${BASE_URL}/discovery/knowledge/${slug}`;

  if (body.canonicalUrl && body.canonicalUrl !== canonicalUrl) {
    return NextResponse.json(
      { ok: false, errors: ["canonicalUrl must match canonical host: " + BASE_URL] },
      { status: 400 }
    );
  }

  const existing = await storage.getKnowledgeArticleBySlug(slug);
  if (existing) {
    return NextResponse.json({ ok: false, errors: ["Slug already exists"], slug }, { status: 409 });
  }

  const authorType =
    body.attribution.authorName.toLowerCase() === "tableicity" ? "Organization" : body.attribution.authorType || "Person";

  const warnings = errors.filter((e) => e.startsWith("WARNING:"));

  const citySlugValue = body.citySlug || null;

  try {
    const article = await storage.createKnowledgeArticle({
      slug,
      citySlug: citySlugValue,
      status: "pending",
      title: body.seo.title,
      metaDescription: body.seo.description,
      canonicalUrl,
      robots: ROBOTS_BEAST,
      ogImageUrl: body.seo.ogImageUrl || null,
      headline: body.article.headline,
      subheadline: body.article.subheadline || null,
      dateline: body.article.dateline || null,
      bodyHtml: body.article.bodyHtml,
      boilerplateHtml: body.article.boilerplateHtml || null,
      authorName: body.attribution.authorName,
      publisherName: "Investor Ensights",
    });

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");

    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await logAuditEvent({
      username: session.username,
      action: "knowledge_draft_created",
      entityType: "knowledge_article",
      entityId: article.id,
      details: {
        slug,
        payloadHash,
        clientIp,
        userAgent,
        authorType,
        locale: body.locale,
        conductorDirective: body.conductor?.manualDirective || null,
        conductorSourceUrl: body.conductor?.sourceUrl || null,
      },
      ipAddress: clientIp,
    });

    return NextResponse.json(
      {
        ok: true,
        articleId: article.id,
        slug: article.slug,
        status: "pending",
        adminUrl: `${BASE_URL}/admin/knowledge?slug=${article.slug}`,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Draft creation error:", err);
    return NextResponse.json({ ok: false, errors: ["Internal server error"] }, { status: 500 });
  }
}
