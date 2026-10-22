// Check 5a: a classic (command) Stop hook that prints a systemMessage while
// GATE-ALERT.txt in the plugin root holds "on". Never blocks.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.env.CLAUDE_PLUGIN_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..')
let state = 'off'
try {
  state = readFileSync(join(root, 'GATE-ALERT.txt'), 'utf8').trim()
} catch {
  // no marker: off
}
if (state === 'on') {
  process.stdout.write(JSON.stringify({ systemMessage: 'ai-dlc-lens spike: gate alert test (5a, command Stop hook systemMessage)' }))
}
process.exit(0)
