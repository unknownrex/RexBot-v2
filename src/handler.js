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

// Per-command cooldown. Commands that set `noCooldown` skip it entirely, so a
// multi-image send converts every item instead of being throttled.
function claimRateSlot(command, jid, sender, isGroup) {
  if (command.noCooldown) return true
  const windowMs = command.cooldownMs ?? CONFIG.cooldownMs
  // Keyed on the sender in groups so one member cannot spend the whole
  // chat's budget and starve everyone else.
  const key = `${command.name}:${isGroup ? sender : jid}`
  const now = Date.now()

  if (now - (lastRun.get(key) || 0) < windowMs) return false
  lastRun.set(key, now)
  return true
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

  if (!claimRateSlot(command, jid, sender, isGroup)) return

  try {
    await command.exec(ctx)
  } catch (err) {
    logger.error({ err: err.message, cmd: command.name }, 'command failed')
    await sendError(ctx, 'Something went wrong. Please try again.').catch(() => {})
  }
}