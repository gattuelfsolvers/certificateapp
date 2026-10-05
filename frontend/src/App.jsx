import React, { useState, useEffect } from 'react';
import UniversalLogin from './components/UniversalLogin';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';

export default function App() {
  const [authRole, setAuthRole] = useState(null); // 'ADMIN' | 'CLIENT' | null
  const [clientData, setClientData] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem('AUTH_ROLE');
    if (role === 'ADMIN') {
      setAuthRole('ADMIN');
    } else if (role === 'CLIENT') {
      const storedClient = localStorage.getItem('ACTIVE_CLIENT_DATA');
      if (storedClient) {
        try {
          setClientData(JSON.parse(storedClient));
          setAuthRole('CLIENT');
        } catch (e) {
          localStorage.removeItem('AUTH_ROLE');
        }
      }
    }
  }, []);

  const handleLoginSuccess = (role, data) => {
    setAuthRole(role);
    if (role === 'CLIENT') {
      setClientData(data);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('AUTH_ROLE');
    localStorage.removeItem('IS_ADMIN_LOGGED_IN');
    localStorage.removeItem('ACTIVE_CLIENT_DATA');
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
