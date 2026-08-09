import { stripRtf } from './rtf.js'
import { tolerantParse } from './jsonParse.js'

const GUTTER = /^[─-╿\s]*[│├└┌]\s?/
const RULE = /^[─-╿\s]+$/
// Leading emoji/arrows are optional. The character class deliberately excludes
// quotes and brackets so a JSON key like "REQUEST": {...} is never mistaken
// for a section header.
const SECTION_START = /^[^\w"'`{[\]]*\s*(REQUEST|RESPONSE)\b\s*(?:\[([^\]]+)\])?\s*([^:].*)?$/
const HTTP_VERB = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i
const HEADER_LINE = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*:\s*(.*)$/
// Loggers mark a body-less request/response with a placeholder like
// "<empty>" instead of omitting the Body section outright.
const EMPTY_BODY = /^[<(]?\s*empty\s*[>)]?$/i

/**
 * Turns a pasted log (or bare JSON) into a list of transactions.
 * Every stage is tolerant: anything it cannot classify still shows up as a body.
 */
export function parseLog(input) {
  const text = stripRtf(input ?? '')
  if (!text.trim()) return []

  const lines = text.split(/\r?\n/).map(stripGutter)
  const sections = splitSections(lines)

  if (!sections.length) {
    // No REQUEST/RESPONSE markers -- treat the whole paste as one body.
    const body = text.trim()
    if (!body) return []
    return [{ id: null, sections: [parseSection({ kind: 'BODY', lines: text.split(/\r?\n/) })] }]
  }

  return groupIntoTransactions(sections.map(parseSection))
}

export function stripGutter(line) {
  if (RULE.test(line) && line.trim()) return ''
  return line.replace(GUTTER, '')
}

function splitSections(lines) {
  const sections = []
  let current = null

  for (const line of lines) {
    const match = SECTION_START.exec(line.trim())
    if (match) {
      current = { kind: match[1], id: match[2] ?? null, meta: match[3] ?? '', lines: [] }
      sections.push(current)
      continue
    }
    if (current) current.lines.push(line)
  }

  return sections
}

function parseSection(section) {
  const result = {
    kind: section.kind,
    id: section.id ?? null,
    method: null,
    url: null,
    path: null,
    query: [],
    status: null,
    statusText: null,
    duration: null,
    headers: [],
    bodyRaw: '',
    body: null,
    parseError: null,
    repaired: false,
  }

  Object.assign(result, parseMeta(section.meta ?? ''))

  // A synthetic BODY section has no "Body:" marker to switch on -- it is all body.
  let mode = section.kind === 'BODY' ? 'body' : 'top'
  const bodyLines = []

  for (const line of section.lines) {
    const trimmed = line.trim()

    if (/^Headers\s*:?\s*$/i.test(trimmed)) {
      mode = 'headers'
      continue
    }
    if (/^Body\s*:?\s*$/i.test(trimmed)) {
      mode = 'body'
      continue
    }

    if (mode === 'body') {
      bodyLines.push(line)
      continue
    }

    if (!trimmed) continue

    if (mode === 'top') {
      const verb = HTTP_VERB.exec(trimmed)
      if (verb) {
        Object.assign(result, splitUrl(verb[2]))
        result.method = verb[1].toUpperCase()
        continue
      }
    }

    if (mode === 'headers') {
      const header = HEADER_LINE.exec(trimmed)
      if (header) result.headers.push({ name: header[1], value: header[2] })
    }
  }

  result.bodyRaw = dedent(bodyLines).trim()
  if (result.bodyRaw && !EMPTY_BODY.test(result.bodyRaw)) {
    const parsed = tolerantParse(result.bodyRaw)
    if (parsed.ok) {
      result.body = parsed.value
      result.repaired = parsed.repaired
    } else {
      result.parseError = parsed
    }
  }

  return result
}

// "  •  200 no error • 120ms" -> status 200, statusText "no error", duration 120
function parseMeta(meta) {
  const out = {}
  const status = /\b([1-5]\d{2})\b/.exec(meta)
  if (status) {
    out.status = Number(status[1])
    const rest = meta.slice(status.index + status[1].length)
    const text = rest.split(/[•|]/)[0].trim()
    if (text) out.statusText = text
  }
  const duration = /(\d+(?:\.\d+)?)\s*ms\b/i.exec(meta)
  if (duration) out.duration = Number(duration[1])
  return out
}

function splitUrl(raw) {
  const out = { url: raw, path: raw, query: [] }
  try {
    const url = new URL(raw)
    out.path = url.pathname
    out.host = url.host
    out.query = [...url.searchParams].map(([name, value]) => ({ name, value }))
  } catch {
    const [path, search] = raw.split('?')
    out.path = path
    if (search) {
      out.query = search.split('&').map((pair) => {
        const [name, value = ''] = pair.split('=')
        return { name: decodeURIComponent(name), value: decodeURIComponent(value) }
      })
    }
  }
  return out
}

function dedent(lines) {
  const meaningful = lines.filter((l) => l.trim())
  if (!meaningful.length) return ''
  const indent = Math.min(...meaningful.map((l) => l.match(/^\s*/)[0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

// A REQUEST and the RESPONSE carrying the same [id] belong together.
function groupIntoTransactions(sections) {
  const transactions = []
  let current = null

  for (const section of sections) {
    const sameId = current && section.id && current.id === section.id
    const isFollowUpResponse = current && section.kind === 'RESPONSE' && !current.hasResponse

    if (current && (sameId || (!section.id && isFollowUpResponse))) {
      current.sections.push(section)
      if (section.kind === 'RESPONSE') current.hasResponse = true
      continue
    }

    current = { id: section.id, sections: [section], hasResponse: section.kind === 'RESPONSE' }
    transactions.push(current)
  }

  return transactions
}
