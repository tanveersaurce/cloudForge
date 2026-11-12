import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/App';
import type { AuthUser } from '@/features/auth/types/auth.types';
import type { DashboardOverviewData } from '@/features/dashboard/types/dashboard.types';
import { useAuthStore } from '@/store/useAuthStore';

const mockUser: AuthUser = {
  id: 'user-1',
  name: 'Neha Verma',
  email: 'neha@cloudforge.dev',
  avatar: null,
  createdAt: '2026-11-12T06:00:00.000Z',
  updatedAt: '2026-11-12T06:00:00.000Z',
};

const mockOverview: DashboardOverviewData = {
  user: mockUser,
  metrics: {
    totalArchitectures: 0,
    savedProjects: 0,
    awsServicesExplored: {
      available: false,
      value: null,
      statusLabel: 'Unavailable until AWS Catalog (Phase 03)',
    },
    estimatedMonthlyCost: {
      available: false,
      value: null,
      statusLabel: 'Unavailable until Cost Engine (Phase 04)',
    },
  },
  recentArchitectures: [],
  quickStartTemplates: [],
  recentActivity: [],
};

const fetchDashboardOverviewMock = vi.fn(async () => mockOverview);
const logoutAccountMock = vi.fn(async () => undefined);

vi.mock('@/features/dashboard/services/dashboardService', () => ({
  fetchDashboardOverview: () => fetchDashboardOverviewMock(),
}));

vi.mock('@/features/auth/services/authService', () => ({
  registerAccount: vi.fn(async () => mockUser),
  loginAccount: vi.fn(async () => mockUser),
  logoutAccount: () => logoutAccountMock(),
  refreshAuthSession: vi.fn(async () => mockUser),
  fetchCurrentUser: vi.fn(async () => mockUser),
}));

vi.mock('@/services/healthService', () => ({
  fetchBackendHealth: vi.fn(async () => ({
    status: 'ok',
    service: 'cloudforge-api',
    version: '0.1.0',
    environment: 'test',
    uptimeSeconds: 10,
    database: { status: 'connected', latencyMs: 1.5 },
  })),
}));

describe('CloudForge Frontend Auth & Functional Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      error: null,
    });
  });

  it('validates login form inputs and shows accessible error messages', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email address is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it('validates registration form inputs including password policy and confirmation match', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/full name/i), 'A');
    await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
    await user.type(screen.getByLabelText(/^password$/i), 'weak');
    await user.type(screen.getByLabelText(/^confirm password$/i), 'different');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/full name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users from protected dashboard to /login and authenticated users from /login to /', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /sign in to cloudforge/i })).toBeInTheDocument();
    unmount();

    useAuthStore.setState({
      user: mockUser,
      status: 'authenticated',
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /welcome back, neha verma/i })).toBeInTheDocument();
  });

  it('loads authenticated dashboard overview with empty state and supports logout', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: mockUser,
      status: 'authenticated',
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /welcome back, neha verma/i })).toBeInTheDocument();
    expect(fetchDashboardOverviewMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/no architectures saved yet/i)).toBeInTheDocument();

    // Open user profile menu and click Log out
    await user.click(screen.getByRole('button', { name: /user profile menu/i }));
    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(logoutAccountMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: /sign in to cloudforge/i })).toBeInTheDocument();
    });
  });
});
