import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withTenantAsync } from "@/lib/tenant/context";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {

  const result1 = await db.execute(sql`
    UPDATE knowledge_articles 
    SET body_html = REPLACE(body_html, '<p><strong>FOR IMMEDIATE RELEASE</strong></p>', ''),
        date_modified = NOW(),
        updated_at = NOW()
    WHERE body_html LIKE '%FOR IMMEDIATE RELEASE%'
  `);

  const result2 = await db.execute(sql`
    UPDATE knowledge_articles 
    SET body_html = REPLACE(body_html, 'said the Founder of Tableicity', 'said Brian Reynolds, CEO and Founder of Tableicity'),
        date_modified = NOW(),
        updated_at = NOW()
    WHERE body_html LIKE '%said the Founder of Tableicity%'
  `);

  const result3 = await db.execute(sql`
    UPDATE knowledge_templates 
    SET body_html_pattern = REPLACE(body_html_pattern, '<p><strong>FOR IMMEDIATE RELEASE</strong></p>', '')
    WHERE body_html_pattern LIKE '%FOR IMMEDIATE RELEASE%'
  `);

  const result4 = await db.execute(sql`
    UPDATE knowledge_templates 
    SET body_html_pattern = REPLACE(body_html_pattern, 'said the Founder of Tableicity', 'said Brian Reynolds, CEO and Founder of Tableicity')
    WHERE body_html_pattern LIKE '%said the Founder of Tableicity%'
  `);

  return NextResponse.json({
    articlesForImmediateRelease: result1.rowCount,
    articlesQuoteUpdated: result2.rowCount,
    templatesForImmediateRelease: result3.rowCount,
    templatesQuoteUpdated: result4.rowCount,
  });
  });
}
