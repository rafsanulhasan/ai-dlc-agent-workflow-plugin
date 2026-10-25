// AC-20.5.1: the renderer makes no network attempt. render.mjs runs with NODE_OPTIONS=--require a stub
// that replaces fetch, http(s).request, net.Socket.prototype.connect and dns.lookup with recorders that fail;
// the test renders each format and asserts none was called.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RENDER = fileURLToPath(new URL('../../plugins/claude/ai-dlc-lens/renderer/render.mjs', import.meta.url))
// a folder of this process alone, so two runs at once never share the stub or the log
const DIR = mkdtempSync(join(tmpdir(), 'lens-offline-'))
const STUB = join(DIR, 'stub.cjs')
const LOG = join(DIR, 'attempts.log')
// NODE_OPTIONS reads backslashes as escapes: forward slashes
const OPTIONS = `--require "${STUB.replaceAll(String.fromCharCode(92), '/')}"`

const stubSource = `
const fs = require('node:fs')
const note = what => { fs.appendFileSync(process.env.OFFLINE_LOG, what + '\\n'); throw new Error('network attempt: ' + what) }
globalThis.fetch = () => note('fetch')
const http = require('node:http'), https = require('node:https'), net = require('node:net'), dns = require('node:dns')
http.request = () => note('http.request')
https.request = () => note('https.request')
http.get = () => note('http.get')
https.get = () => note('https.get')
net.Socket.prototype.connect = () => note('net.Socket.connect')
net.connect = () => note('net.connect')
dns.lookup = () => note('dns.lookup')
`

function run(format, source) {
  rmSync(LOG, { force: true })
  const r = spawnSync(process.execPath, [RENDER, '--kind', 'mermaid', '--format', format], {
    input: source,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: OPTIONS, OFFLINE_LOG: LOG },
  })
  return { status: r.status, out: r.stdout, stderr: r.stderr, attempts: existsSync(LOG) ? readFileSync(LOG, 'utf8').trim().split('\n') : [] }
}

describe('the renderer is offline (AC-20.5.1)', () => {
  writeFileSync(STUB, stubSource)

  test('the stub works: a fetch under it is recorded and fails (so zero attempts below means something)', () => {
    rmSync(LOG, { force: true })
    const r = spawnSync(process.execPath, ['-e', 'try { fetch("http://x.test") } catch {}'], { env: { ...process.env, NODE_OPTIONS: OPTIONS, OFFLINE_LOG: LOG } })
    assert.equal(r.status, 0)
    assert.deepEqual(readFileSync(LOG, 'utf8').trim().split('\n'), ['fetch'])
  })

  for (const format of ['svg', 'png']) {
    test(`a Mermaid fixture drawn as ${format} draws, with zero network attempts`, () => {
      const r = run(format, 'flowchart LR\n  A[Start] --> B[End]\n')
      assert.equal(r.status, 0, r.stderr)
      const e = JSON.parse(r.out)
      assert.equal(e.error, null)
      assert.equal(e.data.format, format)
      assert.deepEqual(r.attempts, [])
    })
  }

  test('a source that names a remote image or link makes no request either', () => {
    const r = run('svg', 'flowchart LR\n  A["<img src=\\"http://example.test/a.png\\">"] --> B\n  click B href "http://example.test/"\n')
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(r.attempts, [])
  })

  test('the renderer writes nothing to disk: the scratch folder holds only the test files', () => {
    run('png', 'flowchart LR\n  A --> B\n')
    assert.ok(!existsSync(join(DIR, 'out')))
  })
})
