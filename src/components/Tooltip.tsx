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
  useMergeRefs,
  safePolygon,
} from '@floating-ui/react';

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
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
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
            className={`z-[9999] px-2.5 py-1.5 text-xs bg-text-header text-text-on-color rounded-md max-w-[200px] break-words ${className}`}
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
