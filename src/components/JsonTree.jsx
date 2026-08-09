import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDelimited } from '../lib/delimited.js'
import DelimitedString from './DelimitedString.jsx'
import CopyButton from './CopyButton.jsx'

const ROOT = '$'
// The root has no siblings, so shift-clicking it behaves like a plain click.
const ROOT_GROUP = [ROOT]

// A fully expanded body of this size already costs ~70k DOM nodes and a second
// of layout, so past this many branches we start collapsed and let the user
// open the branches they care about.
export const AUTO_EXPAND_LIMIT = 300

/**
 * Open/closed state lives here rather than in each node, so one node can drive
 * its whole subtree -- that is what shift-clicking an arrow does.
 * `overrides` only holds paths the user has actually touched; everything else
 * falls back to the base state.
 */
export default function JsonTree({ value, search = '', defaultOpen = true, resetKey = 0 }) {
  const [overrides, setOverrides] = useState(() => new Map())
  // null = follow the size heuristic; true/false = the toolbar said so explicitly.
  const [forced, setForced] = useState(null)
  // Compare against the last values rather than counting runs: StrictMode
  // invokes effects twice on mount, and a "first run" flag would treat the
  // second invocation as a real toolbar click and expand everything.
  const applied = useRef({ resetKey, defaultOpen })

  const branchCount = useMemo(() => countBranches(value), [value])
  const huge = branchCount > AUTO_EXPAND_LIMIT
  const baseOpen = forced ?? (defaultOpen && !huge)

  // Expand-all / collapse-all from the toolbar wipes the manual overrides and
  // overrides the heuristic -- an explicit request beats a guess.
  useEffect(() => {
    if (applied.current.resetKey === resetKey && applied.current.defaultOpen === defaultOpen) return
    applied.current = { resetKey, defaultOpen }
    setOverrides(new Map())
    setForced(defaultOpen)
  }, [resetKey, defaultOpen])

  const controls = useMemo(() => {
    // A root that is collapsed shows as a single line, which is useless on load
    // -- so roots start open. Once the toolbar has spoken, "Collapse all" means
    // all, roots included.
    const isOpen = (path) =>
      overrides.has(path)
        ? overrides.get(path)
        : baseOpen || (forced === null && path === ROOT)

    return {
      isOpen,
      setOpen: (path, open) => setOverrides((prev) => new Map(prev).set(path, open)),
      /**
       * Shift-click: toggle the clicked node together with its siblings -- the
       * branches sharing its parent, and nothing else. Other items in the list
       * keep whatever state they had, so opening one hotel's fields does not
       * disturb the other 43.
       *
       * The direction comes from the *group*, not from the clicked node: if any
       * sibling is still closed the group opens, and only a fully open group
       * collapses. Otherwise a root -- which always renders open -- would close
       * on a click the user meant as "open these".
       */
      toggleSiblings: (paths) => {
        if (!paths.length) return
        const open = !paths.every(isOpen)
        setOverrides((prev) => {
          const next = new Map(prev)
          for (const p of paths) next.set(p, open)
          return next
        })
      },
    }
  }, [overrides, baseOpen, forced])

  return (
    <div className="font-mono text-[13px] leading-relaxed">
      {huge && forced === null && (
        <p className="mb-1 text-[11px] text-slate-600">
          {branchCount.toLocaleString()} nodes — collapsed for speed. Shift-click an arrow to open
          it together with its siblings.
        </p>
      )}
      <Node
        name={null}
        value={value}
        path={ROOT}
        depth={0}
        siblings={ROOT_GROUP}
        search={search.trim().toLowerCase()}
        controls={controls}
      />
    </div>
  )
}

function Node({ name, value, path, depth, siblings, search, controls }) {
  const branch = isBranch(value)
  const matched = search ? subtreeMatches(name, value, search) : false
  const open = controls.isOpen(path)

  const toggle = useCallback(
    (event) => {
      if (!branch) return
      event.stopPropagation()
      if (event.shiftKey) controls.toggleSiblings(siblings)
      else controls.setOpen(path, !open)
    },
    [branch, controls, path, siblings, open],
  )

  // A search always wins over the manual collapse state, so hits are never hidden.
  const expanded = branch && (search ? matched : open)

  if (search && !matched) return null

  const entries = branch ? Object.entries(value) : []
  const label = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`
  // The group a shift-click on any of these children will toggle.
  const childGroup = entries
    .filter(([, child]) => isBranch(child))
    .map(([key]) => childPath(path, key, value))

  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }}>
      <div className="group flex items-start gap-1.5 rounded px-1 hover:bg-slate-800/40">
        {branch ? (
          <button
            type="button"
            onClick={toggle}
            title={`${open ? 'Collapse' : 'Expand'} — shift-click for this one and its siblings`}
            className="mt-0.5 w-3 shrink-0 select-none text-slate-500 transition hover:text-slate-200"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5">
          {name !== null && (
            <span
              className={`shrink-0 text-sky-300 ${branch ? 'cursor-pointer' : ''}`}
              onClick={toggle}
            >
              {mark(String(name), search)}
              <span className="text-slate-600">:</span>
            </span>
          )}

          {branch ? (
            <span className="cursor-pointer select-none text-slate-500" onClick={toggle}>
              {label}
              {!expanded && <span className="ml-1 text-slate-600">{preview(value)}</span>}
            </span>
          ) : (
            <Leaf value={value} search={search} />
          )}

          <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
            <CopyButton text={path} label="path" title={path} />
            <CopyButton
              text={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              label="value"
            />
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-l border-slate-800/70">
          {entries.map(([key, child]) => (
            <Node
              key={key}
              name={key}
              value={child}
              path={childPath(path, key, value)}
              depth={depth + 1}
              siblings={childGroup}
              search={search}
              controls={controls}
            />
          ))}
          {!entries.length && <div className="pl-5 text-slate-600">empty</div>}
        </div>
      )}
    </div>
  )
}

function Leaf({ value, search }) {
  if (typeof value === 'string') {
    if (isDelimited(value)) {
      return <DelimitedString value={value} highlight={(v) => mark(v, search)} />
    }
    return <span className="break-all text-emerald-300/90">"{mark(value, search)}"</span>
  }
  if (typeof value === 'number') return <span className="text-amber-300">{value}</span>
  if (typeof value === 'boolean') return <span className="text-violet-300">{String(value)}</span>
  return <span className="text-slate-500 italic">null</span>
}

function isBranch(value) {
  return value !== null && typeof value === 'object'
}

export function countBranches(value) {
  if (!isBranch(value)) return 0
  let total = 1
  for (const child of Object.values(value)) total += countBranches(child)
  return total
}

function childPath(path, key, parent) {
  return Array.isArray(parent) ? `${path}[${key}]` : `${path}.${key}`
}

function preview(value) {
  if (Array.isArray(value)) return ''
  const keys = Object.keys(value).slice(0, 3).join(', ')
  return keys ? `${keys}${Object.keys(value).length > 3 ? ', …' : ''}` : ''
}

function subtreeMatches(name, value, search) {
  if (name !== null && String(name).toLowerCase().includes(search)) return true
  if (isBranch(value)) {
    return Object.entries(value).some(([k, v]) => subtreeMatches(k, v, search))
  }
  return String(value).toLowerCase().includes(search)
}

// Wraps search hits so they stand out without losing the surrounding text.
function mark(text, search) {
  if (!search) return text
  const lower = text.toLowerCase()
  const parts = []
  let cursor = 0
  let at = lower.indexOf(search)

  while (at !== -1) {
    if (at > cursor) parts.push(text.slice(cursor, at))
    parts.push(
      <mark key={at} className="rounded bg-amber-400/30 text-amber-100">
        {text.slice(at, at + search.length)}
      </mark>,
    )
    cursor = at + search.length
    at = lower.indexOf(search, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}
