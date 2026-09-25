import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const firebaseCli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
const result = spawnSync(process.execPath, [
  firebaseCli,
  "emulators:exec",
  "--project", "demo-liflow-rules",
  "--only", "firestore",
  "node --test tests/firestore.rules.test.mjs",
], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
