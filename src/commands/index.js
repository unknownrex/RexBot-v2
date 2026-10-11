import { CONFIG } from '../config.js'
import { CATEGORIES, DEFAULT_ICON } from '../lib/theme.js'
import { sendText } from '../lib/reply.js'
import { stickerCommands } from './sticker.js'
import { gameCommands } from './games.js'
import { profileCommands } from './profile.js'
import { groupCommands } from './group.js'
import { miscCommands } from './misc.js'

const COMMANDS = new Map()

function register(cmd) {
  if (!cmd || typeof cmd.exec !== 'function') return
  const normalized = {
    ...cmd,
    name: cmd.name.toLowerCase(),
    icon: cmd.icon || DEFAULT_ICON,
    category: cmd.category || 'misc',
  }
  COMMANDS.set(normalized.name, normalized)
  for (const a of cmd.aliases || []) COMMANDS.set(a.toLowerCase(), normalized)
}

// Aliases point at the same object, so dedupe by identity before grouping.
function uniqueCommands() {
  return [...new Set(COMMANDS.values())]
}

function registerHelp() {
  register({
    name: 'help',
    category: 'system',
    icon: '📖',
    usage: `${CONFIG.prefix}help`,
    description: 'Show this command list.',
    exec: (ctx) => {
      const byCategory = new Map()
      for (const c of uniqueCommands()) {
        if (!byCategory.has(c.category)) byCategory.set(c.category, [])
        byCategory.get(c.category).push(c)
      }

      const sections = []
      for (const [key, list] of byCategory) {
        const meta = CATEGORIES[key] || { icon: DEFAULT_ICON, label: key }
        const rows = list
          .map((c) => {
            const usage = c.usage.startsWith(CONFIG.prefix) ? c.usage : CONFIG.prefix + c.usage
            return `• ${usage}${c.groupOnly ? ' _(group only)_' : ''}\n   _${c.description}_`
          })
          .join('\n')
        sections.push(`${meta.icon} *${meta.label.toUpperCase()}*\n${rows}`)
      }

      const body = sections.join('\n\n')
      return sendText(ctx, body)
    },
  })
}

for (const cmd of [
  ...stickerCommands,
  ...gameCommands,
  ...profileCommands,
  ...groupCommands,
  ...miscCommands,
]) {
  register(cmd)
}
registerHelp()

export { COMMANDS }