import React, { type ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-[#FFFFFF] border border-[#E7E0D8] rounded-xl p-6 text-left shadow-sm ${className}`}
    >
      {children}
    </div>
  );
};
