import { randomInt } from 'node:crypto'
import sharp from 'sharp'
import { sendError, sendImage, sendText } from '../lib/reply.js'

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]],
}

function diceSvg(value, sides) {
  const s = 512
  const face = value <= 6 ? PIPS[value] : null
  const dots = face
    ? face.map(([x, y]) => `<circle cx="${x * 128}" cy="${y * 128}" r="52" fill="#1f2937"/>`).join('')
    : `<text x="${s / 2}" y="${s / 2}" font-size="220" font-family="Arial,sans-serif" font-weight="bold" fill="#1f2937" text-anchor="middle" dominant-baseline="central">${value}</text>`
  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="${s - 32}" height="${s - 32}" rx="72" fill="#ffffff" stroke="#1f2937" stroke-width="12"/>
    ${dots}
  </svg>`
}

const parseSides = (arg) => {
  const n = Number.parseInt(arg, 10)
  if (!Number.isFinite(n)) return 6
  return Math.min(100, Math.max(2, n))
}

export const gameCommands = [
  {
    name: 'dice',
    aliases: ['d'],
    category: 'games',
    icon: '🎲',
    usage: '.dice [sides]',
    description: 'Roll a die (default 6 sides, max 100).',
    async exec(ctx) {
      const sides = parseSides(ctx.args[0])
      const value = randomInt(1, sides + 1)
      const svg = diceSvg(value, sides)
      const png = await sharp(Buffer.from(svg)).png().toBuffer()
      await sendImage(ctx, png, `*Rolled*: ${value} (d${sides})`)
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
      await sendText(ctx, `*Result*: ${randomInt(min, max + 1)} (${min}–${max})`)
    },
  },
]