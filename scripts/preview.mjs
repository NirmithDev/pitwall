// One command for a built local preview. No Docker access or global config changes.
import { readFile, access } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  localConnection,
  parseEnv,
  portNumber,
  tcpReady,
} from "./local-config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const args = process.argv.slice(2),
    snapshot = args.includes("--snapshot"),
    index = args.indexOf("--port");
  if (
    args.some(
      (a, i) =>
        a !== "--snapshot" &&
        a !== "--port" &&
        !(index >= 0 && i === index + 1),
    )
  )
    throw new Error(
      "Usage: node scripts/preview.mjs [--snapshot] [--port 5080]",
    );
  const port = portNumber(index >= 0 ? args[index + 1] : undefined, 5080);
  if (index >= 0 && !args[index + 1])
    throw new Error("--port needs a port number.");
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Node 24 or newer is required.");
  const dotnet = spawnSync("dotnet", ["--version"], {
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  if (dotnet.status !== 0)
    throw new Error(
      "The .NET SDK is unavailable. Install .NET 10 before starting the preview.",
    );
  if (Number(dotnet.stdout.trim().split(".")[0]) < 10)
    throw new Error("The preview requires .NET 10 or newer.");
  if (await tcpReady(port)) {
    const status = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (status?.version) {
      console.log(
        `Pitwall ${status.version} is already running at http://127.0.0.1:${port} (${status.storage}).`,
      );
      process.exit(0);
    }
    throw new Error(
      `Port ${port} is already in use. Choose another with --port.`,
    );
  }
  const dll = path.join(
      root,
      "backend/Pitwall.Api/bin/Release/net10.0/Pitwall.Api.dll",
    ),
    webroot = path.join(root, "frontend/dist");
  try {
    await access(dll);
    await access(path.join(webroot, "index.html"));
  } catch {
    throw new Error(
      "Build first: dotnet build backend/Pitwall.Api -c Release; then run npm run build in frontend.",
    );
  }
  let connection = "";
  if (!snapshot) {
    const settings = parseEnv(
      await readFile(path.join(root, ".env"), "utf8").catch(() => {
        throw new Error("Missing .env. Run node scripts/setup-env.mjs first.");
      }),
    );
    const local = localConnection(settings);
    if (!(await tcpReady(local.port)))
      throw new Error(
        `PostgreSQL is unavailable on 127.0.0.1:${local.port}. Start Docker Desktop, then run docker compose up -d db.`,
      );
    connection = local.connection;
  }
  console.log(
    `Starting Pitwall at http://127.0.0.1:${port} · ${snapshot ? "temporary snapshot storage" : "PostgreSQL"}. Ctrl+C stops it.`,
  );
  const child = spawn(
    "dotnet",
    [dll, "--urls", `http://127.0.0.1:${port}`, "--webroot", webroot],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: "Development",
        Catalog__AutoRefresh: "false",
        ConnectionStrings__Pitwall: connection,
        Logging__LogLevel__Default: "Warning",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      child.kill(signal);
    });
  child.once("error", (error) => {
    console.error(`Preview failed: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 0;
  });
} catch (error) {
  console.error(`Preview: ${error.message}`);
  process.exitCode = 1;
}
