/**
 * Count working days (Mon–Fri) between two ISO date strings, inclusive.
 * Returns 0 if either date is missing or start > end.
 */
export function calcWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (start > end) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getDay() // 0=Sun, 6=Sat
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Count working days that a leave/holiday period overlaps with a sprint.
 * Clips the leave range to [sprintStart, sprintEnd] before counting.
 * Returns 0 if either range is missing or there is no overlap.
 * All arguments are ISO date strings (YYYY-MM-DD).
 */
export function calcOverlapDays(leaveStart, leaveEnd, sprintStart, sprintEnd) {
  if (!leaveStart || !leaveEnd || !sprintStart || !sprintEnd) return 0
  // ISO date strings sort lexicographically correctly — string max/min is safe
  const overlapStart = leaveStart > sprintStart ? leaveStart : sprintStart
  const overlapEnd   = leaveEnd   < sprintEnd   ? leaveEnd   : sprintEnd
  if (overlapStart > overlapEnd) return 0
  return calcWorkingDays(overlapStart, overlapEnd)
}
