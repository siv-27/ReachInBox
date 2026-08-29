import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<LoaderProps> = ({ text = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="py-12 flex flex-col items-center justify-center text-sm text-[#78716C] gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-[#C2410C]`} />
      {text && <span>{text}</span>}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-[#FFEDD5]/40 rounded-md w-full" />
      ))}
    </div>
  );
};
