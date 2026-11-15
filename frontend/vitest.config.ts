import { defineConfig } from "vitest/config";

// Bash expands unquoted globs, unlike cmd.exe; keep discovery in configuration.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
