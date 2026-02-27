import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import FTEChat from './pages/FTEChat';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protect /chat — redirect to /login if not authenticated
function ProtectedChat() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <FTEChat />;
}

// Redirect logged-in users away from login/register
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/chat" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/chat" element={<ProtectedChat />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#363636', color: '#fff' },
            }}
          />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
