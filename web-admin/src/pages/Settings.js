// Settings.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Alert,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Badge,
} from 'react-bootstrap';
import { getLowStockThreshold, updateLowStockThreshold } from '../api';

// -------------------------------------------------------------------
// Cache key
// -------------------------------------------------------------------
const CACHE_KEY = 'settings_low_stock_threshold';

const Settings = ({ user }) => {
  const [settings, setSettings] = useState({
    api_url: process.env.REACT_APP_API_URL || 'https://your-api-endpoint.com',
    api_secret: '****************',
    low_stock_threshold: 5,
    enable_email_alerts: true,
    email_recipient: 'admin@company.com',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------
  const loadFromCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveToCache = (threshold) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ threshold }));
    } catch (e) {
      console.warn('Failed to cache low stock threshold', e);
    }
  };

  // ---------------------------------------------------------------
  // Load threshold (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadThreshold = useCallback(async (forceRefresh = false) => {
    // 1. Load from cache (only on first mount)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (cached && typeof cached.threshold === 'number') {
        setSettings((prev) => ({
          ...prev,
          low_stock_threshold: cached.threshold,
        }));
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const thresholdData = await getLowStockThreshold();
      const threshold = thresholdData?.threshold ?? 5;

      setSettings((prev) => ({
        ...prev,
        low_stock_threshold: threshold,
      }));

      // Save to cache
      saveToCache(threshold);
    } catch (error) {
      console.error('Failed to load threshold:', error);
      alert(`Failed to load low stock threshold: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadThreshold();
  }, [loadThreshold]);

  // ---------------------------------------------------------------
  // Save threshold
  // ---------------------------------------------------------------
  const handleSaveThreshold = async () => {
    setIsSubmitting(true);
    try {
      await updateLowStockThreshold(settings.low_stock_threshold);
      saveToCache(settings.low_stock_threshold);
      alert('Low stock threshold updated successfully');
    } catch (error) {
      alert(`Failed to update threshold: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <div
        className="p-4 d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="mt-3 text-muted">Loading settings…</span>
      </div>
    );
  }

  return (
    <div
      className="p-4"
      style={{
        background: 'transparent',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-5 dashboard-header">
        <h2
          style={{
            fontWeight: 800,
            color: '#23272b',
            letterSpacing: 1.5,
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            animation: 'fadeIn 0.8s ease-out',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <i
            className="fas fa-cog me-3 text-primary"
            style={{ animation: 'spin 2s linear infinite' }}
          ></i>
          System Settings
        </h2>

        {refreshing && (
          <Badge bg="info" className="d-flex align-items-center px-3 py-2">
            <Spinner animation="border" size="sm" className="me-2" />
            Refreshing…
          </Badge>
        )}
      </div>

      <Alert
        variant="info"
        className="mb-4"
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 15px rgba(52,152,219,0.2)',
          animation: 'fadeInUp 0.5s ease-out',
          background: 'linear-gradient(135deg, #e6f0fa 0%, #d9e9fa 100%)',
        }}
      >
        <i className="fas fa-info-circle me-2"></i>
        Settings are read-only. Contact your system administrator to make changes.
      </Alert>

      <Row className="g-4">
        {/* API Configuration */}
        <Col md={6}>
          <Card
            className="mb-4 shadow-lg border-0 stats-card"
            style={{
              borderRadius: 20,
              background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
              boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
              overflow: 'hidden',
            }}
          >
            <Card.Header
              className="bg-transparent py-4 px-4"
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottom: '1px solid rgba(240,244,250,0.5)',
              }}
            >
              <h5
                className="mb-0"
                style={{
                  fontWeight: 800,
                  color: '#3498db',
                  letterSpacing: 0.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <i className="fas fa-link me-3" style={{ animation: 'pulse 2s infinite' }}></i>
                API Configuration
              </h5>
            </Card.Header>
            <Card.Body style={{ padding: '2rem' }}>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>API URL</Form.Label>
                  <div
                    className="form-control-plaintext"
                    style={{
                      borderRadius: 12,
                      padding: '12px 16px',
                      background: '#f8f9fa',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      fontSize: 16,
                      fontWeight: 500,
                    }}
                  >
                    {settings.api_url}
                  </div>
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>API Secret Key</Form.Label>
                  <div
                    className="form-control-plaintext"
                    style={{
                      borderRadius: 12,
                      padding: '12px 16px',
                      background: '#f8f9fa',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      fontSize: 16,
                      fontWeight: 500,
                    }}
                  >
                    {settings.api_secret}
                  </div>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Notification Settings */}
        <Col md={6}>
          <Card
            className="mb-4 shadow-lg border-0 stats-card"
            style={{
              borderRadius: 20,
              background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
              boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
              overflow: 'hidden',
            }}
          >
            <Card.Header
              className="bg-transparent py-4 px-4"
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottom: '1px solid rgba(240,244,250,0.5)',
              }}
            >
              <h5
                className="mb-0"
                style={{
                  fontWeight: 800,
                  color: '#27ae60',
                  letterSpacing: 0.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <i className="fas fa-bell me-3" style={{ animation: 'bounce 1.5s infinite' }}></i>
                Notification Settings
              </h5>
            </Card.Header>
            <Card.Body style={{ padding: '2rem' }}>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                    Low Stock Threshold
                  </Form.Label>
                  {loading ? (
                    <div className="text-center my-3">
                      <Spinner
                        animation="border"
                        variant="primary"
                        style={{
                          width: '2rem',
                          height: '2rem',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <Form.Control
                        type="number"
                        min="0"
                        value={settings.low_stock_threshold}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            low_stock_threshold: parseInt(e.target.value) || 0,
                          })
                        }
                        style={{
                          borderRadius: 12,
                          fontSize: 16,
                          padding: '12px 16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                          border: 'none',
                          background: '#fff',
                        }}
                        className="hover-scale-input"
                      />
                      <Button
                        variant="success"
                        onClick={handleSaveThreshold}
                        disabled={isSubmitting || loading}
                        style={{
                          borderRadius: 12,
                          fontWeight: 700,
                          padding: '12px 24px',
                          margin: '15px 0',
                          boxShadow: '0 4px 15px rgba(40,167,69,0.3)',
                          background: 'linear-gradient(90deg, #28a745 0%, #218838 100%)',
                          transition: 'all 0.3s ease',
                        }}
                        className="hover-scale"
                      >
                        {isSubmitting ? (
                          <Spinner as="span" animation="border" size="sm" />
                        ) : (
                          <>Save Threshold</>
                        )}
                      </Button>
                    </>
                  )}
                  <Form.Text className="text-muted" style={{ fontSize: 14 }}>
                    Send alerts when stock falls below this number
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <div className="d-flex align-items-center">
                    <Form.Check
                      type="switch"
                      id="enable-email-alerts"
                      label="Enable Email Alerts"
                      checked={settings.enable_email_alerts}
                      disabled
                      readOnly
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        opacity: 1,
                        pointerEvents: 'none',
                      }}
                    />
                    <span className="ms-2">
                      {settings.enable_email_alerts ? (
                        <span
                          className="badge bg-success"
                          style={{
                            fontSize: 14,
                            padding: '8px 16px',
                            borderRadius: 20,
                            boxShadow: '0 2px 8px rgba(40,167,69,0.3)',
                          }}
                        >
                          Enabled
                        </span>
                      ) : (
                        <span
                          className="badge bg-secondary"
                          style={{
                            fontSize: 14,
                            padding: '8px 16px',
                            borderRadius: 20,
                            boxShadow: '0 2px 8px rgba(108,117,125,0.3)',
                          }}
                        >
                          Disabled
                        </span>
                      )}
                    </span>
                  </div>
                </Form.Group>

                {settings.enable_email_alerts && (
                  <Form.Group className="mb-4">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                      Notification Email
                    </Form.Label>
                    <div
                      className="form-control-plaintext"
                      style={{
                        borderRadius: 12,
                        padding: '12px 16px',
                        background: '#f8f9fa',
                        border: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        fontSize: 16,
                        fontWeight: 500,
                      }}
                    >
                      {user?.email || 'Not set'}
                    </div>
                    <Form.Text className="text-muted" style={{ fontSize: 14 }}>
                      Where to send notification emails
                    </Form.Text>
                  </Form.Group>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div
        className="mt-5 text-center text-muted"
        style={{
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: 0.5,
          animation: 'fadeIn 0.8s ease-out',
        }}
      >
        <i className="fas fa-lock me-2" style={{ animation: 'pulse 2s infinite' }}></i>
        Settings are locked for viewing only
      </div>
    </div>
  );
};

export default Settings;