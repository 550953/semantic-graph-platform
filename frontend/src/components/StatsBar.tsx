export default function StatsBar({ nodes, edges, tab }: { nodes: any[]; edges: any[]; tab: string }) {
  const byLayer: Record<string, number> = {}
  nodes.forEach(n => {
    const L = n.layer || '—'
    byLayer[L] = (byLayer[L] || 0) + 1
  })
  return (
    <div className="stats-bar">
      <div className="stat"><b>{nodes.length}</b><span>узлов · {tab}</span></div>
      <div className="stat"><b>{edges.length}</b><span>связей</span></div>
      {Object.entries(byLayer).map(([k, v]) => (
        <div className="stat" key={k}><b>{v}</b><span>{k}</span></div>
      ))}
    </div>
  )
}
