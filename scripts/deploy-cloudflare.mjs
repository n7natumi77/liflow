import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (command, args) => {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
};

if (!process.argv.includes("--skip-build")) run("npm", ["run", "build"]);
const wrangler = ["wrangler", "deploy", "--config", "dist/server/wrangler.json"];
if (process.argv.includes("--dry-run")) wrangler.push("--dry-run");
run("npx", wrangler);
