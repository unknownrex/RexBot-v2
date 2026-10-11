export const sendText = (sock, jid, text, quoted) =>
  sock.sendMessage(jid, { text }, { quoted })

export const sendSticker = (sock, jid, sticker, quoted) =>
  sock.sendMessage(jid, { sticker }, { quoted })

export const sendImage = (sock, jid, buffer, caption, quoted) =>
  sock.sendMessage(jid, { image: buffer, caption }, { quoted })

export const sendError = (sock, jid, message, quoted) =>
  sendText(sock, jid, `❌ ${message}`, quoted)