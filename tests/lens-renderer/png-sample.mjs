// A small PNG reader for the renderer tests: 8-bit RGBA or RGB, non-interlaced, filter types 0 to 4, no dependency.
import { inflateSync } from 'node:zlib'

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** { width, height, at(x, y) -> '#rrggbb' } of a PNG buffer. */
export function decodePng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG')
  let pos = 8, width = 0, height = 0, depth = 0, colour = 0, interlace = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colour = data[9]; interlace = data[12] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (depth !== 8 || interlace !== 0 || (colour !== 6 && colour !== 2)) throw new Error(`unsupported PNG (depth ${depth}, colour ${colour}, interlace ${interlace})`)
  const bpp = colour === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x]
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = y > 0 ? px[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0
      px[y * stride + x] = (cur + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? ((a + b) >> 1) : paeth(a, b, c))) & 255
    }
  }
  return {
    width,
    height,
    alpha: (x, y) => (bpp === 4 ? px[y * stride + x * bpp + 3] : 255),
    at: (x, y) => '#' + [0, 1, 2].map(i => px[y * stride + x * bpp + i].toString(16).padStart(2, '0')).join(''),
  }
}
