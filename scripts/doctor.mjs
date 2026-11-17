import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { localConnection, parseEnv, tcpReady } from "./local-config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
console.log(
  "Pitwall local setup check (read-only; credentials are never printed)",
);
for (const [name, command, args] of [
  ["Node", "node", ["--version"]],
  [".NET", "dotnet", ["--version"]],
  ["Git", "git", ["--version"]],
  ["Docker CLI", "docker", ["--version"]],
  ["Docker Compose", "docker", ["compose", "version"]],
]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  console.log(
    `${name}: ${result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : "unavailable in this terminal"}`,
  );
}
for (const [label, relative] of [
  ["Frontend dependencies", "frontend/node_modules"],
  ["Frontend build", "frontend/dist/index.html"],
  ["Release API", "backend/Pitwall.Api/bin/Release/net10.0/Pitwall.Api.dll"],
]) {
  try {
    await access(path.join(root, relative));
    console.log(`${label}: present`);
  } catch {
    console.log(`${label}: not built / installed`);
  }
}
try {
  const local = localConnection(
    parseEnv(await readFile(path.join(root, ".env"), "utf8")),
  );
  console.log(`Development environment: configured`);
  console.log(
    `PostgreSQL TCP 127.0.0.1:${local.port}: ${(await tcpReady(local.port)) ? "reachable" : "not reachable; start Docker Desktop and docker compose up -d db"}`,
  );
} catch {
  console.log(
    "Development environment: missing or invalid .env; run node scripts/setup-env.mjs",
  );
}
for (const port of [5080, 5173, 8080]) {
  if (!(await tcpReady(port))) {
    console.log(`Local port ${port}: not listening`);
    continue;
  }
  const status = await fetch(`http://127.0.0.1:${port}/api/status`, {
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  console.log(
    `Local port ${port}: ${status?.version ? `Pitwall ${status.version} / ${status.storage}` : "in use"}`,
  );
}
