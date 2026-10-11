const lidToPn = new Map()

export function registerLidMapping(lid, pn) {
  if (lid && pn) lidToPn.set(lid, pn.endsWith('@s.whatsapp.net') ? pn : `${pn}@s.whatsapp.net`)
}

export function toPnJid(jid) {
  if (!jid) return null
  if (jid.endsWith('@s.whatsapp.net')) return jid
  const pn = lidToPn.get(jid)
  if (pn) return pn.endsWith('@s.whatsapp.net') ? pn : `${pn}@s.whatsapp.net`
  return jid
}

export function participantsByJid(metadata) {
  const map = new Map()
  for (const p of metadata?.participants || []) {
    if (p.id) map.set(p.id, p)
    if (p.lid) map.set(p.lid, p)
    if (p.phoneNumber) map.set(p.phoneNumber, p)
  }
  return map
}

export async function resolvePnJid(sock, chatJid, jid) {
  const mapped = toPnJid(jid)
  if (mapped?.endsWith('@s.whatsapp.net')) return mapped
  try {
    const metadata = await sock.groupMetadata(chatJid)
    const p = participantsByJid(metadata).get(mapped)
    const pn = p?.phoneNumber || p?.pn
    if (pn) return pn.endsWith('@s.whatsapp.net') ? pn : `${pn}@s.whatsapp.net`
  } catch {
    // not a group or lookup failed; return best guess
  }
  return mapped
}

export function displayNameFor(sock, jid, fallback) {
  return fallback || jid?.split('@')[0] || jid
}