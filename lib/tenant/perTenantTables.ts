// D10 from John/Locked_Gate_Table_MultiTenant_v1.0.md.
// Tables that live in tenant_<slug> schemas (post-MT-3).
// Used by code review and (future) static checks; not enforced at runtime
// until a Drizzle query interceptor is added in a later gate.

export const PER_TENANT_TABLES: ReadonlySet<string> = new Set([
  "admin_audit_log",
  "city_locations",
  "city_content_assignments",
  "city_research_sources",
  "knowledge_articles",
  "knowledge_article_versions",
  "knowledge_templates",
  "knowledge_campaigns",
  "knowledge_generation_log",
  "content_templates",
  "custom_pages",
  "page_slides",
  "haylo_articles",
  "newsroom_agents",
  "newsroom_agent_runs",
  "newsroom_agent_knowledge",
  "newsroom_pipeline_jobs",
  "newsroom_review_queue",
  "newsroom_scheduler_config",
  "newsroom_scheduler_runs",
  "newsroom_source_documents",
  "newsroom_lead_signals",
  "newsroom_internal_link_suggestions",
  "data_store_files",
]);

export const PLATFORM_TABLES: ReadonlySet<string> = new Set([
  // Created in MT-2:
  "users",
  "tenants",
  "tenant_members",
  "email_verifications",
  "city_slug_registry",
  // Pre-existing:
  "admin_users",
  "session",
]);

export function isPerTenantTable(name: string): boolean {
  return PER_TENANT_TABLES.has(name);
}

export function isPlatformTable(name: string): boolean {
  return PLATFORM_TABLES.has(name);
}
