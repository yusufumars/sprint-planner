const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

/**
 * Round a story-point value to the nearest Fibonacci number.
 * Returns 0 for values <= 0.
 */
export function snapToFibonacci(n) {
  const rounded = Math.round(n)
  if (rounded <= 0) return 0
  let nearest = FIBONACCI[0]
  let minDiff = Math.abs(rounded - FIBONACCI[0])
  for (const fib of FIBONACCI) {
    const diff = Math.abs(rounded - fib)
    if (diff < minDiff) { minDiff = diff; nearest = fib }
  }
  return nearest
}

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
