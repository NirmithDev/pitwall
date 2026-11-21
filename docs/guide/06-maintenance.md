# Storage, validation and keeping the guide current

[Guide home](../USER-GUIDE.md) · [Sandbox](05-race-sandbox.md) · [Contributor workflow](../../CONTRIBUTING.md)

<a id="ops-01"></a>
## OPS-01 — Know where data lives

**What:** Distinguish durable server data, browser saves and temporary drafts.

**How:** Read the storage indicator and use this matrix before switching addresses, restarting or clearing anything.

| Data | PostgreSQL mode | Snapshot mode | Browser origin |
| --- | --- | --- | --- |
| Bundled timing/Monza analysis | Seeded into server cache | Loaded from bundled files | Not browser saves |
| Imported timing/locations/analysis/catalog | Database, survives API restart | API memory; imports disappear on restart | Shared through that API |
| Replay bookmarks | Database, shared by visitors to that instance | API memory | Not private browser/account data |
| Theme/default map/named map layouts | Browser only | Browser only | Hostname + port + scheme + browser/profile |
| Saved circuits/sandbox setups/strategy scenarios | Browser only | Browser only | Same origin isolation |
| Unsaved drafts, tool selections, simulation clock | Current page/tool session | Current page/tool session | Not automatically restored |
| Multiplayer rooms/shared race clock | API process memory; lost on restart | API process memory; lost on restart | Guest credential in tab session storage, no token in invitation |
| Exported files | Download location you choose | Download location you choose | Not automatically re-imported |

**Result and storage:** `localhost:5080`, `127.0.0.1:5080`, `localhost:5173` and `localhost:8080` are different browser origins. They can expose the same database while showing different browser-only saves. Different browsers/profiles are isolated too.

**Recovery and limits:** Return to the original origin/profile before assuming a save is lost. Browser clearing/private sessions can erase browser-only data. Bookmarks have no account ownership or privacy boundary in this development app. There is no universal backup/export/restore button; circuit JSON is the currently supported file import.

<a id="ops-02"></a>
## OPS-02 — Validate a change locally

**What:** Check the relevant behavior before treating a change as finished.

**How:** Run `node scripts/check-docs.mjs` for the guide. For implementation changes use the applicable checks in [Testing](../TESTING.md): frontend unit/build/browser checks, Node importer/local-helper checks, real API integration and storage/concurrency checks. Build the Release API before checks that run its DLL.

**Result and storage:** Test results, screenshots/traces and integration output provide evidence. API/storage checks create uniquely identified test records and clean up those records; they do not reset the database. The optional lookup benchmark compares with the local v1.2 tag and asserts sampled correctness before reporting time.

**Recovery and limits:** Use failure artifacts to investigate before repeating broad suites. A lookup benchmark is not browser FPS or proof of simulation accuracy. Routine automated tests use cached data/provider fixtures; live imports require network access and are a separate check.

<a id="ops-03"></a>
## OPS-03 — Publish branches and verify CI

**What:** Put a tested local change on GitHub and verify its hosted pipeline.

**How:** Commit the finished code/docs on a feature branch, merge the tested work into the requested integration/release branch, then run `node scripts/push-github.mjs master feature/your-branch` from your signed-in terminal when publishing those branches. Use the actual local branch names. Follow the device-code sign-in in Brave if prompted. Verify the Actions run for the exact pushed commit.

**Result and storage:** The helper checks the expected origin, applies command-scoped folder trust, uses the repository's credential namespace, and atomically pushes named branches plus reachable annotated tags. Successful trusted `main`/`master` builds publish container images; feature/PR checks build/test without publishing a release image.

**Recovery and limits:** A local merge, tag or green local test is not a successful remote push/CI run. The Codex Windows session may be unable to persist your Credential Manager entries, requiring your own PowerShell. Do not paste tokens/passwords into chat. Container image delivery is not deployment to a live host. Existing tags should not be moved after publication.

<a id="ops-04"></a>
## OPS-04 — Restart, update or recover the running app

**What:** Load a new build while preserving the appropriate saved data.

**How:** Stop the preview process you started with Ctrl+C, rebuild changed frontend/API source, then rerun `node scripts/preview.mjs`. For the Compose app, use `docker compose up --build -d`. Refresh the browser to load current tool bundles. Use **Return to replay** after an isolated tool-download failure, then reload if needed.

**Result and storage:** PostgreSQL caches/bookmarks and browser saves survive a normal app restart. Snapshot imports/bookmarks do not. Rebuilds change app code, not user data by design.

**Recovery and limits:** Do not delete volumes or clear browser storage as a first response. A running old process can still serve old files; check the version/storage indicator and doctor's port report. Background jobs that had not completed at API shutdown are not a durable job queue—retry after restart. Unsaved studio/scenario/session state is not protected by server persistence.

<a id="ops-05"></a>
## OPS-05 — Update this guide with each behavior change

**What:** Maintain one current handbook rather than a collection of outdated release notes.

**How:** Follow [CONTRIBUTING](../../CONTRIBUTING.md). Find affected stable flow IDs in [the registry](../flows.json), edit the matching chapter, and update the registry for new/retired flows or UI entry points. Update the product version/review metadata when it changes. Run `node scripts/check-docs.mjs` and complete the PR guide checklist.

**Result and storage:** The current guide, flow registry, contributor instructions and CI checks travel with the implementation. Release notes remain historical; the handbook describes current behavior. New UI components must be classified as a documented flow source or an explicitly shared component.

**Recovery and limits:** Automated checks catch broken local links/anchors, missing flow sections/fields, source references, unclassified UI components and version mismatch. They cannot infer every semantic UI change. The author/reviewer must still verify labels, defaults, persistence, reset behavior, error paths, limits and unsupported imports against the actual implementation.
