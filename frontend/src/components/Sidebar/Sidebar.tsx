import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Send,
  Activity,
  Share2,
  LogOut,
  SendHorizontal,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export type TabType = 'overview' | 'scheduled' | 'sent' | 'queue' | 'integrations';

export interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { logout } = useAuth();

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'scheduled', label: 'Scheduled Emails', icon: <Calendar className="w-5 h-5" /> },
    { id: 'sent', label: 'Sent Emails', icon: <Send className="w-5 h-5" /> },
    { id: 'queue', label: 'Queue Monitor', icon: <Activity className="w-5 h-5" /> },
    { id: 'integrations', label: 'Integrations', icon: <Share2 className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#FFFFFF] border-b md:border-b-0 md:border-r border-[#E7E0D8] flex flex-col justify-between shrink-0">
      <div>
        {/* Logo Brand Header */}
        <div className="py-6 px-6 border-b border-[#EEE7DF] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FFEDD5] flex items-center justify-center border border-[#FFEDD5]">
            <SendHorizontal className="w-5 h-5 text-[#C2410C]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#292524]">
            Reach<span className="text-[#C2410C]">Inbox</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5 text-left">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full py-2.5 px-4 rounded-md text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                activeTab === item.id
                  ? 'bg-[#FFEDD5] text-[#C2410C]'
                  : 'text-[#78716C] hover:bg-[#FFF7ED] hover:text-[#C2410C]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Logout Action */}
      <div className="p-4 border-t border-[#EEE7DF]">
        <button
          onClick={logout}
          className="w-full py-2 px-4 border border-[#E7E0D8] text-sm font-semibold rounded-md text-[#292524] bg-[#FFFFFF] hover:bg-[#FFF7ED] transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4 text-[#78716C]" />
          Logout
        </button>
      </div>
    </aside>
  );
};
