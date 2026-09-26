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
  useMergeRefs,
  safePolygon,
} from '@floating-ui/react';

/**
 * ⭐ THE ONE TOOLTIP STYLE — canvas visual contract v3.1 (DESIGN-GAP-v31 row 36):
 *   `.tooltip{max-width:300px;background:#303A3A;color:#FEFEFE;border-radius:7px;
 *            padding:9px 11px;font-size:12px;line-height:1.45;
 *            box-shadow:0 5px 14px #20202024}`
 * Served, this component drew `#262626`, radius 12px, max-width 200px with an
 * arrow, while card names carried a native `title` — two tooltip systems. The
 * surface is exported so every hand-rolled tooltip (the connection hover in
 * `StyledEdge`) wears the SAME classes rather than a copy of them.
 */
export const TOOLTIP_SURFACE_CLASS =
  'max-w-[300px] bg-[#303A3A] text-[#FEFEFE] rounded-[7px] px-[11px] py-[9px] text-[12px] leading-[1.45] shadow-[0_5px_14px_#20202024] break-words font-sans'

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  /** Hover delay in ms before showing (default: 0, DS v5 recommends 300) */
  delay?: number;
  /** Attach positioning and accessibility to the control itself, without a layout wrapper. */
  asChild?: boolean;
}

export default function Tooltip({ children, content, className = '', delay, asChild = false }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    x,
    y,
    strategy,
    context,
    refs,
  } = useFloating({
    placement: 'top',
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    move: false,
    delay: delay != null ? { open: delay } : undefined,
    // Keep a node-action explanation readable while the pointer crosses the
    // gap onto it. Existing wrapped tooltip consumers retain their behaviour.
    handleClose: asChild ? safePolygon() : undefined,
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  const child = asChild ? React.Children.only(children) as React.ReactElement : null;
  const referenceRef = useMergeRefs([
    refs.setReference,
    (child as (React.ReactElement & { ref?: React.Ref<HTMLElement> }) | null)?.ref,
  ]);

  // Nothing to say, no tooltip: render the child untouched rather than an
  // empty dark box on hover (after EVERY hook, so hook order is stable). The
  // non-`asChild` form keeps its wrapper `div`, so the caller's layout does not
  // change with the content.
  if (content == null || content === '') return asChild ? <>{children}</> : <div>{children}</div>;

  return (
    <>
      {child ? React.cloneElement(child, {
        ...getReferenceProps({
          ...child.props,
          onClick: (event: React.MouseEvent) => {
            setIsOpen(false);
            child.props.onClick?.(event);
          },
        }),
        ref: referenceRef,
        // An empty title blocks native tooltips inherited from an ancestor
        // (for example an external factor's "Outside your control" label).
        title: '',
      }) : (
        <div ref={refs.setReference} {...getReferenceProps()}>
          {children}
        </div>
      )}
      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            // v3.1: the contract's `.tooltip` has no arrow; it sits 8px off
            // its target, which `offset(8)` above already does.
            className={`z-[9999] ${TOOLTIP_SURFACE_CLASS} ${className}`}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
            }}
            {...getFloatingProps()}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
