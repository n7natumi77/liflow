import { validateProductionEnvironment } from "../domain/production-config.ts";

const result = validateProductionEnvironment(process.env);
console.log(`Phase 2.5 production configuration: ${result.valid ? "ready" : "incomplete"}`);
console.log(`Configured keys: ${result.configured.length}`);
if (result.missing.length) console.error(`Missing keys: ${result.missing.join(", ")}`);
if (!result.valid && !process.argv.includes("--allow-missing")) process.exitCode = 1;
