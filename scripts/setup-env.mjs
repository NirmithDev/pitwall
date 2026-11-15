import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const file = new URL("../.env", import.meta.url);
try {
  await writeFile(
    file,
    `POSTGRES_DB=pitwall\nPOSTGRES_USER=pitwall\nPOSTGRES_PASSWORD=${randomBytes(24).toString("hex")}\nPOSTGRES_PORT=55432\nAPP_PORT=8080\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env with a random local database password. It is ignored by Git.",
  );
} catch (error) {
  if (error.code === "EEXIST")
    console.log(".env already exists; keeping your settings.");
  else throw error;
}
