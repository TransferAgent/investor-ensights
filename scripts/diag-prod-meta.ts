/** THROWAWAY — read-only PROD meta inspector for texitie articles. Delete after. */
import pg from "pg";
const { Client } = pg;

async function main() {
  const limit = Number(process.argv[2] ?? 6);
  const c = new Client({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const total = await c.query(`SELECT count(*)::int AS n FROM tenant_texitie.knowledge_articles`);
  const byStatusSrc = await c.query(
    `SELECT status, coalesce(meta_source,'(null)') AS meta_source, count(*)::int AS n
       FROM tenant_texitie.knowledge_articles GROUP BY 1,2 ORDER BY 1,2`,
  );
  const rows = await c.query(
    `SELECT slug, status, coalesce(meta_source,'(null)') AS meta_source,
            char_length(meta_title) AS title_len,
            char_length(meta_description) AS desc_len,
            meta_description,
            created_at
       FROM tenant_texitie.knowledge_articles
       ORDER BY created_at DESC NULLS LAST
       LIMIT $1`,
    [limit],
  );
  await c.end();
  console.log(`TOTAL texitie articles: ${total.rows[0].n}`);
  console.log(`BY status/meta_source:`);
  for (const r of byStatusSrc.rows) console.log(`  ${r.status.padEnd(12)} ${r.meta_source.padEnd(14)} ${r.n}`);
  console.log(`\nLATEST ${limit} (newest first):`);
  for (const r of rows.rows) {
    console.log(`\n  [${r.created_at?.toISOString?.() ?? r.created_at}] status=${r.status} meta_source=${r.meta_source}`);
    console.log(`    slug: ${r.slug}`);
    console.log(`    title_len=${r.title_len}  desc_len=${r.desc_len}`);
    console.log(`    desc: ${r.meta_description}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
