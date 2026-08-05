/** Projects the next `periodsAhead` values from a simple least-squares
 *  linear regression over `points` (treated as evenly-spaced periods). */
export function linearForecast(points: number[], periodsAhead: number): number[] {
  const n = points.length
  if (n === 0) return Array(periodsAhead).fill(0)
  if (n === 1) return Array(periodsAhead).fill(points[0])

  const meanX = (n - 1) / 2
  const meanY = points.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - meanX) * (points[i] - meanY)
    denominator += (i - meanX) ** 2
  }
  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = meanY - slope * meanX

  return Array.from({ length: periodsAhead }, (_, i) => Math.max(0, intercept + slope * (n + i)))
}
