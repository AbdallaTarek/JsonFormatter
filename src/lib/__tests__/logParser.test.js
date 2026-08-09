import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseLog } from '../logParser.js'
import { splitDelimited, isDelimited } from '../delimited.js'
import { stripRtf } from '../rtf.js'

const sample = readFileSync(fileURLToPath(new URL('./sample.rtf.txt', import.meta.url)), 'utf8')
const sampleNoGutter = readFileSync(
  fileURLToPath(new URL('./sample-no-gutter.rtf.txt', import.meta.url)),
  'utf8',
)

describe('stripRtf', () => {
  it('decodes unicode escapes and leaves plain text alone', () => {
    expect(stripRtf(sample)).toContain('│ ➡️ REQUEST  [A1B2C3D4]')
    expect(stripRtf('{"a": 1}')).toBe('{"a": 1}')
  })
})

describe('parseLog on the sample log', () => {
  const [transaction, ...rest] = parseLog(sample)

  it('produces exactly one transaction', () => {
    expect(rest).toHaveLength(0)
    expect(transaction.id).toBe('A1B2C3D4')
    expect(transaction.sections).toHaveLength(2)
  })

  it('reads the request line, headers and body', () => {
    const [request] = transaction.sections
    expect(request.kind).toBe('REQUEST')
    expect(request.method).toBe('PUT')
    expect(request.path).toBe('/v1/public/booking/api/v1/hotels/1234/rooms/prices')
    expect(request.query).toEqual([{ name: 'currency', value: 'USD' }])
    expect(request.headers).toHaveLength(4)
    expect(request.headers[1]).toEqual({ name: 'channel', value: 'mobile' })
    expect(request.body).toHaveLength(1)
    expect(request.body[0]).toContain('SEASONAL OFFER')
  })

  it('reads the response status, timing and body', () => {
    const response = transaction.sections[1]
    expect(response.kind).toBe('RESPONSE')
    expect(response.status).toBe(200)
    expect(response.statusText).toBe('no error')
    expect(response.duration).toBe(120)
    expect(response.headers).toHaveLength(9)
    expect(response.parseError).toBeNull()
    expect(response.body[0].totalTax).toBe(200)
    expect(response.body[0].taxBreakdown).toHaveLength(2)
    expect(response.body[0].taxBreakdown[0].codeDescription).toBe('VAT/GST tax')
  })
})

describe('parseLog on a log with no per-line gutter', () => {
  const [transaction, ...rest] = parseLog(sampleNoGutter)

  it('produces exactly one transaction from the border-only box lines', () => {
    expect(rest).toHaveLength(0)
    expect(transaction.id).toBe('E5F6A7B8')
    expect(transaction.sections).toHaveLength(2)
  })

  it('treats a "<empty>" body as no body instead of a parse error', () => {
    const [request] = transaction.sections
    expect(request.kind).toBe('REQUEST')
    expect(request.method).toBe('GET')
    expect(request.body).toBeNull()
    expect(request.parseError).toBeNull()
  })

  it('still parses a real JSON body on the response', () => {
    const response = transaction.sections[1]
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body[0].name).toBe('Northport International Airport - NIA')
  })
})

describe('parseLog on bare input', () => {
  it('accepts plain JSON with no log markers', () => {
    const [transaction] = parseLog('[{"a": 1}]')
    expect(transaction.sections[0].kind).toBe('BODY')
    expect(transaction.sections[0].body).toEqual([{ a: 1 }])
  })

  it('repairs trailing commas', () => {
    const [transaction] = parseLog('{"a": 1,}')
    expect(transaction.sections[0].body).toEqual({ a: 1 })
    expect(transaction.sections[0].repaired).toBe(true)
  })

  it('reports unrecoverable JSON instead of throwing', () => {
    const [transaction] = parseLog('{"a": ')
    expect(transaction.sections[0].body).toBeNull()
    expect(transaction.sections[0].parseError.error).toBeTruthy()
  })

  it('returns nothing for empty input', () => {
    expect(parseLog('   ')).toEqual([])
  })
})

describe('splitDelimited', () => {
  const priceCode = parseLog(sample)[0].sections[0].body[0]

  it('recognises packed strings but not ordinary ones', () => {
    expect(isDelimited(priceCode)).toBe(true)
    expect(isDelimited('application/json')).toBe(false)
  })

  it('splits positionally, keeping empty segments', () => {
    const parts = splitDelimited(priceCode)
    expect(parts[0]).toEqual({ path: '1', value: 'R1K' })
    expect(parts[1].value).toBe('PK4')
    expect(parts[4].value).toContain('SEASONAL OFFER')
    expect(parts.some((p) => p.value === '')).toBe(true)
    expect(parts.at(-1).value).toBe('Fixed#0')
  })
})
