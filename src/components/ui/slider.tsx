import React, { useState, useRef, useCallback } from 'react';

interface SliderProps {
  value?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  max?: number;
  min?: number;
  step?: number;
  className?: string;
  thumbClassName?: string;
  minStepsBetweenThumbs?: number;
  [key: string]: any;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value = [0, 100],
      onValueChange,
      max = 100,
      min = 0,
      step = 1,
      className = '',
      thumbClassName = '',
      minStepsBetweenThumbs = 0,
      ...props
    },
    ref,
  ) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<number | null>(null);

    const getValueFromPosition = useCallback(
      (clientX: number) => {
        if (!trackRef.current) {
          return min;
        }

        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawValue = min + percentage * (max - min);
        return Math.round(rawValue / step) * step;
      },
      [min, max, step],
    );

    const handleMouseDown = (thumbIndex: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(thumbIndex);
    };

    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (isDragging === null) {
          return;
        }

        const newValue = getValueFromPosition(e.clientX);
        const newValues: [number, number] = [...value];

        if (isDragging === 0) {
          // Left thumb
          const maxValue = value[1] - minStepsBetweenThumbs;
          newValues[0] = Math.min(newValue, maxValue);
        } else {
          // Right thumb
          const minValue = value[0] + minStepsBetweenThumbs;
          newValues[1] = Math.max(newValue, minValue);
        }

        onValueChange?.(newValues);
      },
      [isDragging, value, getValueFromPosition, minStepsBetweenThumbs, onValueChange],
    );

    const handleMouseUp = useCallback(() => {
      setIsDragging(null);
    }, []);

    React.useEffect(() => {
      if (isDragging !== null) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const getThumbPosition = (val: number) => {
      return ((val - min) / (max - min)) * 100;
    };

    return (
      <div
        className={`relative flex w-full touch-none select-none items-center ${className}`}
        ref={ref}
        {...props}
      >
        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200 cursor-pointer"
          onClick={(e) => {
            if (isDragging !== null) {
              return;
            }
            const newValue = getValueFromPosition(e.clientX);
            const distanceToFirst = Math.abs(newValue - value[0]);
            const distanceToSecond = Math.abs(newValue - value[1]);
            const closestThumb = distanceToFirst <= distanceToSecond ? 0 : 1;

            const newValues: [number, number] = [...value];
            if (closestThumb === 0) {
              const maxValue = value[1] - minStepsBetweenThumbs;
              newValues[0] = Math.min(newValue, maxValue);
            } else {
              const minValue = value[0] + minStepsBetweenThumbs;
              newValues[1] = Math.max(newValue, minValue);
            }
            onValueChange?.(newValues);
          }}
        >
          {/* Range */}
          <div
            className="absolute h-full bg-slate-900 rounded-full"
            style={{
              left: `${getThumbPosition(value[0])}%`,
              width: `${getThumbPosition(value[1]) - getThumbPosition(value[0])}%`,
            }}
          />
        </div>

        {/* First Thumb */}
        <div
          className={`absolute block h-5 w-5 rounded-full border-2 border-slate-900 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform ${thumbClassName}`}
          style={{ left: `${getThumbPosition(value[0])}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown(0)}
        />

        {/* Second Thumb */}
        <div
          className={`absolute block h-5 w-5 rounded-full border-2 border-slate-900 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform ${thumbClassName}`}
          style={{ left: `${getThumbPosition(value[1])}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown(1)}
        />
      </div>
    );
  },
);

Slider.displayName = 'Slider';
