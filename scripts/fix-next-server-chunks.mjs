import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const serverDir = join(process.cwd(), ".next", "server");
const chunksDir = join(serverDir, "chunks");
const runtimeFile = join(serverDir, "webpack-runtime.js");

if (!existsSync(chunksDir)) {
  process.exit(0);
}

mkdirSync(serverDir, { recursive: true });

for (const fileName of readdirSync(chunksDir)) {
  if (!fileName.endsWith(".js")) continue;

  const source = join(chunksDir, fileName);
  const destination = join(serverDir, basename(fileName));
  if (!existsSync(destination) || statSync(source).size !== statSync(destination).size) {
    copyFileSync(source, destination);
  }
}

const runtime = existsSync(runtimeFile) ? readFileSync(runtimeFile, "utf8") : "";
const runtimeLoadsServerRootChunks = runtime.includes('return "" + chunkId + ".js"');
if (!runtimeLoadsServerRootChunks) {
  process.exit(0);
}

const missingChunks = requiredServerChunkIds()
  .map((chunkId) => join(serverDir, `${chunkId}.js`))
  .filter((chunkPath) => !existsSync(chunkPath));

if (missingChunks.length > 0) {
  throw new Error(
    `Next server chunks are missing after postbuild: ${missingChunks
      .map((chunkPath) => relative(process.cwd(), chunkPath))
      .join(", ")}`,
  );
}

function requiredServerChunkIds() {
  const chunkIds = new Set();
  for (const filePath of listServerJavaScript(serverDir)) {
    if (filePath.startsWith(chunksDir)) continue;

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

function listServerJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listServerJavaScript(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}
