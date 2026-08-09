// Unwraps RTF so the user can paste straight from a .rtf file (or from an app
// that copies rich text). Plain-text input passes through untouched.

// Private-use sentinels, so there is no chance of colliding with payload content.
const SENTINEL = {
  '{': String.fromCharCode(0xe000),
  '}': String.fromCharCode(0xe001),
  '\\': String.fromCharCode(0xe002),
}

export function isRtf(text) {
  return /^\s*\{\\rtf/.test(text)
}

export function stripRtf(text) {
  if (!isRtf(text)) return text

  let s = text

  // Drop the header groups we never want to see: font/colour tables, stylesheets, etc.
  s = s.replace(
    /\{\\\*?\\(?:fonttbl|colortbl|expandedcolortbl|stylesheet|info|generator)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    '',
  )

  // Escaped literals must survive the control-word sweep further down.
  s = s.replace(/\\([{}\\])/g, (_, ch) => SENTINEL[ch])

  // \uc0钄 -> the real character. A trailing space is a delimiter, not content.
  s = s.replace(/\\uc\d+\s?/g, '')
  s = s.replace(/\\u(-?\d+)\s?/g, (_, code) => {
    const n = Number(code)
    return String.fromCharCode(n < 0 ? n + 65536 : n)
  })

  // \'95 -> byte 0x95 (cp1252 bullet, used for the redacted header values)
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16)
    return CP1252[code] ?? String.fromCharCode(code)
  })

  // Line breaks: explicit \par / \line, plus a lone backslash at end of line.
  s = s.replace(/\\(?:par|line)\b\s?/g, '\n')
  s = s.replace(/\\\r?\n/g, '\n')

  // Remaining control words (\f0, \fs26, \cf2, \pard, ...) and group braces.
  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
  s = s.replace(/[{}]/g, '')

  for (const [literal, sentinel] of Object.entries(SENTINEL)) {
    s = s.split(sentinel).join(literal)
  }

  return s.trim()
}

// Only the cp1252 codepoints that differ from latin-1 need a mapping.
const CP1252 = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’',
  0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
}
