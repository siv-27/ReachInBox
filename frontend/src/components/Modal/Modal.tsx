import React, { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  errorMessage?: string | null;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  errorMessage,
}) => {
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMessage && formRef.current) {
      formRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [errorMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#292524]/40 flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E7E0D8] w-full max-w-2xl rounded-xl shadow-md flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#EEE7DF] flex justify-between items-center text-left">
          <h3 className="font-bold text-lg text-[#292524]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#A8A29E] hover:text-[#78716C] cursor-pointer p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Container */}
        <div ref={formRef} className="p-6 overflow-y-auto space-y-5 text-left flex-1">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-[#B91C1C] p-4 rounded-lg text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B91C1C] inline-block shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
