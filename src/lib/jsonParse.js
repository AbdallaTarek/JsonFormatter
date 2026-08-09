// Tolerant JSON parsing: try strict first, then a couple of cheap repairs that
// cover what logs usually mangle. Never throws -- the UI renders the failure.

export function tolerantParse(text) {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { ok: false, error: 'Empty body', line: null, repaired: false }

  const strict = attempt(trimmed)
  if (strict.ok) return { ...strict, repaired: false }

  const repaired = attempt(repair(trimmed))
  if (repaired.ok) return { ...repaired, repaired: true }

  return { ok: false, error: strict.error, line: strict.line, repaired: false }
}

function attempt(text) {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    return { ok: false, error: err.message, line: lineOfError(text, err.message) }
  }
}

function repair(text) {
  return (
    text
      // trailing commas before a closing bracket
      .replace(/,(\s*[}\]])/g, '$1')
      // // and /* */ comments that some loggers inject
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // unquoted keys: { key: 1 } -> { "key": 1 }
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
  )
}

function lineOfError(text, message) {
  const at = /position (\d+)/.exec(message)
  if (!at) {
    const line = /line (\d+)/.exec(message)
    return line ? Number(line[1]) : null
  }
  return text.slice(0, Number(at[1])).split('\n').length
}

export function stringify(value, indent = 2) {
  return JSON.stringify(value, null, indent)
}

export function countNodes(value) {
  if (Array.isArray(value)) return value.reduce((n, v) => n + countNodes(v), 1)
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((n, v) => n + countNodes(v), 1)
  }
  return 1
}
