import React from 'react';

export interface MetricCardProps {
  label: string;
  value: number | string;
  textColor?: string;
  bgDotColor?: string;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  textColor = 'text-[#292524]',
  bgDotColor = 'bg-[#C2410C]',
  className = '',
  onClick,
  isSelected = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#FFFFFF] border p-5 rounded-xl text-left transition-all duration-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-[#FFEDD5] border-[#C2410C] shadow-sm'
          : 'border-[#E7E0D8] hover:border-[#D6CEC5] hover:bg-[#FFFCF8]'
      } ${className}`}
    >
      <p className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline justify-between mt-2">
        <span className={`text-3xl font-extrabold ${textColor}`}>{value}</span>
        <span className={`w-3 h-3 rounded-full ${bgDotColor}`} />
      </div>
    </div>
  );
};
