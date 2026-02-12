import { storage } from "./storage";

export async function logAuditEvent(opts: {
  username: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await storage.createAuditLog({
      adminUsername: opts.username,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId || null,
      details: opts.details || null,
      ipAddress: opts.ipAddress || null,
      adminId: null,
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}
