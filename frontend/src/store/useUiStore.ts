import { create } from 'zustand';
import type {
  DashboardArchitectureSummary,
  DashboardQuickStartTemplate,
} from '@/features/dashboard/types/dashboard.types';
import type { NotificationItem } from '@/types/dashboard';

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  searchQuery: string;
  createModalOpen: boolean;
  selectedArchitecture: DashboardArchitectureSummary | null;
  selectedTemplate: DashboardQuickStartTemplate | null;
  notifications: NotificationItem[];
  toggleSidebarCollapsed: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setCreateModalOpen: (open: boolean) => void;
  setSelectedArchitecture: (arch: DashboardArchitectureSummary | null) => void;
  setSelectedTemplate: (template: DashboardQuickStartTemplate | null) => void;
  markAllNotificationsRead: () => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Phase 02 Authentication Active',
    message: 'Your session is secured with HttpOnly cookies and rotating refresh tokens.',
    timestamp: 'Just now',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Architecture Canvas (Phase 03)',
    message: 'Interactive @xyflow/react canvas editing and AWS service catalog arrive in Phase 03.',
    timestamp: 'System notice',
    read: true,
  },
];

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  searchQuery: '',
  createModalOpen: false,
  selectedArchitecture: null,
  selectedTemplate: null,
  notifications: INITIAL_NOTIFICATIONS,
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCreateModalOpen: (createModalOpen) => set({ createModalOpen }),
  setSelectedArchitecture: (selectedArchitecture) => set({ selectedArchitecture }),
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, read: true })),
    })),
}));
