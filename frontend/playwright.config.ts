import { defineConfig } from "@playwright/test";
const preparedPreview = process.env.PITWALL_E2E_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: preparedPreview ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: preparedPreview ? undefined : [
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
