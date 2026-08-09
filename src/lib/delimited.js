// Packed strings (e.g. "C1K~TS8~12~...~Margin#0^Markup#0^Fixed#0") are unreadable
// inline. We split them positionally only -- no field names -- so the same view
// works for every model and endpoint.

const DELIMITERS = ['~', '|', '^', '####']

export function isDelimited(value) {
  if (typeof value !== 'string' || value.length < 12) return false
  return countHits(value) >= 3
}

function countHits(value) {
  let hits = 0
  for (const d of DELIMITERS) hits += value.split(d).length - 1
  return hits
}

/**
 * Splits on `~`, then `^`, then `####`, keeping empty segments (they carry
 * meaning positionally). Returns a flat list of { path, value } where `path`
 * is the segment's index trail, e.g. "4" or "4.2".
 */
export function splitDelimited(value, depth = 0, prefix = '') {
  const delimiter = DELIMITERS[depth]
  if (!delimiter) return [{ path: prefix, value }]

  const parts = value.split(delimiter)
  if (parts.length === 1) return splitDelimited(value, depth + 1, prefix)

  return parts.flatMap((part, i) => {
    const path = prefix ? `${prefix}.${i + 1}` : String(i + 1)
    return splitDelimited(part, depth + 1, path)
  })
}
