import { randomInt } from 'node:crypto'
import sharp from 'sharp'
import { sendError, sendImage, sendText } from '../lib/reply.js'

// Comfortably below crypto.randomInt's 2^48-1 span limit.
const LIMIT = 1_000_000_000

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]],
}

function diceSvg(value) {
  const s = 512
  const dots = PIPS[value]
    .map(([x, y]) => `<circle cx="${x * 128}" cy="${y * 128}" r="52" fill="#1f2937"/>`)
    .join('')
  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="${s - 32}" height="${s - 32}" rx="72" fill="#ffffff" stroke="#1f2937" stroke-width="12"/>
    ${dots}
  </svg>`
}

export const gameCommands = [
  {
    name: 'dice',
    aliases: ['d'],
    category: 'games',
    icon: '🎲',
    usage: '.dice',
    description: 'Roll a six-sided die.',
    async exec(ctx) {
      const value = randomInt(1, 7)
      const png = await sharp(Buffer.from(diceSvg(value))).png().toBuffer()
      await sendImage(ctx, png, `*Rolled*: ${value}`)
    },
  },
  {
    name: 'coin',
    category: 'games',
    icon: '🪙',
    usage: '.coin',
    description: 'Flip a coin.',
    async exec(ctx) {
      const result = randomInt(2) === 0 ? 'Heads' : 'Tails'
      await sendText(ctx, `*Result*: ${result}`)
    },
  },
  {
    name: 'random',
    category: 'games',
    icon: '🎯',
    usage: '.random [min] [max]',
    description: 'Random integer (default range 1–100).',
    async exec(ctx) {
      let min = 1
      let max = 100
      if (ctx.args.length >= 2) {
        min = Math.floor(Number(ctx.args[0]))
        max = Math.floor(Number(ctx.args[1]))
      } else if (ctx.args.length === 1) {
        max = Math.floor(Number(ctx.args[0]))
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        await sendError(ctx, 'Usage: `.random [min] [max]` with min < max.')
        return
      }
      // crypto.randomInt throws ERR_OUT_OF_RANGE once the span exceeds
      // 2^48-1, which previously surfaced as a generic crash for the user.
      if (min < -LIMIT || max > LIMIT || max - min > LIMIT) {
        await sendError(ctx, `Range too large. Use values between ${-LIMIT} and ${LIMIT}, up to ${LIMIT} apart.`)
        return
      }
      await sendText(ctx, `*Result*: ${randomInt(min, max + 1)} (${min}–${max})`)
    },
  },
]