// Self-check for jid resolution. Run: npm test
import assert from 'node:assert/strict'
import test from 'node:test'

const { resolvePnJid } = await import('../src/lib/jid.js')

const DM = '628111@s.whatsapp.net'
const GROUP = '120363000000000000@g.us'

// A sock that hangs forever on groupMetadata, like the real one does for a
// non-group jid: the query is sent and WhatsApp never answers.
const hangingSock = {
  groupMetadata: () => new Promise(() => {}),
}

test('does not call groupMetadata for a DM jid', async () => {
  let called = false
  const sock = {
    groupMetadata: () => {
      called = true
      return new Promise(() => {})
    },
  }
  const result = await resolvePnJid(sock, DM, '999@lid')
  assert.equal(called, false)
  assert.equal(result, '999@lid')
})

test('still resolves through group metadata in a group', async () => {
  const sock = {
    groupMetadata: async () => ({
      participants: [{ id: '999@lid', phoneNumber: '628222@s.whatsapp.net' }],
    }),
  }
  const result = await resolvePnJid(sock, GROUP, '999@lid')
  assert.equal(result, '628222@s.whatsapp.net')
})

test('a known s.whatsapp.net jid short-circuits without any lookup', async () => {
  const result = await resolvePnJid(hangingSock, GROUP, DM)
  assert.equal(result, DM)
})
