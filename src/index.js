import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { printBanner } from './banner.js'
import { CONFIG } from './config.js'
import logger, { socketLogger } from './logger.js'
import { handleMessage } from './handler.js'
import { registerLidMapping } from './lib/jid.js'

const messageCache = new Map()

const rememberMessage = (msg) => {
  if (!msg.key?.id) return
  messageCache.set(msg.key.id, msg)
  if (messageCache.size > 2000) {
    for (const key of messageCache.keys()) {
      messageCache.delete(key)
      if (messageCache.size <= 2000) break
    }
  }
}

async function startRexBot() {
  printBanner()
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authDir)

  let version
  try {
    version = (await fetchLatestBaileysVersion()).version
  } catch {
    logger.warn('could not fetch latest Baileys version, using default')
  }

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger: socketLogger,
    browser: Browsers.ubuntu(CONFIG.botName),
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    getMessage: async (key) => messageCache.get(key.id) || null,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('lid-mapping.update', ({ lid, pn }) => registerLidMapping(lid, pn))

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      qrcode.generate(qr, { small: true })
      logger.info('Scan the QR code with WhatsApp to log in.')
    }
    if (connection === 'open') {
      logger.info(`Connected as ${sock.user?.id}`)
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      logger.warn({ code }, `connection closed${loggedOut ? ' (logged out)' : ''}`)
      if (loggedOut) {
        logger.info('Session logged out. Delete auth/ and restart to scan a new QR.')
        process.exit(0)
      }
      setTimeout(startRexBot, 3000)
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      rememberMessage(msg)
      handleMessage(sock, msg).catch((err) => {
        logger.error({ err: err.message }, 'failed to handle message')
      })
    }
  })

  return sock
}

startRexBot().catch((err) => {
  logger.error({ err: err.message }, 'fatal error on startup')
  process.exit(1)
})