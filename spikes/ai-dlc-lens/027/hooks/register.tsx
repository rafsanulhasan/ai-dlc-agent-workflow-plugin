// ITEM-027 spike (a) — throwaway. Not plugin source; discarded after the human's check.
// Sections: 1 resize/dock, 2 Svg blink, 3 buttons, 4 transcript cards, 5 gate alert.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'lens-spike-027'

const tick = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'tick' } as const, false)
const paneExpanded = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'paneExpanded' } as const, false)
const panePresses = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'panePresses' } as const, 0)
const rowPresses = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'rowPresses' } as const, {})
const rowExpanded = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'rowExpanded' } as const, {})
const forceMode = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'forceMode' } as const, 'auto')

// Tools whose rows get a card (check 4). `Task` kept for older builds.
const CARD_TOOLS = new Set(['Agent', 'Task', 'SendMessage'])

// Module-local logs (reset on reload; shown in the pane).
type Redraw = { n: number; body: number; cols: number | undefined; placement: string; fs: string; mode: string }
const redraws: Redraw[] = []
let redrawCount = 0
let toolResultHooks = 0
let toolUseCards = 0
let stopEvents = 0

const svgDot = (fill: string, animated: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<circle cx="12" cy="12" r="9" fill="${fill}">` +
  (animated
    ? `<animate attributeName="opacity" values="1;0.15;1" dur="1s" repeatCount="indefinite"/>`
    : '') +
  `</circle></svg>`

const gateFile = (root: string) => `${root}/GATE-ALERT.txt`

async function gateIsOn($: { fs: { exists: (p: string) => Promise<boolean>; read: any }; plugin: { root: string } }) {
  const path = gateFile($.plugin.root)
  if (!(await $.fs.exists(path))) return false
  const text = String(await $.fs.read(path))
  return text.trim() === 'on'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'spike027', description: 'ITEM-027 spike: open the lens spike pane' })
    await $.command.register({ name: 'spike027-gate', description: 'ITEM-027 spike: gate alert on|off', argumentHint: 'on|off' })
    // Timer-driven blink (check 2, fallback path): flips a state value twice a second.
    $.clock.every(500, () => update($, tick, t => !t))
    return next(e)
  })

  on('command.run', { command: 'spike027' }, async $ => {
    const placed = await $.ui.open({ id: PANE, title: 'Lens spike 027' })
    return { text: `Lens spike pane opened (isPlaced: ${JSON.stringify(placed)}).` }
  })

  on('command.run', { command: 'spike027-gate' }, async ($, e) => {
    const want = e.args.trim() === 'on' ? 'on' : 'off'
    await $.fs.write(gateFile($.plugin.root), want + '\n')
    return { text: `Gate alert marker set to "${want}" at ${gateFile($.plugin.root)}.` }
  })

  // ---- Pane: sections 1, 2, 3 ----
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Svg } = $.ui.resolve(e) as any
    const body = e.props.bodyColumns
    const placement = e.props.placement
    const fs = e.viewport?.isFullscreen === undefined ? 'absent' : String(e.viewport.isFullscreen)
    const forced = await read($, forceMode)
    const auto = placement === 'dock' ? 'flowchart' : 'compact'
    const mode = forced === 'auto' ? auto : forced

    redrawCount += 1
    redraws.push({ n: redrawCount, body, cols: e.viewport?.columns, placement, fs, mode })
    if (redraws.length > 8) redraws.shift()

    const on1 = await read($, tick)
    const expanded = await read($, paneExpanded)
    const presses = await read($, panePresses)
    const hasSvg = e.surface !== 'terminal'

    return (
      <Box flexDirection="column">
        <Text bold>[1] Resize across the dock boundary</Text>
        <Text>
          surface={e.surface} placement={placement} bodyColumns={body} viewport.columns={String(e.viewport?.columns)} isFullscreen={fs}
        </Text>
        <Text>
          mode={mode} (auto would be {auto}; override={forced})
        </Text>
        {mode === 'flowchart' ? (
          <Text>FLOWCHART  [PO] -&gt; [RA] -&gt; [SA]+[SE] -&gt; [SWE] -&gt; [SQA] -&gt; [CR]</Text>
        ) : (
          <Text>COMPACT  PO RA SA SE SWE SQA CR  (stage 3/7)</Text>
        )}
        <Box flexDirection="row">
          <Button key="mode-auto" label="auto" onPress={() => update($, forceMode, () => 'auto')} />
          <Button key="mode-compact" label="compact" onPress={() => update($, forceMode, () => 'compact')} />
          <Button key="mode-flow" label="flowchart" onPress={() => update($, forceMode, () => 'flowchart')} />
        </Box>
        <Text dimColor>redraw log (last 8):</Text>
        {redraws.map(r => (
          <Text dimColor>
            #{r.n} body={r.body} cols={String(r.cols)} {r.placement} fs={r.fs} -&gt; {r.mode}
          </Text>
        ))}

        <Text bold>[2] Svg animation</Text>
        {hasSvg ? (
          <Box flexDirection="row">
            <Text>A SMIL:</Text>
            <Svg source={svgDot('#2e7d32', true)} alt="SMIL blinking green dot" width={24} height={24} isInteractive={true} />
            <Text> B timer:</Text>
            <Svg source={svgDot(on1 ? '#2e7d32' : '#cfd8dc', false)} alt="timer blinking green dot" width={24} height={24} />
            <Text> C steady:</Text>
            <Svg source={svgDot('#2e7d32', false)} alt="steady green dot" width={24} height={24} />
          </Box>
        ) : (
          <Text dimColor>(terminal: no Svg element; text fallback below)</Text>
        )}
        <Text>
          D text timer: <Text color={on1 ? 'green' : 'gray'}>{on1 ? '●' : '○'}</Text>  tick={String(on1)}
        </Text>

        <Text bold>[3] Buttons (pane)</Text>
        <Box flexDirection="row">
          <Button
            key="pane-expand"
            label={expanded ? '[-]' : '[+]'}
            onPress={async () => {
              await update($, paneExpanded, x => !x)
              await update($, panePresses, n => n + 1)
            }}
          />
          <Text> presses={presses}</Text>
        </Box>
        {expanded && <Text>expanded content: the pane button works</Text>}

        <Text bold>[4] Transcript cards</Text>
        <Text>ToolUse cards drawn={toolUseCards}  ToolResult hooks passed through={toolResultHooks}</Text>
        <Text bold>[5] Gate alert</Text>
        <Text>classic.Stop seen by module={stopEvents}  (toggle: /spike027-gate on|off)</Text>
      </Box>
    )
  })

  // ---- Section 4: transcript card at ToolUse, native row nested; ToolResult left alone ----
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!CARD_TOOLS.has(String(e.props.tool))) return next(e)
    const native = await next(e)
    const { Box, Text, Button } = $.ui.resolve(e) as any
    const id = e.props.tool_use_id
    const counts = (await read($, rowPresses)) as Record<string, number>
    const opens = (await read($, rowExpanded)) as Record<string, boolean>
    const isOpen = opens[id] === true
    const input = (e.props.input ?? {}) as Record<string, unknown>
    const who = String(input.subagent_type ?? input.to ?? input.name ?? '?')
    const what = String(input.description ?? input.summary ?? '').slice(0, 80)
    toolUseCards += 1

    return (
      <Box flexDirection="column" borderStyle="round">
        <Box flexDirection="row">
          <Text bold>LENS CARD </Text>
          <Text>
            {e.props.tool} -&gt; {who} {e.props.isRunning ? '(running)' : '(done)'}{' '}
          </Text>
          <Button
            key={`row-${id}`}
            label={isOpen ? '[-]' : '[+]'}
            onPress={async () => {
              await update($, rowExpanded, m => ({ ...(m as Record<string, boolean>), [id]: !(m as Record<string, boolean>)[id] }))
              await update($, rowPresses, m => ({ ...(m as Record<string, number>), [id]: ((m as Record<string, number>)[id] ?? 0) + 1 }))
            }}
          />
          <Text> presses={counts[id] ?? 0}</Text>
        </Box>
        {what !== '' && <Text dimColor>{what}</Text>}
        {isOpen && <Text dimColor>input keys: {Object.keys(input).join(', ')}</Text>}
        {native}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (CARD_TOOLS.has(String(e.props.tool))) toolResultHooks += 1
    return next(e)
  })

  // ---- Section 5b: the same alert from the module (toast), for comparison ----
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    stopEvents += 1
    if (await gateIsOn($ as any)) $.ui.toast('ai-dlc-lens spike: gate alert test (5b, module toast on classic.Stop)')
    return result
  }).catch(($, e, next) => next(e))
}

