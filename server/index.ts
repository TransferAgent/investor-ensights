import { execSync } from "child_process";

async function main() {
  try {
    const { seedDatabase } = await import("../lib/seed");
    await seedDatabase();
  } catch (e) {
    console.error("Seed error (may be expected on first run):", e);
  }

  const { spawn } = await import("child_process");
  const nextProcess = spawn("npx", ["next", "dev", "-p", "5000", "-H", "0.0.0.0"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });

  nextProcess.on("close", (code) => {
    process.exit(code || 0);
  });
}

main();
