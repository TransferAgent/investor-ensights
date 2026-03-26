import { createServer } from "http";
import { parse } from "url";
import next from "next";

const port = parseInt(process.env.PORT || "5000", 10);
const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

async function main() {
  try {
    const { seedDatabase } = await import("../lib/seed");
    await seedDatabase();
  } catch (e) {
    console.error("Seed error (may be expected):", e);
  }

  await app.prepare();

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(port, "0.0.0.0", () => {
    console.log(`> Production server ready on http://0.0.0.0:${port}`);
  });
}

main();
