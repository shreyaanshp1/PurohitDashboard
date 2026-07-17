import fs from "node:fs";
import path from "node:path";

export function loadEnvFiles(files = [".env.local", ".env"]) {
  for (const file of files) {
    const absolutePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(absolutePath)) continue;

    const contents = fs.readFileSync(absolutePath, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = parseEnvValue(trimmed.slice(separator + 1).trim());

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function parseEnvValue(value) {
  const quote = value[0];
  const isQuoted = (quote === `"` || quote === "'") && value[value.length - 1] === quote;
  return isQuoted ? value.slice(1, -1) : value;
}
