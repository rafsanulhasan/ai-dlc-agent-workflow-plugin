// Spike 029 (ITEM-029): writes the avatar test images into ../assets/.
// Run: node tools/gen-assets.mjs   (from the spike folder; Windows: JPEG and GIF via pwsh System.Drawing)
// Throwaway. No dependencies beyond Node and, for JPEG/GIF, PowerShell 7 on Windows.
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'assets')
mkdirSync(out, { recursive: true })

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0)
  return Buffer.concat([len, td, crc])
}
// RGB PNG; pixel(x, y) -> [r, g, b]; level 0 keeps noise images at a predictable size.
function png(w, h, pixel, level = 9) {
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y)
      const o = y * (1 + w * 3) + 1 + x * 3
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0)),
  ])
}

// Lossless WebP (VP8L) of one solid colour: every prefix code is a one-symbol "simple" code,
// so each pixel takes zero bits and the bitstream is the header plus five codes.
function webpSolid(w, h, [r, g, b, a]) {
  const bits = []
  const put = (v, n) => { for (let i = 0; i < n; i++) bits.push((v >> i) & 1) }
  put(0x2f, 8); put(w - 1, 14); put(h - 1, 14); put(0, 1); put(0, 3) // signature, size, alpha hint, version
  put(0, 1) // no transform
  put(0, 1) // no colour cache
  put(0, 1) // no meta prefix codes
  const simple = sym => { put(1, 1); put(0, 1); put(1, 1); put(sym, 8) } // simple, 1 symbol, 8-bit symbol
  simple(g); simple(r); simple(b); simple(a); simple(0) // green, red, blue, alpha, distance
  const bytes = Buffer.alloc(Math.ceil(bits.length / 8))
  bits.forEach((bit, i) => { if (bit) bytes[i >> 3] |= 1 << (i & 7) })
  const data = bytes.length % 2 ? Buffer.concat([bytes, Buffer.alloc(1)]) : bytes
  const vp8l = Buffer.concat([Buffer.from('VP8L'), u32le(bytes.length), data])
  return Buffer.concat([Buffer.from('RIFF'), u32le(4 + vp8l.length), Buffer.from('WEBP'), vp8l])
}
function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }

const written = {}
function save(name, buf) { writeFileSync(join(out, name), buf); written[name] = buf.length }

// 1. The avatar every format cell uses: 48x48, a two-colour quadrant pattern (blue/orange).
save('avatar.png', png(48, 48, (x, y) => ((x < 24) !== (y < 24) ? [30, 110, 220] : [240, 140, 20])))
save('avatar.webp', webpSolid(48, 48, [150, 40, 200, 255])) // solid purple

// 2. Size ladder: RGB noise, stored (deflate level 0), sized by base64 length of the PNG.
const ladder = { 'size-4k': 4000, 'size-32k': 32000, 'size-64k': 64000, 'size-95k': 95000, 'size-130k': 130500, 'size-140k': 140000 }
for (const [name, b64Target] of Object.entries(ladder)) {
  const byteTarget = Math.floor(b64Target * 3 / 4)
  const w = 32
  let h = Math.max(1, Math.floor((byteTarget - 80) / (1 + w * 3)))
  let buf
  for (;;) {
    const noise = randomBytes(w * h * 3)
    buf = png(w, h, (x, y) => { const o = (y * w + x) * 3; return [noise[o], noise[o + 1], noise[o + 2]] }, 0)
    if (Math.ceil(buf.length / 3) * 4 <= b64Target || h === 1) break
    h--
  }
  save(`${name}.png`, buf)
}

// 3. JPEG and GIF through System.Drawing (Windows PowerShell 7).
const ps = `
Add-Type -AssemblyName System.Drawing
function Make($path, $fmt, $c1, $c2) {
  $bmp = New-Object System.Drawing.Bitmap 48, 48
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb($c1[0], $c1[1], $c1[2]))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($c2[0], $c2[1], $c2[2]))
  $g.FillEllipse($brush, 8, 8, 32, 32)
  $bmp.Save($path, $fmt)
  $g.Dispose(); $bmp.Dispose()
}
Make '${join(out, 'avatar.jpg').replace(/'/g, "''")}' ([System.Drawing.Imaging.ImageFormat]::Jpeg) @(20,150,60) @(255,255,255)
Make '${join(out, 'avatar.gif').replace(/'/g, "''")}' ([System.Drawing.Imaging.ImageFormat]::Gif) @(200,30,30) @(255,230,0)
`
execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' })
for (const n of ['avatar.jpg', 'avatar.gif']) written[n] = statSync(join(out, n)).size

for (const [n, size] of Object.entries(written)) {
  const b64 = Math.ceil(size / 3) * 4
  console.log(`${n.padEnd(16)} ${String(size).padStart(7)} bytes  base64 ${String(b64).padStart(7)} chars`)
}
