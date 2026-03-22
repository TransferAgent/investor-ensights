import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { KnowledgeDraftPayloadV1 } from "@/lib/knowledge/payloadContract";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeGenerationLog } from "@shared/schema";
import { eq, gte, and, or, sql } from "drizzle-orm";

function generateStubPayload(city: {
  cityName: string;
  stateCode: string;
  stateName: string | null;
  slug: string;
  localLandmarks: any;
  nearbyCities: any;
}, manualDirective: string) {
  const landmarks = Array.isArray(city.localLandmarks) ? city.localLandmarks : [];
  const nearby = Array.isArray(city.nearbyCities) ? city.nearbyCities : [];
  const landmarkText = landmarks.length > 0
    ? landmarks.slice(0, 3).map((l: any) => typeof l === "string" ? l : l.name || "").filter(Boolean).join(", ")
    : "local business districts";
  const nearbyText = nearby.length > 0
    ? nearby.slice(0, 3).map((n: any) => typeof n === "string" ? n : n.name || "").filter(Boolean).join(", ")
    : "surrounding metro areas";
  const stateName = city.stateName || city.stateCode;
  const directiveAngle = manualDirective || "cap table management and equity transparency for startups";

  return {
    slug: `${city.slug}-local-vibe-${Date.now()}`,
    citySlug: city.slug,
    locale: "en-US" as const,
    seo: {
      title: `Cap Table Readiness in ${city.cityName}, ${city.stateCode} | Tableicity`,
      description: `Founders in ${city.cityName}, ${stateName} use Tableicity for privacy-first cap table management and audit readiness near ${landmarkText}.`.slice(0, 200),
    },
    article: {
      headline: `${city.cityName}, ${stateName} Founders Embrace Privacy-First Cap Table Management with Tableicity`,
      subheadline: `Local entrepreneurs near ${landmarkText} gain audit-ready equity tools`,
      dateline: `${city.cityName.toUpperCase()}, ${city.stateCode} —`,
      bodyHtml: `<p><strong>${city.cityName}, ${stateName}</strong> — As the startup ecosystem in ${city.cityName} continues to grow, founders and finance operators are turning to Tableicity for privacy-first cap table management that meets the demands of modern equity governance.</p>

<p>Located near ${landmarkText}, ${city.cityName}'s business community has long been a hub for innovation. With neighboring cities like ${nearbyText} contributing to a thriving regional economy, the need for accurate, audit-ready cap table solutions has never been greater.</p>

<p>Tableicity provides ${city.cityName}-area founders with a comprehensive platform that combines SHA-256 encrypted data integrity, zero-knowledge proofs for sensitive shareholder information, and on-demand auditor reveal capabilities. These features are specifically designed for the ${directiveAngle} needs of growing companies.</p>

<p>"For founders in ${city.cityName} and across ${stateName}, cap table accuracy isn't just about compliance — it's about building trust with investors, employees, and future acquirers," said the Tableicity team. "Our platform ensures every equity transaction is verifiable, every share class is properly documented, and every stakeholder has appropriate visibility."</p>

<p>Key features available to ${city.cityName} founders include:</p>
<ul>
<li><strong>Automated 409A Integration</strong> — Seamless valuation workflows that keep ${city.cityName} startups compliant with IRS requirements</li>
<li><strong>Multi-class Equity Tracking</strong> — Support for common stock, preferred shares, SAFEs, convertible notes, and options pools</li>
<li><strong>Audit-Ready Reports</strong> — One-click generation of cap table snapshots suitable for due diligence, fundraising, and tax filing</li>
<li><strong>Privacy-First Architecture</strong> — Shareholder PII is never exposed in plain text; zero-knowledge proofs validate ownership without revealing personal details</li>
</ul>

<p>As ${city.cityName}'s startup scene matures alongside growth in ${nearbyText}, Tableicity remains committed to providing the infrastructure that enables founders to focus on building their businesses while maintaining institutional-grade equity management.</p>

<p>Tableicity is currently available to founders and CFOs across all 50 US states, with dedicated onboarding support for companies in the ${city.cityName} metropolitan area.</p>`,
      boilerplateHtml: `<p><strong>About Tableicity</strong> — Tableicity is a privacy-first cap table management platform designed for US founders, CFOs, and finance operators. Featuring SHA-256 data integrity, zero-knowledge proofs, and on-demand auditor reveal, Tableicity provides institutional-grade equity management tools to companies of all sizes. Learn more at <a href="https://www.tableicity.com">www.tableicity.com</a>.</p>`,
    },
    attribution: {
      authorName: "Tableicity" as const,
      authorType: "Organization" as const,
      publisherName: "Tableicity" as const,
    },
    conductor: {
      manualDirective: manualDirective || undefined,
    },
  };
}

async function hasDuplicateWithin30Days(citySlug: string): Promise<boolean> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const results = await db.select({ id: knowledgeArticles.id })
    .from(knowledgeArticles)
    .where(and(
      eq(knowledgeArticles.citySlug, citySlug),
      or(
        eq(knowledgeArticles.status, "pending"),
        eq(knowledgeArticles.status, "published")
      ),
      gte(knowledgeArticles.createdAt, thirtyDaysAgo)
    ))
    .limit(1);
  return results.length > 0;
}

const MAX_BATCH = 50;
const CONCURRENCY = 3;

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { citySlugs, manualDirective = "" } = body;

  if (!Array.isArray(citySlugs) || citySlugs.length === 0) {
    return NextResponse.json({ error: "citySlugs array is required" }, { status: 400 });
  }

  const dedupedSlugs = [...new Set(citySlugs.filter((s: any) => typeof s === "string" && s.length > 0))];

  if (dedupedSlugs.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH} cities per batch. Received ${dedupedSlugs.length}.` }, { status: 400 });
  }

  const pLimitModule = await import("p-limit");
  const limit = pLimitModule.default(CONCURRENCY);

  const generated: string[] = [];
  const skipped: string[] = [];
  const failed: { slug: string; reason: string }[] = [];

  const internalPort = process.env.PORT || "5000";
  const internalDraftUrl = `http://localhost:${internalPort}/api/knowledge/draft`;

  const tasks = dedupedSlugs.map((citySlug: string) =>
    limit(async () => {
      try {
        const city = await storage.getCityBySlug(citySlug);
        if (!city) {
          failed.push({ slug: citySlug, reason: "City not found" });
          await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "fail", errorMessage: "City not found" });
          return;
        }

        const isDupe = await hasDuplicateWithin30Days(citySlug);
        if (isDupe) {
          skipped.push(citySlug);
          await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "skipped", errorMessage: "Duplicate within 30 days" });
          return;
        }

        const payload = generateStubPayload({
          cityName: city.cityName,
          stateCode: city.stateCode,
          stateName: city.stateName,
          slug: city.slug,
          localLandmarks: city.localLandmarks,
          nearbyCities: city.nearbyCities,
        }, manualDirective);

        const validationResult = KnowledgeDraftPayloadV1.safeParse(payload);
        if (!validationResult.success) {
          failed.push({ slug: citySlug, reason: "Payload validation failed" });
          await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "fail", errorMessage: "Payload validation failed" });
          return;
        }

        const draftBody = { ...validationResult.data, citySlug: city.slug };
        const res = await fetch(internalDraftUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: req.headers.get("cookie") ?? "",
          },
          body: JSON.stringify(draftBody),
        });

        if (res.ok) {
          const result = await res.json();
          generated.push(result.slug || citySlug);
          await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "success" });
        } else {
          const errData = await res.json().catch(() => ({}));
          failed.push({ slug: citySlug, reason: errData.errors?.[0] || `HTTP ${res.status}` });
          await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "fail", errorMessage: errData.errors?.[0] || `HTTP ${res.status}` });
        }
      } catch (err: any) {
        failed.push({ slug: citySlug, reason: err.message || "Unknown error" });
        await db.insert(knowledgeGenerationLog).values({ citySlug, directive: manualDirective || null, status: "fail", errorMessage: err.message || "Unknown error" });
      }
    })
  );

  await Promise.all(tasks);

  return NextResponse.json({
    generated,
    skipped,
    failed: failed.map(f => f.slug),
    failedDetails: failed,
    summary: {
      total: citySlugs.length,
      generated: generated.length,
      skipped: skipped.length,
      failed: failed.length,
    },
  });
}
