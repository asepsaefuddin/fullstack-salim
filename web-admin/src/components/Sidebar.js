import React, { useEffect } from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.role !== "admin" && location.pathname.startsWith("/")) {
      navigate("/unauthorized");
    }
  }, [user, navigate, location]);

  const isActive = (path) => location.pathname === path;

  return (
    <Nav
      className="flex-column sidebar p-4"
      style={{
        minHeight: '100vh',
        width: 270,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e9ecef 100%)',
        boxShadow: '2px 0 24px rgba(52,152,219,0.10)',
        borderRight: 'none',
        position: 'relative',
        zIndex: 10,
        backdropFilter: 'blur(8px)',
        borderRadius: '0 32px 32px 0'
      }}
    >
      <div className="sidebar-header mb-5 text-center" style={{
        padding: '24px 0 12px 0',
        borderRadius: 24,
        background: 'linear-gradient(135deg, #3498db 60%, #6dd5fa 100%)',
        boxShadow: '0 4px 24px rgba(52,152,219,0.15)',
        marginBottom: 32,
        color: '#fff',
        position: 'relative'
      }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.18)',
            borderRadius: '50%',
            width: 70,
            height: 70,
            margin: '0 auto 14px auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(52,152,219,0.18)'
          }}
        >
          <i className="fas fa-box-open fa-2x" style={{ color: '#fff', textShadow: '0 2px 8px #2980b9' }}></i>
        </div>
        <h3 style={{ fontWeight: 800, letterSpacing: 1, marginBottom: 8, fontSize: 24 }}>Inventory Manager</h3>
        <p className="mb-0" style={{ fontSize: 16, fontWeight: 500, color: '#eaf6fb', textShadow: '0 1px 4px #3498db' }}>
          Welcome, <span style={{ color: '#fff', fontWeight: 700 }}>{user?.name}</span>
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        {[
          { to: '/', icon: 'tachometer-alt', label: 'Dashboard' },
          { to: '/items', icon: 'box', label: 'Items' },
          { to: '/employees', icon: 'users', label: 'Employees' },
          { to: '/history', icon: 'history', label: 'History' },
          { to: '/tasks', icon: 'tasks', label: 'Tasks' },
          { to: '/settings', icon: 'cog', label: 'Settings' }
        ].map(({ to, icon, label }) => (
          <Nav.Item key={to} className="mb-2">
            <Nav.Link
              as={Link}
              to={to}
              active={isActive(to)}
              className={`d-flex align-items-center sidebar-link ${isActive(to) ? 'active-link' : ''}`}
              style={navLinkStyle(isActive(to))}
            >
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: isActive(to)
                  ? 'linear-gradient(135deg, #3498db 60%, #6dd5fa 100%)'
                  : 'rgba(52,152,219,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                boxShadow: isActive(to)
                  ? '0 2px 8px rgba(52,152,219,0.18)'
                  : 'none',
                transition: 'background 0.2s'
              }}>
                <i className={`fas fa-${icon} fa-lg`} style={{
                  color: isActive(to) ? '#fff' : '#3498db',
                  transition: 'color 0.2s'
                }}></i>
              </div>
              <span style={{
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: 0.5,
                color: isActive(to) ? '#3498db' : '#23272b',
                textShadow: isActive(to) ? '0 1px 4px #6dd5fa' : 'none',
                transition: 'color 0.2s'
              }}>
                {label}
              </span>
            </Nav.Link>
          </Nav.Item>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Nav.Item>
          <Nav.Link
            onClick={onLogout}
            className="d-flex align-items-center text-danger sidebar-link"
            style={{
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 17,
              background: 'linear-gradient(90deg, #e74c3c 0%, #f9d423 100%)',
              marginTop: 10,
              boxShadow: '0 2px 12px rgba(231,76,60,0.12)',
              color: '#fff',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}>
              <i className="fas fa-sign-out-alt fa-lg" style={{ color: '#fff' }}></i>
            </div>
            <span>Logout</span>
          </Nav.Link>
        </Nav.Item>
      </div>
    </Nav>
  );
};

// Helper for nav link style
function navLinkStyle(active) {
  return {
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 17,
    color: active ? '#3498db' : '#23272b',
    background: active
      ? 'linear-gradient(135deg, #eaf6fb 0%, #d6eaf8 100%)'
      : 'transparent',
    boxShadow: active
      ? '0 2px 12px rgba(52,152,219,0.10)'
      : 'none',
    transition: 'background 0.2s, color 0.2s'
  };
}

export default Sidebar;