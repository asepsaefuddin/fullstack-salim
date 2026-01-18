import React from 'react';
import { Card } from 'react-bootstrap';

const StatsCard = ({ title, value, icon, variant = 'primary', onClick }) => {
  // Custom color palette for variants
  const bgColors = {
    primary: 'linear-gradient(135deg, #3498db 70%, #6dd5fa 100%)',
    warning: 'linear-gradient(135deg, #f7b731 70%, #f9d423 100%)',
    info: 'linear-gradient(135deg, #17c0eb 70%, #00b894 100%)',
    success: 'linear-gradient(135deg, #27ae60 70%, #2ecc71 100%)',
    danger: 'linear-gradient(135deg, #e74c3c 70%, #f9d423 100%)',
    dark: 'linear-gradient(135deg, #23272b 70%, #2c3e50 100%)'
  };

  return (
    <Card
      className="stats-card mb-3 shadow-lg border-0"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: bgColors[variant] || bgColors.primary,
        color: '#fff',
        borderRadius: 22,
        minHeight: 120,
        transition: 'box-shadow 0.2s, transform 0.2s',
        boxShadow: '0 8px 32px rgba(52,152,219,0.13)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)'
      }}
    >
      <Card.Body className="d-flex justify-content-between align-items-center py-4 px-4">
        <div>
          <Card.Title className="mb-1" style={{ fontSize: '1.15rem', opacity: 0.95, letterSpacing: 0.7, fontWeight: 700 }}>
            {title}
          </Card.Title>
          <Card.Text as="h2" className="mb-0 fw-bold" style={{ fontSize: 38, letterSpacing: 1.2, textShadow: '0 2px 8px rgba(52,152,219,0.10)' }}>
            {value}
          </Card.Text>
        </div>
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            boxShadow: '0 4px 16px rgba(52,152,219,0.13)',
            border: '2px solid rgba(255,255,255,0.18)'
          }}
        >
          <i className={`fas fa-${icon}`} style={{ fontSize: 36, opacity: 0.96, color: '#fff', textShadow: '0 2px 8px #3498db' }}></i>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StatsCard;