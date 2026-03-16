export default function ApprovalBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  if (count <= 0) return null

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-pastel-yellow/80 text-accent-yellow ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-semibold`}>
      <span>🔒</span>
      <span>{count}</span>
    </span>
  )
}
