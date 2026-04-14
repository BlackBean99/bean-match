import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const serverDir = join(process.cwd(), ".next", "server");
const chunksDir = join(serverDir, "chunks");
const runtimeFile = join(serverDir, "webpack-runtime.js");

if (!existsSync(serverDir)) {
  throw new Error("Missing .next/server. Run next build first.");
}

const requiredChunkIds = collectRequiredServerChunkIds();
const missingChunks = requiredChunkIds.filter((chunkId) => !existsSync(join(serverDir, `${chunkId}.js`)));

if (missingChunks.length > 0) {
  throw new Error(`Missing server runtime chunks: ${missingChunks.map((chunkId) => `${chunkId}.js`).join(", ")}`);
}

for (const entry of serverEntries()) {
  await import(pathToFileURL(entry).href);
}

console.log(
  `Verified Next server bundle: ${requiredChunkIds.length} runtime chunks, ${serverEntries().length} server entries.`,
);

function collectRequiredServerChunkIds() {
  if (!existsSync(runtimeFile)) return [];

  const chunkIds = new Set();
  for (const filePath of listJavaScript(serverDir)) {
    if (filePath.startsWith(`${chunksDir}${sep}`)) continue;

    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/\.X\(0,\[([0-9,\s]+)\]/g)) {
      for (const chunkId of match[1].split(",")) {
        const normalizedChunkId = chunkId.trim();
        if (normalizedChunkId) chunkIds.add(normalizedChunkId);
      }
    }
  }

  return [...chunkIds].sort((left, right) => Number(left) - Number(right));
}

function serverEntries() {
  return listJavaScript(serverDir)
    .filter((filePath) => {
      if (filePath.startsWith(`${chunksDir}${sep}`)) return false;
      if (filePath.endsWith("_client-reference-manifest.js")) return false;
      if (filePath.endsWith("webpack-runtime.js")) return false;
      if (/[/\\]\d+\.js$/.test(filePath)) return false;

      const relativePath = relative(serverDir, filePath);
      return relativePath.startsWith(`app${sep}`) || relativePath.startsWith(`pages${sep}`);
    })
    .sort();
}

function listJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScript(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}
