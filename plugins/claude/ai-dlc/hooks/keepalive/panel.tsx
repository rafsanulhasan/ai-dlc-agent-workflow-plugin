// Keep-alive's band (AbovePrompt; on every surface since step 44, R44.7, which retired keep-alive's Pane). This file
// only draws, like
// ../auto-handoff/panel.tsx: keepalive.ts holds the state and the presses, since the host never follows
// $ across an import.
import type { BandModel, Ttl } from './cache-state.ts'

// The elements come from $.ui.resolve in the render hook.
type Elements = { Box: any; Text: any; Button: any }

/** The band's own controls (step 42): minimised or not, the press of its `–` / `□` and of its `×`, and Ping now.
 * Step 44 (R44.7): no `⤢`, since keep-alive has no Pane to open. */
export type BandControls = { minimised: boolean; onToggle: () => void; onClose: () => void; onPing?: () => void }

/**
 * Live findings 3, point 8: minimised, the band's buttons are icons; full, they are words. No surface has an icon
 * element or a Button icon prop (ButtonProps, d.ts:1093-1190); a one-glyph label is the control by itself (`plain`,
 * d.ts:1135-1141), so the icons are glyphs, drawn as the Button's Text child with the label naming the control
 * (d.ts:1107-1113). A desktop draws its native button with them.
 */
const GLYPH = { ping: '⟳', master: '⏻', min: '–', restore: '□', close: '×' } as const
const WORD = { ping: 'Ping now', min: 'Minimise', restore: 'Restore', close: 'Close' } as const
function glyphButton(Button: any, Text: any, key: string, label: string, glyph: string, onPress: () => void, role?: 'dismiss') {
  return (
    <Button key={key} label={label} plain {...(role ? { role } : {})} onPress={onPress}>
      <Text>{glyph}</Text>
    </Button>
  )
}

/** What the head row reads (step 44, R44.3): `on` while either track is on in force (`m.on`), else `off`; its button,
 * `m.master`, is always the opposite. Live findings 3, point 4: never the master switch alone. */
export const masterState = (m: BandModel): 'on' | 'off' => (m.on ? 'on' : 'off')

/** The controls after the master button: Ping now, the band's minimise (`–` minimises, `□` restores) and a close
 * (`×`). */
function controls(Button: any, Text: any, c: BandControls) {
  const ping = c.onPing
  if (c.minimised)
    return [
      ...(ping ? [glyphButton(Button, Text, 'ka-ping', WORD.ping, GLYPH.ping, ping)] : []),
      glyphButton(Button, Text, 'ka-min', WORD.restore, GLYPH.restore, c.onToggle),
      glyphButton(Button, Text, 'ka-close', WORD.close, GLYPH.close, c.onClose, 'dismiss'),
    ]
  return [
    ...(ping ? [<Button key="ka-ping" label={WORD.ping} plain onPress={ping} />] : []),
    <Button key="ka-min" label={WORD.min} plain onPress={c.onToggle} />,
    <Button key="ka-close" label={WORD.close} role="dismiss" plain onPress={c.onClose} />,
  ]
}

/** One row (step 43, live 1c): the text on the left, growing, and the buttons in a group on the right, so every
 * Button is right-aligned on its row. No Box in this tree has a `width`: the band shares its parent with core's
 * engine node, which AbovePrompt refuses under a Box with a width; `flexGrow` and `justifyContent` place it instead. */
function row(Box: any, key: string | undefined, text: unknown, buttons: unknown) {
  return (
    <Box key={key} flexDirection="row" justifyContent="space-between" gap={0}>
      <Box flexDirection="row" flexGrow={1} gap={0}>{text}</Box>
      <Box flexDirection="row" justifyContent="flex-end" gap={0}>{buttons}</Box>
    </Box>
  )
}

/** The title row (bold title, whether keep-alive is on or off, and the master button, which offers the opposite;
 * step 44, R44.3), the 5m row, the 1h row, each its line (its status first, R44.2) and its button, then the seed row
 * while the seed line shows (no button). No margin or padding; gap 0.
 * Step 42: with `band`, the title row ends in Ping now, the minimise control and the close (step 44, R44.7: no
 * maximise control); minimised, it is that one row with whether keep-alive is on or off, the master button and the
 * controls. Step 43 (live 1c): every Button is `plain`, the master and the
 * track buttons as the controls, so all are drawn the same height. */
export function keepaliveTree({ Box, Text, Button }: Elements, m: BandModel, onPress: (t: Ttl) => void, onMaster: () => void, band?: BandControls) {
  const master = <Button key="ka-master" label={m.master} plain onPress={onMaster} />
  const ctl = band ? controls(Button, Text, band) : []
  if (band?.minimised)
    return row(Box, undefined, [<Text key="ka-t" bold>{m.title} </Text>, <Text key="ka-s">{masterState(m)} </Text>], [glyphButton(Button, Text, 'ka-master', m.master, GLYPH.master, onMaster), ...ctl])
  return (
    <Box flexDirection="column" gap={0}>
      {row(Box, 'ka-title', [<Text key="ka-t" bold>{m.title} </Text>, <Text key="ka-s">{masterState(m)} </Text>], [master, ...ctl])}
      {m.rows.map(r => row(Box, `ka-row-${r.track}`, <Text>{r.line} </Text>, <Button key={`ka-${r.track}`} label={r.button} plain onPress={() => onPress(r.track)} />))}
      {m.seed !== undefined ? <Text>{m.seed}</Text> : null}
    </Box>
  )
}

/** The band as plain text, one row per line, for tests and logs; `minimised`: its one row. */
export const bandText = (m: BandModel, minimised = false): string =>
  minimised
    ? `${m.title} ${masterState(m)} [${m.master}]`
    : [`${m.title} ${masterState(m)} [${m.master}]`, ...m.rows.map(r => `${r.line} [${r.button}]`), ...(m.seed !== undefined ? [m.seed] : [])].join('\n')
