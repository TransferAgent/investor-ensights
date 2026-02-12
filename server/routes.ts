import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { loginSchema } from "@shared/schema";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const testHash = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.session?.adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  // ====== Public routes ======

  app.get("/api/locations", async (_req, res) => {
    const cities = await storage.getCities(true);
    res.json(cities);
  });

  app.get("/api/locations/:slug", async (req, res) => {
    const city = await storage.getCityBySlug(req.params.slug);
    if (!city) {
      return res.status(404).json({ message: "City not found" });
    }

    const assignment = await storage.getAssignmentByCityId(city.id);
    let template = null;
    if (assignment?.templateId) {
      template = await storage.getTemplateById(assignment.templateId);
    }

    res.json({ city, template, assignment });
  });

  app.get("/api/sitemap", async (_req, res) => {
    const cities = await storage.getCities(true);
    const urls = cities.map((c) => ({
      slug: c.slug,
      cityName: c.cityName,
      stateCode: c.stateCode,
      updatedAt: c.updatedAt,
    }));
    res.json(urls);
  });

  // ====== Admin auth ======

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const admin = await storage.getAdminByUsername(username);
      if (!admin || !verifyPassword(password, admin.passwordHash)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.adminId = admin.id;
      res.json({ id: admin.id, username: admin.username, displayName: admin.displayName });
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/admin/me", async (req, res) => {
    if (!req.session?.adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const admin = await storage.getAdminById(req.session.adminId);
    if (!admin) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ id: admin.id, username: admin.username, displayName: admin.displayName });
  });

  // ====== Admin cities ======

  app.get("/api/admin/cities", requireAdmin, async (_req, res) => {
    const cities = await storage.getCities(false);
    res.json(cities);
  });

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.post("/api/admin/bulk-update", requireAdmin, async (req, res) => {
    const { cityIds, action, templateId } = req.body;

    if (!Array.isArray(cityIds) || cityIds.length === 0) {
      return res.status(400).json({ message: "cityIds required" });
    }

    if (action === "publish") {
      await storage.bulkUpdateCities(cityIds, { isPublished: true });
    } else if (action === "unpublish") {
      await storage.bulkUpdateCities(cityIds, { isPublished: false });
    } else if (action === "assign_template" && templateId) {
      await storage.bulkAssignTemplate(cityIds, templateId);
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    res.json({ success: true });
  });

  // ====== Admin templates ======

  app.get("/api/admin/templates", requireAdmin, async (_req, res) => {
    const templates = await storage.getTemplates(false);
    res.json(templates);
  });

  app.post("/api/admin/templates", requireAdmin, async (req, res) => {
    try {
      const template = await storage.createTemplate(req.body);
      res.status(201).json(template);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to create template" });
    }
  });

  app.patch("/api/admin/templates/:id", requireAdmin, async (req, res) => {
    const template = await storage.updateTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    res.json(template);
  });

  return httpServer;
}
