# UC02 — Analyze Conservation Data and Generate Reports

**Owner:** JALATHGE C.A.J (IT23751446) · **Branch:** `feature/conservation-reports`

Build the module in this folder, using the layers of `../alerts`.

Notes:
- Reuse the UC04 coverage calculation (`modules/patrol/coverage.service.js`) so patrol coverage matches on every screen.
- "Share with Park Manager" should call `notificationService.notifyUsers([managerId], { type: 'conservation-report', link: '/reports/<id>' })`.
- Compute every result from stored records, so the output changes when the filters or the data change.
