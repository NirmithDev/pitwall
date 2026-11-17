import { test } from "node:test";
import assert from "node:assert/strict";
import { localConnection, parseEnv, portNumber } from "./local-config.mjs";
test("local environment parser handles CRLF, comments and quoted values without evaluating text", () => {
  assert.deepEqual(
    parseEnv(
      '# comment\r\nPOSTGRES_DB=pitwall\r\nPOSTGRES_PASSWORD="literal;$(nothing)"\r\nnot an assignment',
    ),
    { POSTGRES_DB: "pitwall", POSTGRES_PASSWORD: "literal;$(nothing)" },
  );
});
test("connection settings quote separators and quotes without exposing credentials in errors", () => {
  const local = localConnection({
    POSTGRES_DB: "pitwall",
    POSTGRES_USER: "local",
    POSTGRES_PASSWORD: 'a;b"c',
    POSTGRES_PORT: "55432",
  });
  assert.ok(local.connection.includes('Password="a;b""c"'));
  assert.throws(
    () => localConnection({ POSTGRES_PASSWORD: "sensitive" }),
    (error) => !error.message.includes("sensitive"),
  );
});
test("ports reject invalid numbers and preserve explicit valid choices", () => {
  assert.equal(portNumber(undefined, 5080), 5080);
  assert.equal(portNumber("5082", 5080), 5082);
  for (const raw of ["NaN", "0", "70000", "5.5"])
    assert.throws(() => portNumber(raw, 5080));
});
