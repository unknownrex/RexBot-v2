import { CONFIG } from '../config.js'
import { stickerCommands } from './sticker.js'
import { gameCommands } from './games.js'
import { profileCommands } from './profile.js'
import { groupCommands } from './group.js'
import { miscCommands } from './misc.js'

const COMMANDS = new Map()

function register(cmd) {
  if (!cmd || typeof cmd.exec !== 'function') return
  const normalized = { ...cmd, name: cmd.name.toLowerCase() }
  COMMANDS.set(normalized.name, normalized)
  for (const a of cmd.aliases || []) COMMANDS.set(a.toLowerCase(), normalized)
}

function registerHelp() {
  const entries = [...COMMANDS.values()]
    .map((c) => `${c.usage}${c.groupOnly ? ' (group only)' : ''} — ${c.description}`)
    .sort()
  register({
    name: 'help',
    usage: `${CONFIG.prefix}help`,
    description: 'Show this command list.',
    exec: ({ sock, jid, msg }) =>
      sock.sendMessage(jid, { text: `*Commands*\n\n${entries.join('\n')}` }, { quoted: msg }),
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