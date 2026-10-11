import { spawn } from 'node:child_process'
import ffmpegStatic from 'ffmpeg-static'
import { CONFIG } from '../config.js'

export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegStatic, args, { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('ffmpeg timed out'))
    }, CONFIG.ffmpegTimeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`))
    })
  })
}