import React, { useState } from 'react';
import type { Node as SandboxNode } from '../../types/sandbox';
// @ts-ignore
import { motion, AnimatePresence } from 'framer-motion';

interface RadialAddMenuProps {
  node: SandboxNode;
  addNode: (node: Partial<SandboxNode>) => SandboxNode;
  addEdge: (edge: { source: string; target: string; sourceHandle?: 'left' | 'right' | 'bottom' | 'top'; targetHandle?: 'left' | 'right' | 'bottom' | 'top' }) => void;
}

const NODE_TYPES = [
  {
    key: 'problem',
    icon: '🧩',
    label: 'Problem',
    tooltip: 'Define a problem or challenge to solve',
    color: 'bg-blue-600',
    ring: 'ring-blue-300',
  },
  {
    key: 'option',
    icon: '💡',
    label: 'Option',
    tooltip: 'Propose a possible solution or path',
    color: 'bg-green-500',
    ring: 'ring-green-300',
  },
  {
    key: 'objection',
    icon: '⚠️',
    label: 'Objection',
    tooltip: 'Raise a concern or blocker',
    color: 'bg-orange-400',
    ring: 'ring-orange-200',
  },
  {
    key: 'evidence',
    icon: '📄',
    label: 'Evidence',
    tooltip: 'Add supporting info or fact',
    color: 'bg-gray-500',
    ring: 'ring-gray-300',
  },
];

export const RadialAddMenu: React.FC<RadialAddMenuProps> = ({ node, addNode, addEdge }) => {
  console.log('[DEBUG] RadialAddMenu rendered', node);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  if (!node) return null;

  // --- Positioning logic ---
  // Menu direction is currently fixed as 'right' (can be extended in future)
  const menuRadius = 72; // px, distance from node center to menu center
  const iconRadius = 32; // px, radius of each icon button
  const menuDiameter = menuRadius * 2 + iconRadius * 2;
  // Default menu position: right of node, vertically centered
  let menuLeft = node.x + (node.width || 220) + 24; // 24px gap from node edge
  let menuTop = node.y + ((node.height || 120) / 2) - menuRadius;
  // Edge detection: if too close to right edge, flip to left
  if (typeof window !== 'undefined') {
    const canvasWidth = window.innerWidth; // fallback, ideally get actual canvas size
    if (menuLeft + menuDiameter > canvasWidth - 24) {
      menuLeft = node.x - menuDiameter - 24;
    }
    // If too close to top/bottom, clamp
    const canvasHeight = window.innerHeight;
    if (menuTop < 24) menuTop = 24;
    if (menuTop + menuDiameter > canvasHeight - 24) menuTop = canvasHeight - menuDiameter - 24;
  }
  const style: React.CSSProperties = {
    position: 'absolute',
    left: menuLeft,
    top: menuTop,
    zIndex: 10000,
    pointerEvents: 'auto',
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '50%',
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)',
    width: menuDiameter,
    height: menuDiameter,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.25s cubic-bezier(.4,0,.2,1), background 0.2s',
  };

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32, duration: 0.2 }}
    >
      {NODE_TYPES.map((type, i) => {
        const isActive = hovered === type.key || focused === type.key;
        // Calculate circular positions
        const angle = (i / NODE_TYPES.length) * 2 * Math.PI - Math.PI / 2;
        const iconX = menuRadius * Math.cos(angle);
        const iconY = menuRadius * Math.sin(angle);
        const buttonStyle: React.CSSProperties = {
          position: 'absolute',
          left: `calc(50% + ${iconX}px - ${iconRadius}px)`,
          top: `calc(50% + ${iconY}px - ${iconRadius}px)`,
          width: iconRadius * 2,
          height: iconRadius * 2,
          zIndex: 2,
          boxShadow: '0 4px 16px 0 rgba(0,0,0,0.14)',
          transition: 'box-shadow 0.18s, transform 0.18s',
          outline: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: undefined, // use class
        };
        const className = `flex flex-col items-center justify-center ${type.color} rounded-full shadow-lg transition-all duration-200 focus:outline-none
          ${isActive ? `${type.ring} ring-4 scale-110` : 'ring-0 scale-100'}
          hover:scale-110 hover:shadow-2xl hover:ring-4
          focus:scale-110 focus:shadow-2xl
          text-white text-2xl select-none`;
        // Tooltip positioning: above unless near top edge
        let tooltipPos = { bottom: '110%', left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties;
        if (menuTop < 60) tooltipPos = { top: '110%', left: '50%', transform: 'translateX(-50%)' };

        // Placement offsets for each type (right, left, above, below)
        // Order: 0=problem (top), 1=option (right), 2=objection (left), 3=evidence (bottom)
        const offsetMap = {
          'problem': { dx: 0, dy: -120 },    // above
          'option': { dx: 120, dy: 0 },     // right
          'objection': { dx: -120, dy: 0 }, // left
          'evidence': { dx: 0, dy: 120 }    // below
        };
        const handleAdd = () => {
          const parent = node;
          const typeKey = type.key;
          const offset = offsetMap[typeKey as keyof typeof offsetMap] || { dx: 120, dy: 0 };
          const newX = (parent.x || 0) + (parent.width || 220) / 2 + offset.dx;
          const newY = (parent.y || 0) + (parent.height || 120) / 2 + offset.dy;
          // Map radial menu type to valid Node.type
          let nodeType: 'decision' | 'option' | 'outcome' = 'option';
          if (typeKey === 'problem') nodeType = 'decision';
          else if (typeKey === 'option') nodeType = 'option';
          else if (typeKey === 'objection' || typeKey === 'evidence') nodeType = 'outcome';
          const newNode = {
            type: nodeType,
            label: `New ${type.label}`,
            x: newX,
            y: newY,
          };

          const created = typeof addNode === 'function' ? addNode(newNode) : null;
          if (created && created.id) {
            // Infer handles from offset direction
            let sourceHandle: 'left' | 'right' | 'bottom' | 'top' = 'right';
            let targetHandle: 'left' | 'right' | 'bottom' | 'top' = 'left';
            if (offset.dx > 0) { sourceHandle = 'right'; targetHandle = 'left'; }
            else if (offset.dx < 0) { sourceHandle = 'left'; targetHandle = 'right'; }
            else if (offset.dy > 0) { sourceHandle = 'bottom'; targetHandle = 'top'; }
            else if (offset.dy < 0) { sourceHandle = 'top'; targetHandle = 'bottom'; }
            addEdge({ source: parent.id, target: created.id, sourceHandle, targetHandle });
          }
        };

        return (
          <button
            key={type.key}
            type="button"
            tabIndex={0}
            aria-label={type.tooltip}
            className={className}
            style={buttonStyle}
            onClick={handleAdd}
            onMouseEnter={() => setHovered(type.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setFocused(type.key)}
            onBlur={() => setFocused(null)}
          >
            <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1 }}>{type.icon}</span>
            {/* Tooltip */}
            {(isActive) && (
              <div
                className="absolute px-2 py-1 rounded bg-black bg-opacity-90 text-xs text-white whitespace-nowrap shadow-lg"
                style={{ ...tooltipPos, zIndex: 10, pointerEvents: 'none', minWidth: 80 }}
                role="tooltip"
              >
                {type.tooltip}
              </div>
            )}
          </button>
        );
      })}
    </motion.div>
  );
};

export default RadialAddMenu;
