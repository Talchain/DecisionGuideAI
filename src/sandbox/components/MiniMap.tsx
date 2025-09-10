import { useBoardState } from '../state/boardState';
import { useFlags } from '@/lib/flags';

export function MiniMap() {
  const flags = useFlags()
  if (!flags.sandbox) return null;
  const { board } = useBoardState();
  if (!board) return null;

  // Calculate bounds
  const minX = Math.min(...board.nodes.map(n => n.x), 0);
  const minY = Math.min(...board.nodes.map(n => n.y), 0);
  const maxX = Math.max(...board.nodes.map(n => n.x), 100);
  const maxY = Math.max(...board.nodes.map(n => n.y), 100);

  const width = maxX - minX + 40;
  const height = maxY - minY + 40;

  return (
    <div className="fixed bottom-24 right-4 bg-white border rounded shadow p-2 z-40" style={{ width: 160, height: 120 }}>
      <svg width={160} height={120} viewBox={`0 0 ${width} ${height}`}
        style={{ background: '#f8fafc', borderRadius: 8 }}>
        {board.nodes.map(n => (
          <circle key={n.id} cx={n.x - minX + 20} cy={n.y - minY + 20} r={6} fill="#3b82f6" />
        ))}
        {board.edges.map(e => {
          const src = board.nodes.find(n => n.id === e.source);
          const tgt = board.nodes.find(n => n.id === e.target);
          if (!src || !tgt) return null;
          return <line key={e.id} x1={src.x - minX + 20} y1={src.y - minY + 20} x2={tgt.x - minX + 20} y2={tgt.y - minY + 20} stroke="#94a3b8" strokeWidth={2} />;
        })}
      </svg>
      <div className="text-xs text-center mt-1 text-gray-500">Mini-Map</div>
    </div>
  );
}
