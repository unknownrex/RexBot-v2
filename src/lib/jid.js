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

// groupMetadata is a network round trip, so callers resolving several
// participants in one go should fetch it once and pass the cached result here.
export async function resolvePnJid(sock, chatJid, jid, metadata) {
  const mapped = toPnJid(jid)
  if (mapped?.endsWith('@s.whatsapp.net')) return mapped
  try {
    const md = metadata || (await sock.groupMetadata(chatJid))
    const p = participantsByJid(md).get(mapped)
    const pn = p?.phoneNumber || p?.pn
    if (pn) return pn.endsWith('@s.whatsapp.net') ? pn : `${pn}@s.whatsapp.net`
  } catch {
    // not a group or lookup failed; return best guess
  }
  return mapped
}

// Prefer the name WhatsApp knows for this user over the raw digits.
// `sock` and `metadata` are optional so this stays safe to call bare.
export function displayNameFor(sock, jid, fallback, metadata) {
  if (fallback) return fallback
  const store = sock?.store?.contacts
  const mapped = toPnJid(jid)
  const fromStore =
    store?.get?.(jid)?.notify ||
    store?.get?.(jid)?.name ||
    (mapped && store?.get?.(mapped)?.notify) ||
    (mapped && store?.get?.(mapped)?.name)
  if (fromStore) return fromStore
  if (metadata) {
    const p = participantsByJid(metadata).get(jid) || participantsByJid(metadata).get(mapped)
    const name = p?.notify || p?.name
    if (name) return name
  }
  return jid?.split('@')[0] || jid
}