export const colors = {
  primary: '#C2410C', // Burnt Orange
  primaryHover: '#9A3412',
  primaryLight: '#FFEDD5', // Selected Nav / Light Orange Accent
  accent: '#D97706',

  background: '#FFF7ED', // Warm Cream Page Background
  surface: '#FFFFFF', // Card / Sidebar Surface
  inputBg: '#FFFCF8', // Soft Input Background

  border: '#E7E0D8',
  borderSubtle: '#EEE7DF',
  borderFocus: '#C2410C',

  textPrimary: '#292524',
  textSecondary: '#78716C',
  textMuted: '#A8A29E',

  status: {
    SENT: '#7A8450',
    SCHEDULED: '#D97706',
    PROCESSING: '#EA580C',
    FAILED: '#B91C1C',
  },
} as const;

export const statusColors: Record<string, { bg: string; text: string }> = {
  SENT: { bg: 'bg-[#FFF7ED]', text: 'text-[#7A8450]' },
  SCHEDULED: { bg: 'bg-[#FFEDD5]', text: 'text-[#D97706]' },
  PROCESSING: { bg: 'bg-[#FFEDD5]/50', text: 'text-[#EA580C]' },
  FAILED: { bg: 'bg-red-50', text: 'text-[#B91C1C]' },
};
