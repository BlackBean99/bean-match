import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["next", "build"]);

if (!process.env.WRANGLER_COMMAND) {
  run("npx", ["opennextjs-cloudflare", "build", "--skipNextBuild"]);
}
