import { spawn } from 'child_process'
import { createRequire } from 'module'

const KEEP_ALIVE_URL = 'http://127.0.0.1:3000/'
const CHECK_INTERVAL = 5000 // 5 seconds

function startServer(): ChildProcess {
  console.log(`[keeper] Starting Next.js dev server...`)
  const child = spawn('bun', ['run', 'dev'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  child.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) process.stdout.write(`[next] ${msg}\n`)
  })

  child.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) process.stderr.write(`[next] ${msg}\n`)
  })

  child.on('exit', (code, signal) => {
    console.log(`[keeper] Server exited with code=${code} signal=${signal}`)
  })

  return child
}

async function isServerReady(): Promise<boolean> {
  try {
    const res = await fetch(KEEP_ALIVE_URL, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForServer(maxWait = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    if (await isServerReady()) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

// Main loop
async function main() {
  console.log('[keeper] Server keeper starting...')

  while (true) {
    let server = startServer()
    
    // Wait for server to be ready
    const ready = await waitForServer()
    if (ready) {
      console.log('[keeper] Server is ready!')
    } else {
      console.log('[keeper] Server failed to start, retrying...')
      try { server.kill() } catch {}
      await new Promise(r => setTimeout(r, 3000))
      continue
    }

    // Keep server alive with periodic pings
    while (true) {
      await new Promise(r => setTimeout(r, CHECK_INTERVAL))
      
      // Check if process is still alive
      try {
        const pid = server.pid
        if (!pid) {
          console.log('[keeper] Server process no longer exists')
          break
        }
        // Send signal 0 to check if process exists
        process.kill(pid, 0)
      } catch {
        console.log('[keeper] Server process died')
        break
      }

      // Ping to keep active
      try {
        await fetch(KEEP_ALIVE_URL, { signal: AbortSignal.timeout(3000) })
      } catch {
        console.log('[keeper] Ping failed, server may be dead')
        break
      }
    }

    console.log('[keeper] Restarting server in 3s...')
    try { server.kill() } catch {}
    await new Promise(r => setTimeout(r, 3000))
  }
}

main().catch(err => {
  console.error('[keeper] Fatal error:', err)
  process.exit(1)
})
