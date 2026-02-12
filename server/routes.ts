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

  // ====== SEO: sitemap.xml and robots.txt ======

  app.get("/sitemap.xml", async (req, res) => {
    const cities = await storage.getCities(true);
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const today = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    for (const city of cities) {
      const lastmod = city.updatedAt
        ? new Date(city.updatedAt).toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/locations/${city.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.set("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/robots.txt", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const txt = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api/admin",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join("\n");

    res.set("Content-Type", "text/plain");
    res.send(txt);
  });

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

  app.post("/api/admin/cities", requireAdmin, async (req, res) => {
    try {
      const { cityName, stateCode, stateName, streetAddress, zipCode, phoneNumber, email, slug, localLandmarks, nearbyCities, latitude, longitude, isPublished, displayOrder } = req.body;
      if (!cityName || !stateCode) {
        return res.status(400).json({ message: "City name and state code are required" });
      }
      const finalSlug = slug || `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stateCode.toLowerCase()}`;
      const existing = await storage.getCityBySlug(finalSlug);
      if (existing) {
        return res.status(409).json({ message: "A city with this slug already exists" });
      }
      const city = await storage.createCity({
        cityName,
        stateCode,
        stateName: stateName || null,
        streetAddress: streetAddress || null,
        zipCode: zipCode || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        slug: finalSlug,
        localLandmarks: localLandmarks || [],
        nearbyCities: nearbyCities || [],
        latitude: latitude || null,
        longitude: longitude || null,
        isPublished: isPublished ?? false,
        displayOrder: displayOrder ?? 0,
      });
      res.status(201).json(city);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to create city" });
    }
  });

  app.patch("/api/admin/cities/:id", requireAdmin, async (req, res) => {
    try {
      const city = await storage.updateCity(req.params.id, req.body);
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(city);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to update city" });
    }
  });

  app.delete("/api/admin/cities/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCity(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to delete city" });
    }
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
