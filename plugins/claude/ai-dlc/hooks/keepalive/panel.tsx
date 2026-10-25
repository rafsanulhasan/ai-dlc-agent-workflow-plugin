// Keep-alive's band (AbovePrompt, Terminal and Desktop) and Pane (VS Code): one tree, two hosts, so
// their rows cannot differ (LLD rev 7, section 13; rev 11, 20.6). This file only draws, like
// ../auto-handoff/panel.tsx: keepalive.ts holds the state and the presses, since the host never follows
// $ across an import.
import type { BandModel, Ttl } from './cache-state.ts'

// The elements come from $.ui.resolve in the render hook.
type Elements = { Box: any; Text: any; Button: any }

/** The band's own controls (step 42): minimised or not, the press of its `–` / `□` and of its `×`. The Pane has none. */
export type BandControls = { minimised: boolean; onToggle: () => void; onClose: () => void }

/** Whether keep-alive is on, from the master button (it names the press: `[off]` while on). */
export const masterState = (m: BandModel): 'on' | 'off' => (m.master === 'off' ? 'on' : 'off')

/** The band's controls after the master button: the lens band's minimise (`–` minimises, `□` restores) and a
 * close (`×`), both plain. No Box in this tree has a width: the band shares its parent with core's engine node. */
function controls(Button: any, c: BandControls) {
  return [
    <Button key="ka-min" label={c.minimised ? '□' : '–'} plain onPress={c.onToggle} />,
    <Button key="ka-close" label="×" role="dismiss" plain onPress={c.onClose} />,
  ]
}

/** The title row (bold title and the master button), the 5m row, the 1h row, each its full line and its
 * button, then the seed row while the seed line shows (no button). No margin or padding; gap 0.
 * Step 42: with `band` (the band), the title row ends in the minimise control and the close; minimised, the
 * band is that one row with whether keep-alive is on or off, the master button and the two controls. */
export function keepaliveTree({ Box, Text, Button }: Elements, m: BandModel, onPress: (t: Ttl) => void, onMaster: () => void, band?: BandControls) {
  const master = <Button key="ka-master" label={m.master} onPress={onMaster} />
  if (band?.minimised)
    return (
      <Box flexDirection="row" gap={0}>
        <Text bold>{m.title} </Text>
        <Text>{masterState(m)} </Text>
        {master}
        {controls(Button, band)}
      </Box>
    )
  return (
    <Box flexDirection="column" gap={0}>
      <Box flexDirection="row" gap={0}>
        <Text bold>{m.title} </Text>
        {master}
        {band ? controls(Button, band) : null}
      </Box>
      {m.rows.map(r => (
        <Box key={`ka-row-${r.track}`} flexDirection="row" gap={0}>
          <Text>{r.line} </Text>
          <Button key={`ka-${r.track}`} label={r.button} onPress={() => onPress(r.track)} />
        </Box>
      ))}
      {m.seed !== undefined ? <Text>{m.seed}</Text> : null}
    </Box>
  )
}

/** The band as plain text, one row per line, for tests and logs; `minimised`: its one row. */
export const bandText = (m: BandModel, minimised = false): string =>
  minimised
    ? `${m.title} ${masterState(m)} [${m.master}]`
    : [`${m.title} [${m.master}]`, ...m.rows.map(r => `${r.line} [${r.button}]`), ...(m.seed !== undefined ? [m.seed] : [])].join('\n')
