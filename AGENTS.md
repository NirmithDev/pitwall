# Pitwall repository instructions

Read `docs/USER-GUIDE.md` and the relevant flow sections before changing user-visible behavior. `docs/flows.json` maps stable flow IDs to guide sections and implementation files.

- Update affected guide flows in the same change as behavior: visible labels, steps, defaults/limits, persistence, reset/close semantics, disabled states, failure/retry paths and export/import boundaries.
- Document implemented behavior only. Distinguish recorded values, estimates and hypothetical models. Never call a browser-only save account-synchronized or an export restorable without a supported importer.
- Add stable IDs and source mappings for new flows; do not renumber existing flows casually. Classify new TSX views in the flow registry or explain genuinely shared components there.
- Follow `CONTRIBUTING.md` for guide review and version metadata. Regenerate the index with `node scripts/update-guide-index.mjs`; run `node scripts/check-docs.mjs` before completing documentation/flow changes.
- Keep historical release notes historical; the handbook is the current reference. Keep the README/demo/testing guide consistent where affected.
- Run application checks appropriate to code changes; documentation-only changes need guide validation, not unrelated suite repetition. Report checks actually performed and any unresolved limitation.
- Keep user data and unsaved browser work intact during documentation tasks. Do not reset volumes, clear storage or replace drafts to demonstrate a guide without a task-specific need.

These instructions require documentation maintenance, not extra user-approval steps for ordinary implementation or reversible edits already authorized by the user.
