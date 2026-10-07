/** Omit the fixture marker from presentation while preserving stored provenance. */
export function recordTitle(value) {
  return typeof value === 'string' ? value.replace(/^\[SIMULATED SAMPLE\]\s*/, '') : value
}
