import WebP from 'node-webpmux'
import { CONFIG } from '../config.js'

export function buildExif() {
  const json = JSON.stringify({
    'sticker-pack-id': `rexbot-${process.pid}`,
    'sticker-pack-name': CONFIG.packName,
    'sticker-pack-publisher': CONFIG.packPublisher,
    'android-app-store-link': 'https://whatsapp.com',
    'ios-app-store-link': 'https://whatsapp.com',
    emojis: ['🤖'],
  })
  const jsonBuffer = Buffer.from(json, 'utf8')
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00,
    0x00, 0x00,
  ])
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)
  return exif
}

export async function embedPackMetadata(webpBuffer) {
  const img = new WebP.Image()
  await img.load(webpBuffer)
  img.exif = buildExif()
  return img.save(null)
}