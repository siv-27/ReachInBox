import React, { type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={inputId} className="text-sm font-bold text-[#292524]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-[#A8A29E] pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full py-2.5 bg-[#FFFFFF] border rounded-lg text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C] transition-colors disabled:opacity-50 disabled:bg-gray-50 ${
            leftIcon ? 'pl-10 pr-4' : 'px-4'
          } ${error ? 'border-[#B91C1C]' : 'border-[#D6CEC5]'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs font-semibold text-[#B91C1C]">{error}</p>}
    </div>
  );
};
