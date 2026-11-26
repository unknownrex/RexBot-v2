import pino from 'pino'

// Pretty in a terminal, JSON when piped to a file or another process.
const pretty = process.stdout.isTTY && process.env.LOG_PRETTY !== 'false'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  transport: pretty
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined,
})

// Baileys logs every socket detail at info level, which buries our own lines.
export const socketLogger = logger.child({ mod: 'baileys' }, { level: 'warn' })

export default logger