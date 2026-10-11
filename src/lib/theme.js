// Single source of visual truth for every message the bot sends.
// Commands supply only an icon + title; the frame itself is built here so
// every response in every command looks identical.
//
// Decoration is deliberately alignment-free. An earlier version drew a box
// frame, which broke on some devices: its corners, horizontal and vertical
// edges are four separate character classes that must all agree on cell
// width, and a box also needs room to avoid soft-wrapping. The rule sandwich
// below is a uniform run of one character per line, so nothing can misalign
// and a wrapped rule still reads as a clean horizontal line.

import { CONFIG } from '../config.js'

const { theme } = CONFIG

export const renderHeader = (icon, title) => {
  const { style, accent, divider, dividerWidth } = theme
  const label = String(title).toUpperCase()

  if (style === 'minimal') return `${icon} ${accent} *${label}*`

  const rule = divider.repeat(Math.max(1, dividerWidth))
  return [rule, `${icon} ${accent} *${label}*`, rule].join('\n')
}

// Header + optional body, separated by a blank line. Returns the full text
// for a message or a media caption.
export const compose = (icon, title, body) => {
  const header = renderHeader(icon, title)
  const text = body == null ? '' : String(body).trim()
  return text ? `${header}\n\n${text}` : header
}

export const CHANNELS = {
  info: { icon: '🔎', title: 'Info' },
  ok: { icon: '✅', title: 'Success' },
  warn: { icon: '⚠️', title: 'Warning' },
  error: { icon: '❌', title: 'Error' },
}

export const CATEGORIES = {
  sticker: { icon: '🎨', label: 'Sticker' },
  games: { icon: '🎲', label: 'Games' },
  profile: { icon: '👥', label: 'Profile' },
  group: { icon: '🛡️', label: 'Group' },
  misc: { icon: '🧰', label: 'Misc' },
  system: { icon: '📖', label: 'System' },
}

export const DEFAULT_ICON = '🤖'