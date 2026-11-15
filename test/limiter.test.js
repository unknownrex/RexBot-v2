// Self-check for the conversion concurrency gate. Run: npm test
import assert from 'node:assert/strict'
import test from 'node:test'

const { withConversionSlot } = await import('../src/lib/limiter.js')
const { CONFIG } = await import('../src/config.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('never runs more than the configured number of jobs at once', async () => {
  let active = 0
  let peak = 0
  const jobs = Array.from({ length: 20 }, () =>
    withConversionSlot(async () => {
      active += 1
      peak = Math.max(peak, active)
      await sleep(5)
      active -= 1
    }),
  )
  await Promise.all(jobs)
  assert.equal(active, 0)
  assert.ok(peak <= CONFIG.mediaConcurrency, `peak ${peak} exceeded ${CONFIG.mediaConcurrency}`)
})

test('every queued job still completes, none are dropped', async () => {
  const done = []
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      withConversionSlot(async () => {
        done.push(i)
      }),
    ),
  )
  assert.equal(done.length, 20)
})

test('a failing job releases its slot', async () => {
  await assert.rejects(() => withConversionSlot(async () => { throw new Error('boom') }), /boom/)
  // If the slot leaked, this would hang past the test timeout.
  const result = await withConversionSlot(async () => 'ok')
  assert.equal(result, 'ok')
})
