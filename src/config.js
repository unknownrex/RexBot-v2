import 'dotenv/config'

const int = (v, def) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

export const CONFIG = {
  prefix: process.env.PREFIX || '.',
  botName: process.env.BOT_NAME || 'RexBot',
  packName: process.env.PACK_NAME || 'RexBot',
  packPublisher: process.env.PACK_PUBLISHER || 'RexBot Team',
  maxVideoSeconds: int(process.env.MAX_VIDEO_SECONDS, 6),
  cooldownMs: int(process.env.COOLDOWN_MS, 3000),
  ffmpegTimeoutMs: int(process.env.FFMPEG_TIMEOUT_MS, 30000),
  authDir: 'auth',
  tempDir: 'temp',
  maxMediaBytes: 64 * 1024 * 1024,
  staticStickerMaxBytes: 100 * 1024,
  animatedStickerMaxBytes: 250 * 1024,
  stickerSize: 512,
  maxFrames: 100,
  fps: 11,
}

export const stickerPackInfo = () => ({
  packName: CONFIG.packName,
  packPublisher: CONFIG.packPublisher,
  packId: `rexbot-${process.pid}`,
})