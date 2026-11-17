# Contributing to Pitwall

The [user guide](docs/USER-GUIDE.md) is the current behavior contract. Release notes are historical; update the guide with the implementation.

## Before changing a flow

1. Find its stable ID in [docs/flows.json](docs/flows.json). Read that section and its source files.
2. Decide whether the change affects entry points, controls, defaults, limits, saved data, resets, exports/imports, cancellation or errors.
3. Keep recorded data, inferred/estimated data and hypothetical results distinct.

## In the same change

- Update each affected flow's **What**, **How**, **Result and storage**, and **Recovery and limits** sections.
- Use actual visible labels. Document what closes/restarts/reset actions discard, and what persists after reload or API restart.
- Describe disabled controls and data/provider/storage failures. Do not promise a file importer, account sync or undo path that does not exist.
- For a new flow, choose a new stable ID and explicit anchor, write its complete section and add its guide/source entry to `docs/flows.json`. Do not renumber existing IDs for cosmetic reorganization.
- Register new UI view components as flow sources. Classify truly reusable helpers under `sharedComponents` only when they do not represent their own user flow.
- For a removed flow, remove/update its index entry and explain the replacement in release notes. Do not leave a current guide pointing at a retired control.
- When the product version changes, review the handbook and update `productVersion` / `lastReviewed` in the registry. Review dates reflect actual review, not automatic timestamps.
- Run `node scripts/update-guide-index.mjs` to regenerate the index/version header, then `node scripts/check-docs.mjs`.
- Update the short demo, README, test guide and release notes only where the change affects them. Do not rewrite historical release behavior as if it always existed.

## Verification

Run `node scripts/check-docs.mjs` for documentation changes. For code changes, also run checks appropriate to the behavior in [TESTING](docs/TESTING.md), including browser coverage for meaningful UI flows and API/storage checks for persistence changes. A documentation-only change does not require rerunning unrelated app suites locally.

Guide checks validate links/anchors, flow sections/required fields, registry/source paths, UI classification and version metadata. They cannot prove the prose matches every semantic detail; author/reviewer verification remains required. State any verification limitation in the PR rather than claiming unperformed testing.

## Review and publication

Use a focused branch and a concrete PR description. Include changed flow IDs, expected user behavior, validation and material limitations. Merge/publish through the agreed branch workflow. Do not move an already published release tag for a guide-only update. GitHub CI verifies the published commit; a local commit is not evidence of a successful hosted run.
