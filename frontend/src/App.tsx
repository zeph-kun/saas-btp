import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage, LoginPage, ForgotPasswordPage, ResetPasswordPage } from '@/pages';
import { AlertNotificationProvider, ProtectedRoute } from '@/components';
import { initializeWebSocket, useAuthStore } from '@/stores';

function AppRoutes() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    // Initialiser la connexion WebSocket uniquement si authentifié
    if (isAuthenticated && user) {
      initializeWebSocket(user.organizationId);
    }
  }, [isAuthenticated, user]);

  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      {/* Routes protégées */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      
      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AlertNotificationProvider>
        <AppRoutes />
      </AlertNotificationProvider>
    </BrowserRouter>
  );
}

export default App;
