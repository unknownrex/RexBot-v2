import { CHANNELS, DEFAULT_ICON, compose } from './theme.js'

// ctx carries sock/jid/msg plus the resolved command, so every send derives its
// header from the same place instead of hand-rolling one per command.

const header = (ctx, channel) => {
  const ch = CHANNELS[channel]
  return { icon: ch.icon, title: ch.title }
}

const commandHeader = (ctx) => ({
  icon: ctx?.cmd?.icon || DEFAULT_ICON,
  title: ctx?.cmd?.name || 'RexBot',
})

const send = (ctx, content, edit) => {
  const { sock, jid, msg } = ctx
  return sock.sendMessage(jid, edit ? { text: content, edit } : { text: content }, { quoted: msg })
}

export const sendText = (ctx, text, edit) => send(ctx, compose(commandHeader(ctx).icon, commandHeader(ctx).title, text), edit)

export const sendInfo = (ctx, text) => {
  const h = header(ctx, 'info')
  return send(ctx, compose(h.icon, h.title, text))
}

export const sendOk = (ctx, text) => {
  const h = header(ctx, 'ok')
  return send(ctx, compose(h.icon, h.title, text))
}

export const sendWarn = (ctx, text) => {
  const h = header(ctx, 'warn')
  return send(ctx, compose(h.icon, h.title, text))
}

export const sendError = (ctx, text) => {
  const h = header(ctx, 'error')
  return send(ctx, compose(h.icon, h.title, text))
}

export const sendSticker = (ctx, sticker, caption) =>
  ctx.sock.sendMessage(
    ctx.jid,
    { sticker, ...(caption ? { caption: compose(commandHeader(ctx).icon, commandHeader(ctx).title, caption) } : {}) },
    { quoted: ctx.msg },
  )

export const sendImage = (ctx, buffer, caption) =>
  ctx.sock.sendMessage(
    ctx.jid,
    {
      image: buffer,
      caption: compose(commandHeader(ctx).icon, commandHeader(ctx).title, caption),
    },
    { quoted: ctx.msg },
  )