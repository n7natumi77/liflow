import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const buildCli = fileURLToPath(new URL("./run-framework.mjs", import.meta.url));
const wranglerCli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const runNode = (entry, args) => {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
};

if (!process.argv.includes("--skip-build")) runNode(buildCli, ["build"]);
const wrangler = ["deploy", "--config", "dist/server/wrangler.json"];
if (process.argv.includes("--dry-run")) wrangler.push("--dry-run");
runNode(wranglerCli, wrangler);
