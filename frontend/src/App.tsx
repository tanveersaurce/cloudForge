import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/features/auth/components/PublicOnlyRoute';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ArchitectureBuilderPage } from '@/features/architecture-builder/pages/ArchitectureBuilderPage';
import { ArchitecturesListPage } from '@/features/architecture-builder/pages/ArchitecturesListPage';
import { CostExplorerPage } from '@/features/cost-explorer/pages/CostExplorerPage';
import { AwsServiceDetailPage } from '@/features/aws-services/pages/AwsServiceDetailPage';
import { AwsServicesExplorerPage } from '@/features/aws-services/pages/AwsServicesExplorerPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlannedModulePage } from '@/pages/PlannedModulePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/architecture-builder/:architectureId"
          element={<ArchitectureBuilderPage />}
        />
        <Route
          path="/cost-explorer/:architectureId"
          element={<CostExplorerPage />}
        />
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/builder" element={<ArchitecturesListPage />} />
          <Route path="/services" element={<AwsServicesExplorerPage />} />
          <Route path="/services/:slug" element={<AwsServiceDetailPage />} />
          <Route path="/architectures" element={<ArchitecturesListPage />} />
          <Route path="/cost-explorer" element={<PlannedModulePage moduleId="cost-explorer" />} />
          <Route path="/terraform" element={<PlannedModulePage moduleId="terraform" />} />
          <Route path="/deployments" element={<PlannedModulePage moduleId="deployments" />} />
          <Route path="/settings" element={<PlannedModulePage moduleId="settings" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  const { initializeSession } = useAuth();

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
