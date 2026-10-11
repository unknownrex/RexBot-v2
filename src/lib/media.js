import { getContentType, downloadMediaMessage } from '@whiskeysockets/baileys'
import { fileTypeFromBuffer } from 'file-type'
import logger from '../logger.js'
import { CONFIG } from '../config.js'

export const MEDIA_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'stickerMessage',
  'documentMessage',
])

export function isMediaType(type) {
  return MEDIA_TYPES.has(type)
}

export function getMessageType(msg) {
  if (!msg?.message) return null
  return getContentType(msg.message)
}

export function extractText(msg) {
  const content = msg?.message
  if (!content) return ''
  const type = getContentType(content)
  if (!type) return ''
  const m = content[type]
  switch (type) {
    case 'conversation':
      return m || ''
    case 'extendedTextMessage':
      return m?.text || ''
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
      return m?.caption || ''
    default:
      return ''
  }
}

export function getContextInfo(msg) {
  const type = getMessageType(msg)
  if (!type) return {}
  return msg.message[type]?.contextInfo || {}
}

export const wrapQuoted = (key, message) => ({ key, message })

export async function downloadMedia(sock, msg, type = getMessageType(msg)) {
  if (!type || !isMediaType(type)) return null
  const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger })
  if (buffer.length > CONFIG.maxMediaBytes) {
    throw new Error('media file is too large (max 64 MB)')
  }
  const ft = await fileTypeFromBuffer(buffer)
  return { buffer, mime: ft?.mime, ext: ft?.ext }
}