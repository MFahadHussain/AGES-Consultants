import { spawn } from 'child_process'

console.log('[dev-server-keeper] Starting Next.js dev server...')

const child = spawn('npx', ['next', 'dev', '--turbopack', '-p', '3000'], {
  cwd: '/home/z/my-project',
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' }
})

child.on('exit', (code) => {
  console.log(`[dev-server-keeper] Server exited with code ${code}`)
  process.exit(code || 1)
})

// Keep alive pinger
setInterval(async () => {
  try {
    await fetch('http://127.0.0.1:3000/')
  } catch {}
}, 5000)
