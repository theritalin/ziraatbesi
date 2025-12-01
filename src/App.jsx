import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';

// Lazy load pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const CreateFarmPage = React.lazy(() => import('./pages/CreateFarmPage'));

function App() {
  return (
    <Router>
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/create-farm" 
            element={
              <PrivateRoute>
                <CreateFarmPage />
              </PrivateRoute>
            } 
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;