import React from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
} from '@floating-ui/react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  /** Hover delay in ms before showing (default: 0, DS v5 recommends 300) */
  delay?: number;
  /**
   * Classes for the REFERENCE wrapper (the element that hosts `children`), not
   * the floating bubble — `className` above is the bubble's.
   *
   * ⚠ WHY THIS EXISTS. The wrapper is a plain `<div>`, i.e. block-level. That is
   * invisible in the panel and drawer layouts this component grew up in, but a
   * canvas NODE icon sits inside an `inline-flex` row of sibling glyphs, where a
   * bare block wrapper drops `shrink-0` and the row's baseline alignment. Node
   * adopters pass `inline-flex shrink-0` here.
   *
   * Defaults to `undefined`, NOT `''`, so every existing call site renders the
   * wrapper with no `class` attribute exactly as before — this prop is additive
   * and cannot change the 38 production files importing this component (counted
   * by resolving every `*Tooltip` import path against this module, because the
   * repo has a same-named twin at `canvas/components/Tooltip` with 19 importers
   * of its own and a suffix grep cannot tell the two apart).
   */
  wrapperClassName?: string;
}

export default function Tooltip({ children, content, className = '', delay, wrapperClassName }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const arrowRef = React.useRef(null);

  const {
    x,
    y,
    strategy,
    context,
    placement,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} },
    refs,
  } = useFloating({
    placement: 'top',
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip(),
      shift(),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, delay: delay != null ? { open: delay } : undefined });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <div ref={refs.setReference} className={wrapperClassName} {...getReferenceProps()}>
        {children}
      </div>
      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            className={`z-[9999] px-2.5 py-1.5 text-xs bg-text-header text-text-on-color rounded-md max-w-[200px] ${className}`}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
            }}
            {...getFloatingProps()}
          >
            {content}
            <div
              ref={arrowRef}
              className="absolute w-2 h-2 bg-text-header rotate-45"
              style={{
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                [placement.includes('top') ? 'bottom' : 'top']: '-4px',
              }}
            />
          </div>
        )}
      </FloatingPortal>
    </>
  );
}