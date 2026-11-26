import pkg from '../package.json' with { type: 'json' }
import { CONFIG } from './config.js'
import { COMMANDS } from './commands/index.js'

// ANSI Shadow lettering: R E X B O T space V 2. The digit is fixed art, so it
// needs a glyph swap if the major version ever moves past 2.
const ART = `██████╗ ███████╗██╗  ██╗██████╗  ██████╗ ████████╗    ██╗   ██╗██████╗
██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗██╔═══██╗╚══██╔══╝    ██║   ██║╚════██╗
██████╔╝█████╗   ╚███╔╝ ██████╔╝██║   ██║   ██║       ██║   ██║ █████╔╝
██╔══██╗██╔══╝   ██╔██╗ ██╔══██╗██║   ██║   ██║       ╚██╗ ██╔╝██╔═══╝
██║  ██║███████╗██╔╝ ██╗██████╔╝╚██████╔╝   ██║        ╚████╔╝ ███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝         ╚═══╝  ╚══════╝`

// Every alias points at the same object, so count distinct commands, not map entries.
const commandCount = new Set([...COMMANDS.values()].map((c) => c.name)).size

let printed = false

export function printBanner() {
  if (printed) return
  printed = true
  const subtitle = `v${pkg.version} · prefix ${CONFIG.prefix} · ${commandCount} commands`
  process.stdout.write(`${ART}\n     ${subtitle}\n\n`)
}
