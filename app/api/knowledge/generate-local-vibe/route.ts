import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { KnowledgeDraftPayloadV1 } from "@/lib/knowledge/payloadContract";
import { LOCAL_VIBE_PROMPTS, type PromptVersion } from "@/config/localVibePrompts";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";
import { knowledgeGenerationLog } from "@shared/schema";

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v ?? ""),
    tpl
  );
}

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

  const directiveAngle = manualDirective
    ? manualDirective
    : "cap table management and equity transparency for startups";

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

  const { citySlug, manualDirective = "", promptVersion = "v1" } = body;

  if (!citySlug || typeof citySlug !== "string") {
    return NextResponse.json({ error: "citySlug is required" }, { status: 400 });
  }

  if (!(promptVersion in LOCAL_VIBE_PROMPTS)) {
    return NextResponse.json({ error: `Invalid promptVersion: ${promptVersion}. Available: ${Object.keys(LOCAL_VIBE_PROMPTS).join(", ")}` }, { status: 400 });
  }

  const city = await storage.getCityBySlug(citySlug);
  if (!city) {
    return NextResponse.json({ error: `City not found: ${citySlug}` }, { status: 404 });
  }

  const renderedPrompt = renderTemplate(LOCAL_VIBE_PROMPTS[promptVersion as PromptVersion], {
    cityName: city.cityName,
    stateCode: city.stateCode,
    stateName: city.stateName || city.stateCode,
    citySlug: city.slug,
    landmarks: JSON.stringify(city.localLandmarks || []),
    nearbyCities: JSON.stringify(city.nearbyCities || []),
    manualDirective,
  });

  const parsed = generateStubPayload(
    {
      cityName: city.cityName,
      stateCode: city.stateCode,
      stateName: city.stateName,
      slug: city.slug,
      localLandmarks: city.localLandmarks,
      nearbyCities: city.nearbyCities,
    },
    manualDirective
  );

  const validationResult = KnowledgeDraftPayloadV1.safeParse(parsed);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Generated payload failed validation",
        details: validationResult.error.issues,
        promptVersionUsed: promptVersion,
      },
      { status: 500 }
    );
  }

  const payload = { ...validationResult.data, citySlug: city.slug };

  const internalPort = process.env.PORT || "5000";
  const internalDraftUrl = `http://localhost:${internalPort}/api/knowledge/draft`;

  const res = await fetch(internalDraftUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (res.ok) {
    await db.insert(knowledgeGenerationLog).values({
      citySlug: city.slug,
      directive: manualDirective || null,
      status: "success",
    });
  } else {
    await db.insert(knowledgeGenerationLog).values({
      citySlug: city.slug,
      directive: manualDirective || null,
      status: "fail",
      errorMessage: result.errors?.[0] || `HTTP ${res.status}`,
    });
  }

  return NextResponse.json(
    {
      ...result,
      _meta: {
        promptVersionUsed: promptVersion,
        citySlug: city.slug,
        cityName: city.cityName,
        renderedPromptLength: renderedPrompt.length,
      },
    },
    { status: res.status }
  );
}
