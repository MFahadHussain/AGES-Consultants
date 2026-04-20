// This script starts the Next.js dev server and keeps it alive
import { spawn } from "child_process";

console.log("[keeper] Starting Next.js dev server...");

const server = spawn("npx", ["next", "dev", "--turbopack", "-p", "3000"], {
  cwd: "/home/z/my-project",
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
});

server.on("exit", (code) => {
  console.log(`[keeper] Server exited with code ${code}`);
  process.exit(1);
});

// Self-ping to keep process active
setInterval(async () => {
  try {
    const resp = await fetch("http://127.0.0.1:3000/");
    if (!resp.ok) console.log(`[keeper] Ping returned ${resp.status}`);
  } catch {
    console.log("[keeper] Ping failed");
  }
}, 5000);

// Keep the process alive
process.on("SIGTERM", () => {
  console.log("[keeper] Received SIGTERM, ignoring to stay alive");
});
process.on("SIGINT", () => {
  console.log("[keeper] Received SIGINT, ignoring to stay alive");
});
