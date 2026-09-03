import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptsDirectory, "..");
const source = resolve(frontendRoot, "dist");
const target = resolve(frontendRoot, "../backend/German.Api/wwwroot");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`Copied frontend build to ${target}`);
