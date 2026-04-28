import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { HayloArticle, CityLocation } from "@shared/schema";

export type PickerStrategy = "balanced" | "newest_first" | "random";

export interface PickedPair {
  haylo: HayloArticle;
  city: CityLocation;
}

type CandidateRow = {
  haylo_id: string;
  haylo_slug: string;
  haylo_title: string;
  haylo_topic_slug: string;
  haylo_body_html: string;
  haylo_summary: string | null;
  haylo_status: string;
  haylo_source: string;
  haylo_source_filename: string | null;
  haylo_content_hash: string;
  haylo_placement_count: number;
  haylo_created_at: Date;
  haylo_updated_at: Date;
  city_id: string;
  city_slug: string;
  city_name: string;
  state_code: string;
  state_name: string;
  last_paired_at: Date | null;
} & Record<string, unknown>;

function rowsToPair(row: CandidateRow): PickedPair {
  return {
    haylo: {
      id: row.haylo_id,
      slug: row.haylo_slug,
      title: row.haylo_title,
      topicSlug: row.haylo_topic_slug,
      bodyHtml: row.haylo_body_html,
      summary: row.haylo_summary,
      status: row.haylo_status,
      source: row.haylo_source,
      sourceFilename: row.haylo_source_filename,
      contentHash: row.haylo_content_hash,
      placementCount: row.haylo_placement_count,
      createdAt: row.haylo_created_at,
      updatedAt: row.haylo_updated_at,
    } as HayloArticle,
    city: { id: row.city_id, slug: row.city_slug, cityName: row.city_name, stateCode: row.state_code, stateName: row.state_name } as CityLocation,
  };
}

export async function pickNextPair(strategy: PickerStrategy = "balanced"): Promise<PickedPair | null> {
  let orderClause: ReturnType<typeof sql>;
  if (strategy === "newest_first") {
    orderClause = sql`h.created_at DESC, c.created_at ASC`;
  } else if (strategy === "random") {
    orderClause = sql`random()`;
  } else {
    orderClause = sql`h.placement_count ASC, h.created_at ASC, last_paired.last_paired_at ASC NULLS FIRST, c.created_at ASC`;
  }

  const result = await db.execute<CandidateRow>(sql`
    WITH last_paired AS (
      SELECT city_slug, MAX(created_at) AS last_paired_at
      FROM knowledge_articles
      WHERE city_slug IS NOT NULL
      GROUP BY city_slug
    )
    SELECT
      h.id AS haylo_id, h.slug AS haylo_slug, h.title AS haylo_title, h.topic_slug AS haylo_topic_slug,
      h.body_html AS haylo_body_html, h.summary AS haylo_summary, h.status AS haylo_status,
      h.source AS haylo_source, h.source_filename AS haylo_source_filename, h.content_hash AS haylo_content_hash,
      h.placement_count AS haylo_placement_count, h.created_at AS haylo_created_at, h.updated_at AS haylo_updated_at,
      c.id AS city_id, c.slug AS city_slug, c.city_name, c.state_code, c.state_name,
      last_paired.last_paired_at AS last_paired_at
    FROM haylo_articles h
    CROSS JOIN city_locations c
    LEFT JOIN last_paired ON last_paired.city_slug = c.slug
    WHERE h.status = 'ready'
      AND c.is_published = true
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_articles ka
        WHERE ka.haylo_article_id = h.id AND ka.city_slug = c.slug
      )
      AND NOT EXISTS (
        SELECT 1 FROM newsroom_review_queue rq
        WHERE rq.city_slug = c.slug
          AND rq.status = 'pending'
          AND rq.draft_payload->>'hayloArticleId' = h.id::text
      )
    ORDER BY ${orderClause}
    LIMIT 1
  `);

  const rows = (result as { rows: CandidateRow[] }).rows ?? [];
  if (rows.length === 0) return null;
  return rowsToPair(rows[0]);
}

export async function countEligiblePairs(): Promise<number> {
  const result = await db.execute<{ n: string }>(sql`
    SELECT COUNT(*)::text AS n
    FROM haylo_articles h
    CROSS JOIN city_locations c
    WHERE h.status = 'ready'
      AND c.is_published = true
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_articles ka
        WHERE ka.haylo_article_id = h.id AND ka.city_slug = c.slug
      )
      AND NOT EXISTS (
        SELECT 1 FROM newsroom_review_queue rq
        WHERE rq.city_slug = c.slug
          AND rq.status = 'pending'
          AND rq.draft_payload->>'hayloArticleId' = h.id::text
      )
  `);
  const rows = (result as { rows: { n: string }[] }).rows ?? [];
  return rows.length === 0 ? 0 : Number(rows[0].n);
}
