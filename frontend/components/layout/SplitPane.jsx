import React from 'react';

export function SplitPane({
  left,
  right,
  leftWidth = 'w-64',
  className = '',
}) {
  return (
    <div className={`flex flex-1 h-full overflow-hidden ${className}`}>
      {left && (
        <div className={`${leftWidth} flex-shrink-0 border-r border-border bg-canvas-subtle overflow-y-auto`}>
          {left}
        </div>
      )}
      {right && (
        <div className="flex-1 flex flex-col bg-canvas-base overflow-y-auto">
          {right}
        </div>
      )}
    </div>
  );
}

export function PanelGroup({
  children,
  direction = 'horizontal', // 'horizontal' | 'vertical'
  className = '',
}) {
  const isHoriz = direction === 'horizontal';
  return (
    <div className={`flex ${isHoriz ? 'flex-row' : 'flex-col'} gap-4 w-full h-full ${className}`}>
      {children}
    </div>
  );
}

export default SplitPane;
