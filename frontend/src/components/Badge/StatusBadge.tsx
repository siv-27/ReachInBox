import React from 'react';

export type StatusType = 'SENT' | 'SCHEDULED' | 'PROCESSING' | 'FAILED' | string;

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = (st: string) => {
    switch (st.toUpperCase()) {
      case 'SENT':
        return 'bg-[#FFF7ED] text-[#7A8450] border border-[#7A8450]/20';
      case 'SCHEDULED':
        return 'bg-[#FFEDD5] text-[#D97706] border border-[#D97706]/20';
      case 'PROCESSING':
      case 'ACTIVE':
        return 'bg-[#FFEDD5]/50 text-[#EA580C] border border-[#EA580C]/20';
      case 'FAILED':
        return 'bg-red-50 text-[#B91C1C] border border-[#B91C1C]/20';
      default:
        return 'bg-gray-100 text-[#78716C]';
    }
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeStyle(
        status
      )} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status.toUpperCase() === 'SENT'
            ? 'bg-[#7A8450]'
            : status.toUpperCase() === 'SCHEDULED'
            ? 'bg-[#D97706]'
            : status.toUpperCase() === 'FAILED'
            ? 'bg-[#B91C1C]'
            : 'bg-[#EA580C]'
        }`}
      />
      {status}
    </span>
  );
};
