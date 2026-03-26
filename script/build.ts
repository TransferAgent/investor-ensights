import { execSync } from "child_process";
import { rm, writeFile, cp, mkdir } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building Next.js app...");
  execSync("npx next build", { stdio: "inherit" });

  console.log("copying static assets to standalone...");
  await cp("public", ".next/standalone/public", { recursive: true });
  await cp(".next/static", ".next/standalone/.next/static", { recursive: true });

  console.log("creating production entry point...");
  await mkdir("dist", { recursive: true });
  const entryScript = `
const { execSync } = require("child_process");
const path = require("path");

process.env.PORT = process.env.PORT || "5000";
process.env.HOSTNAME = "0.0.0.0";

const standalonePath = path.join(__dirname, "..", ".next", "standalone", "server.js");
require(standalonePath);
`;
  await writeFile("dist/index.cjs", entryScript.trim());

  console.log("production build complete!");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
