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

const lastRun = new Map()

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

  if (command.groupOnly && !isGroup) {
    await sock
      .sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg })
      .catch(() => {})
    return
  }

  const cooldownKey = `${command.name}:${jid}`
  const now = Date.now()
  if (now - (lastRun.get(cooldownKey) || 0) < (command.cooldownMs ?? CONFIG.cooldownMs)) return
  lastRun.set(cooldownKey, now)

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
    mentionedJids: contextInfo.mentionedJid || [],
    quoted: quotedMsg
      ? { msg: quotedMsg, content: quotedContent, type: quotedType, sender: contextInfo.participant || null }
      : null,
  }

  try {
    await command.exec(ctx)
  } catch (err) {
    logger.error({ err: err.message, cmd: command.name }, 'command failed')
    await sock
      .sendMessage(jid, { text: `❌ Something went wrong: ${err.message}` }, { quoted: msg })
      .catch(() => {})
  }
}