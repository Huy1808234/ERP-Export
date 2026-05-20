'use client';

import { CSSProperties, ReactElement, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

type SafeResponsiveContainerProps = {
  children: ReactElement;
  height: number;
  className?: string;
  style?: CSSProperties;
};

export function SafeResponsiveContainer({
  children,
  height,
  className,
  style,
}: SafeResponsiveContainerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const nextWidth = Math.floor(rect.width);
      const nextHeight = Math.floor(rect.height || height);

      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height]);

  const isReady = size.width > 1 && size.height > 1;

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ width: '100%', minWidth: 1, height, minHeight: height, ...style }}
    >
      {isReady ? (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={1} minHeight={height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
