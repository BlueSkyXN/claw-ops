import type { PresetLayer } from '../types/presets'
import { getRoleLayerLabel, getRoleLayerTone } from '../lib/orchestration'

export default function AgentLayerBadge({ layer }: { layer: PresetLayer }) {
  const tone = getRoleLayerTone(layer)
  return (
    <span className={`badge text-[10px] ${tone.badge}`}>
      {layer} · {getRoleLayerLabel(layer)}
    </span>
  )
}
