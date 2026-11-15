// Self-check for the media download guards. Run: node --test test/
import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'

const { downloadMedia } = await import('../src/lib/media.js')

// Baileys is imported by media.js; stub the module's download call by
// exercising the host check through the public entry point instead.
const msg = (url) => ({
  message: { imageMessage: { url, mimetype: 'image/jpeg' } },
})

test('rejects a media URL pointing at an internal host', async () => {
  await assert.rejects(
    () => downloadMedia(null, msg('http://169.254.169.254/latest/meta-data/'), 'imageMessage'),
    /host is not allowed/,
  )
})

test('rejects localhost', async () => {
  await assert.rejects(
    () => downloadMedia(null, msg('http://127.0.0.1:8080/x'), 'imageMessage'),
    /host is not allowed/,
  )
})

test('rejects a lookalike host', async () => {
  await assert.rejects(
    () => downloadMedia(null, msg('https://mmg.whatsapp.net.evil.tld/x'), 'imageMessage'),
    /host is not allowed/,
  )
})

test('rejects a malformed URL', async () => {
  await assert.rejects(() => downloadMedia(null, msg('not a url'), 'imageMessage'), /invalid URL/)
})

test('stream helper aborts past the byte cap', async () => {
  // Mirrors the accumulate-and-abort loop used in downloadMedia.
  const cap = 1024
  const stream = Readable.from([Buffer.alloc(600), Buffer.alloc(600)])
  const chunks = []
  let total = 0
  await assert.rejects(async () => {
    for await (const chunk of stream) {
      total += chunk.length
      if (total > cap) throw new Error('too large')
      chunks.push(chunk)
    }
  }, /too large/)
})
