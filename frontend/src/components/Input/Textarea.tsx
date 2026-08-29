import React, { type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className = '',
  id,
  rows = 5,
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-bold text-[#292524]">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={`w-full px-4 py-2.5 bg-[#FFFFFF] border rounded-lg text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C] transition-colors resize-none disabled:opacity-50 ${
          error ? 'border-[#B91C1C]' : 'border-[#D6CEC5]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-semibold text-[#B91C1C]">{error}</p>}
    </div>
  );
};
