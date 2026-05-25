import { lookup } from "node:dns/promises";
import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";

const exampleEnv = loadEnvFile(".env.example");
const localEnv = loadEnvFile(".env.local");

const requiredChecks = [
  { label: "Supabase URL", keys: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] },
  { label: "Supabase anon key", keys: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
  { label: "Supabase service role key", keys: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { label: "Notion token", keys: ["NOTION_TOKEN"] },
  { label: "Notion main source", keys: ["NOTION_MAIN_DATA_SOURCE_ID", "NOTION_USERS_DATABASE_ID"] },
];

const recommendedChecks = [
  { label: "Notion invitor source", keys: ["NOTION_INVITOR_DATA_SOURCE_ID"] },
  {
    label: "Notion matching history source",
    keys: ["NOTION_MATCHING_HISTORY_DATA_SOURCE_ID", "NOTION_MATCHING_HISTORY_DATABASE_ID"],
  },
];

const missingCritical = [];
const missingRecommended = [];

console.log("Environment check");
console.log(`- .env.example: ${existsSync(".env.example") ? "found" : "missing"}`);
console.log(`- .env.local: ${existsSync(".env.local") ? "found" : "missing"}`);

if (!existsSync(".env.local")) {
  console.error("Critical: .env.local is missing.");
  process.exit(1);
}

for (const check of requiredChecks) {
  if (!hasAnyValue(localEnv, check.keys)) missingCritical.push(check.label);
}

for (const check of recommendedChecks) {
  if (!hasAnyValue(localEnv, check.keys)) missingRecommended.push(check.label);
}

const exampleKeys = new Set(Object.keys(exampleEnv));
const localKeys = new Set(Object.keys(localEnv));
const undocumentedLocalKeys = [...localKeys].filter((key) => !exampleKeys.has(key)).sort();

console.log("\nRequired");
for (const check of requiredChecks) {
  console.log(`- ${check.label}: ${hasAnyValue(localEnv, check.keys) ? "ok" : "missing"}`);
}

console.log("\nRecommended");
for (const check of recommendedChecks) {
  console.log(`- ${check.label}: ${hasAnyValue(localEnv, check.keys) ? "ok" : "missing"}`);
}

console.log("\nGit contract");
console.log(`- Documented keys in .env.example: ${exampleKeys.size}`);
console.log(`- Keys present in .env.local: ${localKeys.size}`);
console.log(`- Undocumented local-only keys: ${undocumentedLocalKeys.length === 0 ? "none" : undocumentedLocalKeys.join(", ")}`);

const supabaseUrl = localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || "";
if (supabaseUrl) {
  const host = safeHostFromUrl(supabaseUrl);
  process.stdout.write(`\nSupabase host\n- ${host}: `);
  try {
    await lookup(host);
    console.log("resolves");
  } catch (error) {
    console.log(`unreachable (${error instanceof Error ? error.message : String(error)})`);
    missingCritical.push(`Supabase host resolution (${host})`);
  }
}

if (missingCritical.length > 0) {
  console.error(`\nCritical issues: ${missingCritical.join(", ")}`);
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn(`\nRecommended follow-up: ${missingRecommended.join(", ")}`);
}

console.log("\nEnvironment looks usable.");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[match[1]] = value;
  }

  return values;
}

function hasAnyValue(values, keys) {
  return keys.some((key) => Boolean(values[key]));
}

function safeHostFromUrl(value) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
