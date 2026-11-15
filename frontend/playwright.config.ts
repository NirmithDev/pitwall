import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    {
      command:
        "dotnet run --no-build -c Release --project ../backend/Pitwall.Api --urls http://127.0.0.1:5080",
      url: "http://127.0.0.1:5080/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: { ConnectionStrings__Pitwall: "", Catalog__AutoRefresh: "false" },
    },
    {
      command: "npm run preview",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
