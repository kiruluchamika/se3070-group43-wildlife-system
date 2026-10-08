export function sriLankaToday(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600000).toISOString().slice(0, 10)
}

export function analysisDateErrors({ startDate, endDate }, today = sriLankaToday()) {
  const errors = {}
  for (const [field, label] of [['startDate', 'Start date'], ['endDate', 'End date']]) {
    const value = field === 'startDate' ? startDate : endDate
    const parsed = new Date(`${value}T00:00:00Z`)
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      errors[field] = `Enter a valid ${label.toLowerCase()}.`
    } else if (value > today) errors[field] = `${label} cannot be in the future. Dates use Sri Lanka time.`
  }
  if (!errors.startDate && !errors.endDate && endDate < startDate) errors.endDate = 'End date must be on or after the start date.'
  return errors
}
