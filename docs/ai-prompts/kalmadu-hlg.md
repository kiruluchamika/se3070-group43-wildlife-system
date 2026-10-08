# AI prompts — kalmadu-hlg

Record each prompt you used, the date, and what you did with the result. These go in the report appendix.

| Date | Tool | Prompt | How the output was used |
|---|---|---|---|
| 2026-10-04 | Codex | “Referring to my UC03 work-plan allocation, generate a creative, user-friendly and well-aligned development plan.” | Created `docs/design/UC03-incident-reporting.md` with the proposed user journey, architecture, offline sync design, delivery phases, risks, tests and PR checklist. Proposed rules remain subject to validation against Group 41 pp. 36–43. |
| 2026-10-04 | Codex | “Start implementation.” | Implemented the UC03 backend, ranger-only incident API, idempotent transaction and UC04 alert integration; added the mobile reporting flow, Dexie offline queue, PWA shell, seed data, documentation and automated tests. |
| 2026-10-05 | Codex | “Full offline reload while authenticated, Exact traceability to Group 41 pages 36–43 — start implementation these 2 parts also.” | Added minimal cached-profile restoration for offline PWA reload, online JWT revalidation and authoritative logout handling. Added verified project-contract traceability plus a page-by-page source worksheet; exact Group 41 rows remain explicitly blocked until pp. 36–43 are provided. |
