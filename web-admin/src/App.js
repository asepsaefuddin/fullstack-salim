import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Employees from './pages/Employees';
import History from './pages/History';
import Settings from './pages/Settings';
import Login from './pages/Login';
import CreateTask from './pages/CreateTask';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Dummy admin login
  const handleLogin = (userData) => {
    if (userData?.role === 'admin') {
      setIsAuthenticated(true);
      setUser(userData);
      localStorage.setItem('token', 'dummy-admin-token');
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      alert('You must be an admin to access this dashboard');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const AdminRoute = ({ element }) => {
    if (!isAuthenticated || user?.role !== 'admin') {
      return <Navigate to="/login" replace />;
    }
    return element;
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: '100vh' }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {isAuthenticated ? (
        <div className="d-flex">
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="flex-grow-1 overflow-auto" style={{ height: '100vh' }}>
            <Routes>
              <Route path="/" element={<AdminRoute element={<Dashboard />} />} />
              <Route path="/items" element={<AdminRoute element={<Items />} />} />
              <Route path="/employees" element={<AdminRoute element={<Employees />} />} />
              <Route path="/history" element={<AdminRoute element={<History />} />} />
              <Route path="/tasks" element={<AdminRoute element={<CreateTask />} />} />
              <Route
                path="/settings"
                element={<AdminRoute element={<Settings user={user} />} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;
