import React, { useState, useEffect } from 'react';
import UniversalLogin from './components/UniversalLogin';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';

export default function App() {
  const [authRole, setAuthRole] = useState(null); // 'ADMIN' | 'CLIENT' | null
  const [clientData, setClientData] = useState(null);

  const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 Hours Session Timeout

  useEffect(() => {
    const role = localStorage.getItem('AUTH_ROLE');
    const loginTime = localStorage.getItem('LOGIN_TIMESTAMP');

    // 1. Session Expiry Check (8 Hours Max)
    if (loginTime) {
      const elapsed = Date.now() - parseInt(loginTime, 10);
      if (elapsed > SESSION_MAX_AGE_MS || isNaN(elapsed)) {
        // Session expired! Force clean logout
        handleLogout();
        return;
      }
    } else if (role) {
      // If role exists but no timestamp, expire legacy sessions
      handleLogout();
      return;
    }

    // 2. Load Active Role if session is still valid
    if (role === 'ADMIN') {
      setAuthRole('ADMIN');
    } else if (role === 'CLIENT') {
      const storedClient = localStorage.getItem('ACTIVE_CLIENT_DATA');
      if (storedClient) {
        try {
          setClientData(JSON.parse(storedClient));
          setAuthRole('CLIENT');
        } catch (e) {
          handleLogout();
        }
      } else {
        handleLogout();
      }
    }
  }, []);

  const handleLoginSuccess = (role, data) => {
    localStorage.setItem('LOGIN_TIMESTAMP', Date.now().toString());
    setAuthRole(role);
    if (role === 'CLIENT') {
      setClientData(data);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('AUTH_ROLE');
    localStorage.removeItem('IS_ADMIN_LOGGED_IN');
    localStorage.removeItem('ACTIVE_CLIENT_DATA');
    localStorage.removeItem('LOGIN_TIMESTAMP');
    sessionStorage.clear();
    setAuthRole(null);
    setClientData(null);
  };

  if (authRole === 'ADMIN') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  if (authRole === 'CLIENT') {
    return <ClientDashboard clientData={clientData} onLogout={handleLogout} />;
  }

  return <UniversalLogin onLoginSuccess={handleLoginSuccess} />;
}
