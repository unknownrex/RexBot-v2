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
  // WhatsApp caps animated stickers at 10s. Also the ceiling for every animated
  // sticker we build, video or GIF.
  maxVideoSeconds: Math.min(int(process.env.MAX_VIDEO_SECONDS, 10), 10),
  cooldownMs: int(process.env.COOLDOWN_MS, 3000),
  // How many media conversions may run at once. Not a rate limit: extra
  // requests queue and still complete, this only stops N simultaneous
  // sharp/ffmpeg jobs from starving the single Node thread.
  mediaConcurrency: int(process.env.MEDIA_CONCURRENCY, 4),
  ffmpegTimeoutMs: int(process.env.FFMPEG_TIMEOUT_MS, 30000),
  authDir: 'auth',
  tempDir: 'temp',
  maxMediaBytes: 64 * 1024 * 1024,
  // WhatsApp caps: 100 KB static, 500 KB animated. Encoded under 400 KB for
  // headroom, since anything over the cap arrives undownloadable.
  staticStickerMaxBytes: 100 * 1024,
  animatedStickerMaxBytes: 400 * 1024,
  stickerSize: 512,
  soundMaxSeconds: int(process.env.SOUND_MAX_SECONDS, 10),
  fps: 11,
}

export const stickerPackInfo = () => ({
  packName: CONFIG.packName,
  packPublisher: CONFIG.packPublisher,
  packId: `rexbot-${process.pid}`,
})