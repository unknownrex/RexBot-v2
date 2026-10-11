import {
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import { CONFIG } from './config.js'
import logger from './logger.js'
import { extractText, getContextInfo, getMessageType, isMediaType, wrapQuoted } from './lib/media.js'
import { COMMANDS } from './commands/index.js'
import { sendError } from './lib/reply.js'

const lastRun = new Map()
const rateBuckets = new Map()

// Single-slot throttle for most commands. Commands that declare `batchLimit`
// get a token bucket instead, so a multi-image send (which arrives as several
// message events within milliseconds) is not swallowed by one shared window.
function claimRateSlot(command, jid) {
  const windowMs = command.cooldownMs ?? CONFIG.cooldownMs
  const key = `${command.name}:${jid}`
  const now = Date.now()
  const limit = command.batchLimit ?? 1

  if (limit <= 1) {
    if (now - (lastRun.get(key) || 0) < windowMs) return false
    lastRun.set(key, now)
    return true
  }

  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 })
    return true
  }
  if (bucket.count < limit) {
    bucket.count += 1
    return true
  }
  return false
}

function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null
  const trimmed = text.trim()
  if (trimmed.length <= prefix.length) return null
  const rest = trimmed.slice(prefix.length).trim()
  const [name, ...args] = rest.split(/\s+/)
  return { name: name.toLowerCase(), args, argText: rest.slice(name.length).trim() }
}

export async function handleMessage(sock, msg) {
  const key = msg.key || {}
  if (key.fromMe) return
  if (!msg.message) return

  const jid = key.remoteJid
  if (!jid) return
  if (isJidBroadcast(jid) || isJidNewsletter(jid)) return

  const isGroup = isJidGroup(jid)
  const sender = jidNormalizedUser(key.participant || jid)

  const parsed = parseCommand(extractText(msg), CONFIG.prefix)
  if (!parsed) return

  const command = COMMANDS.get(parsed.name)
  if (!command) return

  const contextInfo = getContextInfo(msg)
  const quotedContent = contextInfo.quotedMessage || null
  const quotedType = quotedContent ? getContentType(quotedContent) : null
  const quotedMsg = quotedContent
    ? wrapQuoted({ id: 'quoted', remoteJid: jid, participant: contextInfo.participant || sender }, quotedContent)
    : null

  const ctx = {
    sock,
    msg,
    key,
    jid,
    sender,
    isGroup,
    text: parsed.argText,
    args: parsed.args,
    type: getMessageType(msg),
    cmd: command,
    mentionedJids: contextInfo.mentionedJid || [],
    quoted: quotedMsg
      ? { msg: quotedMsg, content: quotedContent, type: quotedType, sender: contextInfo.participant || null }
      : null,
  }

  if (command.groupOnly && !isGroup) {
    await sendError(ctx, 'This command only works in groups.').catch(() => {})
    return
  }

  if (!claimRateSlot(command, jid)) return

  try {
    await command.exec(ctx)
  } catch (err) {
    logger.error({ err: err.message, cmd: command.name }, 'command failed')
    await sendError(ctx, 'Something went wrong. Please try again.').catch(() => {})
  }
}