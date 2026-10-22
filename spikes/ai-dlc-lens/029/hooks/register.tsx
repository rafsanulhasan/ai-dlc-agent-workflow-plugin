// Spike 029 (ITEM-029): avatar images in the mod pane. Throwaway; see ../CHECK.md.
import type { Register } from 'claude-code'

import { ASSET_FILES, overCapCell, pick, svgCells, type Asset, type SvgCell } from './cells'

const PANE = 'spike029'
const OVERCAP = 'spike029-overcap'

let cache: Record<string, Asset> | undefined

function decodedBytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return (b64.length / 4) * 3 - pad
}

async function loadAssets($: { fs: { read: (p: string, o: { as: 'bytes' }) => Promise<{ base64: string }> } }, root: string) {
  if (cache) return cache
  const out: Record<string, Asset> = {}
  for (const [name, mime] of Object.entries(ASSET_FILES)) {
    const { base64 } = await $.fs.read(`${root}/assets/${name}`, { as: 'bytes' })
    out[name] = { name, mime, base64, bytes: decodedBytes(base64) }
  }
  cache = out
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'spike029', description: 'Spike 029: open the avatar image grid pane' })
    await $.command.register({ name: 'spike029-overcap', description: 'Spike 029: open the over-cap Svg pane (expected refused)' })

    return next(e)
  })

  on('command.run', { command: 'spike029' }, async $ => {
    const r = await $.ui.open({ id: PANE, title: 'Spike 029 avatars' })

    return { text: `Spike 029 pane opened (isPlaced: ${String(r.isPlaced)}).` }
  })

  on('command.run', { command: 'spike029-overcap' }, async $ => {
    const r = await $.ui.open({ id: OVERCAP, title: 'Spike 029 over cap' })

    return { text: `Spike 029 over-cap pane opened (isPlaced: ${String(r.isPlaced)}).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const root = $.plugin.root
    const assets = await loadAssets($, root)

    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)
      const png = pick(assets, 'avatar.png')
      const big = pick(assets, 'size-95k.png')

      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>Spike 029, terminal surface (no Svg here)</Text>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="column">
              <Text>T1 Image file path (avatar.png)</Text>
              <Image key="t1" source={{ file: `${root}/assets/avatar.png`, format: 'png' }} columns={8} rows={4} alt="T1 not drawn" />
            </Box>
            <Box flexDirection="column">
              <Text>T2 Image png bytes from a data URI</Text>
              <Image key="t2" source={{ png: png.base64 }} columns={8} rows={4} alt="T2 not drawn" />
            </Box>
            <Box flexDirection="column">
              <Text>T3 Image file, {big.bytes} B png</Text>
              <Image key="t3" source={{ file: `${root}/assets/size-95k.png`, format: 'png' }} columns={8} rows={4} alt="T3 not drawn" />
            </Box>
            <Box flexDirection="column">
              <Text>T4 initials badge (fallback ref)</Text>
              <Text color="white" backgroundColor="blue" bold> MR </Text>
            </Box>
          </Box>
          <Text dimColor>Pass: T1-T3 show a picture; the dim alt text means not drawn. Plugin root: {root}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    const cells = svgCells(assets, root)

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Spike 029, {e.surface} surface</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={2}>
          {cells.map((c: SvgCell) => (
            <Box flexDirection="column" width={30}>
              <Text bold>{c.id}</Text>
              <Text dimColor>{c.label}</Text>
              <Svg source={c.source} alt={`${c.id} not drawn`} width={c.width} height={c.height} isInteractive={c.isInteractive} />
              <Text dimColor>pass: {c.pass}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: OVERCAP }, async ($, e) => {
    const assets = await loadAssets($, $.plugin.root)
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)

      return <Text>S25 is a vscode / desktop check; the terminal has no Svg.</Text>
    }
    const { Box, Text, Svg } = $.ui.resolve(e)
    const c = overCapCell(assets)

    return (
      <Box flexDirection="column">
        <Text bold>{c.id} {c.label}</Text>
        <Svg source={c.source} alt={`${c.id} not drawn`} width={48} height={48} />
        <Text dimColor>pass: {c.pass}</Text>
      </Box>
    )
  })
}
