import 'dotenv/config'

const int = (v, def) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

export const CONFIG = {
  prefix: process.env.PREFIX || '.',
  botName: process.env.BOT_NAME || 'RexBot',
  theme: {
    style: process.env.THEME_STYLE === 'minimal' ? 'minimal' : 'divider',
    accent: process.env.THEME_ACCENT || '·',
    divider: process.env.THEME_DIVIDER || '━',
    dividerWidth: int(process.env.THEME_DIVIDER_WIDTH, 15),
  },
  packName: process.env.PACK_NAME || 'RexBot',
  packPublisher: process.env.PACK_PUBLISHER || 'RexBot Team',
  maxVideoSeconds: int(process.env.MAX_VIDEO_SECONDS, 6),
  cooldownMs: int(process.env.COOLDOWN_MS, 3000),
  // Media commands allow this many invocations per cooldown window, so a
  // multi-image send converts in full instead of one per window.
  mediaBatchLimit: int(process.env.MEDIA_BATCH_LIMIT, 10),
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