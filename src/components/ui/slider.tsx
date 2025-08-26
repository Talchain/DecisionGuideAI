import * as React from 'react';

interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(value[0]);

  React.useEffect(() => {
    setInternalValue(value[0]);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setInternalValue(newValue);
    onValueChange([newValue]);
  };

  return (
    <div className={`relative w-full ${className}`} {...props}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={internalValue}
        onChange={handleChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
