// Caps how many media conversions run at once. Requests over the cap wait
// rather than being dropped, so a large batch still converts in full.
import { CONFIG } from '../config.js'

let active = 0
const waiting = []

function release() {
  active -= 1
  const next = waiting.shift()
  if (next) next()
}

export function withConversionSlot(fn) {
  const run = async () => {
    active += 1
    try {
      return await fn()
    } finally {
      release()
    }
  }

  if (active < CONFIG.mediaConcurrency) return run()

  return new Promise((resolve, reject) => {
    waiting.push(() => run().then(resolve, reject))
  })
}
