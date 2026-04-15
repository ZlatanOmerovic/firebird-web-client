import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked, indeterminate, onChange, className }: CheckboxProps) {
  const isActive = checked || indeterminate;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
        isActive
          ? 'bg-accent border-accent text-white'
          : 'border-border hover:border-accent/50 bg-bg-primary'
      } ${className ?? ''}`}
    >
      {indeterminate ? (
        <Minus className="w-2.5 h-2.5" strokeWidth={3} />
      ) : checked ? (
        <Check className="w-2.5 h-2.5" strokeWidth={3} />
      ) : null}
    </button>
  );
}
