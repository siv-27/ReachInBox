import React, { type ReactNode } from 'react';
import { Sidebar, type TabType } from '../components/Sidebar/Sidebar';
import { Header } from '../components/Header/Header';
import { Toast } from '../components/Toast/Toast';
import { ComposeModal } from '../components/Modal/ComposeModal';

export interface DashboardLayoutProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  composeOpen: boolean;
  onCloseCompose: () => void;
  onComposeSuccess: () => void;
  toast: { type: 'success' | 'error'; message: string } | null;
  onCloseToast: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  onSelectTab,
  composeOpen,
  onCloseCompose,
  onComposeSuccess,
  toast,
  onCloseToast,
  showToast,
  children,
}) => {
  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'overview':
        return 'Dashboard Overview';
      case 'scheduled':
        return 'Scheduled Outreach Emails';
      case 'sent':
        return 'Sent Email Logs & Search';
      case 'queue':
        return 'BullMQ Live Queue Monitor';
      case 'integrations':
        return 'Integrations & Slack OAuth';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7ED] flex flex-col md:flex-row text-[#292524] font-sans">
      {/* Toast Alert */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={onCloseToast} />}

      {/* Sidebar Panel */}
      <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Panel */}
        <Header title={getTabTitle(activeTab)} />

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={onCloseCompose}
        onSuccess={onComposeSuccess}
        showToast={showToast}
      />
    </div>
  );
};
