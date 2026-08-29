import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-[#FFFFFF] border-b border-[#E7E0D8] px-8 flex justify-between items-center shrink-0">
      <h2 className="text-lg font-bold text-[#292524] capitalize">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-[#292524] leading-tight">{user?.name || 'User'}</p>
          <p className="text-xs text-[#78716C]">{user?.email || 'user@example.com'}</p>
        </div>
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full border border-[#E7E0D8] object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#C2410C] flex items-center justify-center text-[#FFFFFF] font-bold shadow-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
        )}
      </div>
    </header>
  );
};
