// Run this from your own terminal so Windows Credential Manager uses your account.
// Credentials stay in Git Credential Manager; this script never reads or prints them.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url)).replace(
  /[\\/]$/,
  "",
);
const base = ["-c", `safe.directory=${root}`, "-C", root];
const branches =
  process.argv.length > 2 ? [...new Set(process.argv.slice(2))] : ["main"];
for (const branch of branches) {
  const exists = spawnSync(
    "git",
    [...base, "show-ref", "--verify", `refs/heads/${branch}`],
    { stdio: "ignore" },
  );
  if (exists.status !== 0 || branch.startsWith("-")) {
    console.error(`Not a local branch: ${branch}. No push was attempted.`);
    process.exit(1);
  }
}
const remote = spawnSync("git", [...base, "remote", "get-url", "origin"], {
  encoding: "utf8",
});
if (
  remote.status !== 0 ||
  remote.stdout.trim() !== "https://github.com/NirmithDev/pitwall.git"
) {
  console.error(
    "Expected the NirmithDev/pitwall origin. No push was attempted.",
  );
  process.exit(1);
}

// Isolate this repository from stale credentials used for other GitHub projects.
const config = spawnSync(
  "git",
  [...base, "config", "--local", "credential.namespace", "pitwall"],
  {
    stdio: "inherit",
  },
);
if (config.status !== 0) process.exit(config.status ?? 1);

console.log(
  `Pushing Pitwall branches: ${branches.join(", ")}. If prompted, open https://github.com/login/device in Brave.`,
);
console.log(
  "Enter the code shown by Git Credential Manager and authorize your own GitHub account.",
);
console.log(
  "Do not enter an account password as a Git password, or paste a token into chat.",
);

const push = spawnSync(
  "git",
  [
    ...base,
    "-c",
    "credential.helper=",
    "-c",
    "credential.helper=manager",
    "-c",
    "credential.gitHubAuthModes=device",
    "-c",
    "credential.guiPrompt=false",
    "push",
    "--follow-tags",
    "--atomic",
    "-u",
    "origin",
    ...branches,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      GCM_GITHUB_AUTHMODES: "device",
      GCM_GUI_PROMPT: "false",
      GCM_INTERACTIVE: "always",
      GIT_TERMINAL_PROMPT: "1",
    },
  },
);
process.exit(push.status ?? 1);
