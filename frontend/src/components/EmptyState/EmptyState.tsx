import React, { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../Button/Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div className="py-12 px-4 text-center border border-dashed border-[#E7E0D8] rounded-xl bg-[#FFFFFF] space-y-4">
      <div className="w-12 h-12 rounded-full bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-center mx-auto text-[#C2410C]">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-[#292524]">{title}</h4>
        <p className="text-xs text-[#78716C] max-w-sm mx-auto">{description}</p>
      </div>
      {actionText && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
