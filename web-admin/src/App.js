import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Employees from './pages/Employees';
import History from './pages/History';
import Settings from './pages/Settings';
import Login from './pages/Login';
import CreateTask from './pages/CreateTask';
import './index.css';
import { login } from './/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already logged in (e.g., from localStorage)
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // const handleLogin = async (userData) => {
  //   try {
  //     const response = await login(userData.email, userData.password);
  //     if (response.status === "success") {
  //       setIsAuthenticated(true);
  //       setUser(response.data); // Should include role: "admin"
  //       localStorage.setItem('token', response.data.token || "dummy-token");
  //       localStorage.setItem('user', JSON.stringify(response.data));
  //     }
  //   } catch (error) {
  //     console.error("Login failed:", error);
  //     alert("Invalid email or password");
  //   }
  // };

  const handleLogin = (userData) => {
    if (userData && userData.role === "admin") {
      setIsAuthenticated(true);
      setUser(userData);
      localStorage.setItem('token', 'dummy-admin-token');
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      setError("You must be an admin to access this dashboard");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const AdminRoute = ({ element }) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (user?.role !== "admin") return <Navigate to="/login" />;
    return element;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
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
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route path="/" element={<AdminRoute element={<Dashboard />} />} />
              <Route path="/items" element={<AdminRoute element={<Items />} />} />
              <Route path="/employees" element={<AdminRoute element={<Employees />} />} />
              <Route path="/history" element={<AdminRoute element={<History />} />} />
              <Route path="/tasks" element={<AdminRoute element={<CreateTask />} />} />
              <Route path="/settings" element={<AdminRoute element={<Settings user={user} />} />} />
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