// Keep-alive's band (AbovePrompt, Terminal and Desktop) and Pane (VS Code): one tree, two hosts, so
// their rows cannot differ (LLD rev 7, section 13; rev 11, 20.6). This file only draws, like
// ../auto-handoff/panel.tsx: keepalive.ts holds the state and the presses, since the host never follows
// $ across an import.
import type { BandModel, Ttl } from './cache-state.ts'

// The elements come from $.ui.resolve in the render hook.
type Elements = { Box: any; Text: any; Button: any }

/** The title row (bold title and the master button), the 5m row, the 1h row, each its full line and its
 * button, then the seed row while the seed line shows (no button). No margin or padding; gap 0. */
export function keepaliveTree({ Box, Text, Button }: Elements, m: BandModel, onPress: (t: Ttl) => void, onMaster: () => void) {
  return (
    <Box flexDirection="column" gap={0}>
      <Box flexDirection="row" gap={0}>
        <Text bold>{m.title} </Text>
        <Button key="ka-master" label={m.master} onPress={onMaster} />
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

/** The band as plain text, one row per line, for tests and logs. */
export const bandText = (m: BandModel): string =>
  [`${m.title} [${m.master}]`, ...m.rows.map(r => `${r.line} [${r.button}]`), ...(m.seed !== undefined ? [m.seed] : [])].join('\n')
