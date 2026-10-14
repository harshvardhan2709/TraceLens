import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';

export function AppRoutes() {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleHealthUpdate = (healthy: boolean, loading: boolean) => {
    setIsBackendHealthy(healthy);
    setIsLoading(loading);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <RootLayout
              isBackendHealthy={isBackendHealthy}
              isLoading={isLoading}
            />
          }
        >
          <Route
            path="/"
            element={<DashboardPage onHealthUpdate={handleHealthUpdate} />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
