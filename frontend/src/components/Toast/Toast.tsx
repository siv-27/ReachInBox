import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-md border text-sm transition-all duration-300 flex items-center gap-3 max-w-md ${
        type === 'success'
          ? 'bg-[#FFF7ED] border-[#7A8450] text-[#7A8450]'
          : 'bg-[#FFF7ED] border-[#B91C1C] text-[#B91C1C]'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 text-[#7A8450]" />
      ) : (
        <AlertCircle className="w-5 h-5 shrink-0 text-[#B91C1C]" />
      )}
      <span className="font-medium text-[#292524]">{message}</span>
      <button
        onClick={onClose}
        className="ml-auto text-[#78716C] hover:text-[#292524] p-1 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
