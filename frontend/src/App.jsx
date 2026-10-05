import React, { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { ShieldCheck, LogIn } from 'lucide-react';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('IS_ADMIN_LOGGED_IN');
    if (session === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('IS_ADMIN_LOGGED_IN');
    setIsAdminLoggedIn(false);
  };

  if (isAdminLoggedIn) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  return <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />;
}
