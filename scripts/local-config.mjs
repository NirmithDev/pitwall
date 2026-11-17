import net from "node:net";
export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}
export function portNumber(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535)
    throw new Error("Use a port between 1 and 65535.");
  return n;
}
export function localConnection(settings) {
  for (const key of ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"])
    if (!settings[key])
      throw new Error(`Missing ${key}. Run node scripts/setup-env.mjs first.`);
  const port = portNumber(settings.POSTGRES_PORT, 55432),
    quote = (value) => '"' + String(value).replaceAll('"', '""') + '"';
  return {
    port,
    connection: `Host=127.0.0.1;Port=${port};Database=${quote(settings.POSTGRES_DB)};Username=${quote(settings.POSTGRES_USER)};Password=${quote(settings.POSTGRES_PASSWORD)}`,
  };
}
export function tcpReady(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let done = false;
    const finish = (ready) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(1500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}
