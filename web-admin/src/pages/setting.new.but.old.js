// Settings.js
import React, { useEffect, useState } from 'react';
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

/* ================= CACHE ================= */
const THRESHOLD_CACHE = 'settings_low_stock_threshold';
const CONFIG_CACHE = 'settings_config';

const loadCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

/* ================= COMPONENT ================= */
const Settings = ({ user }) => {
  /* UI State */
  const [apiUrl, setApiUrl] = useState(process.env.REACT_APP_APPSCRIPT || '');
  const [apiSecret, setApiSecret] = useState('');
  const [threshold, setThreshold] = useState(5);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [email, setEmail] = useState('');

  /* Status */
  const [loading, setLoading] = useState(true);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  /* ================= LOAD ================= */
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const cachedConfig = loadCache(CONFIG_CACHE);
      if (cachedConfig && mounted) {
        setApiUrl(cachedConfig.apiUrl || '');
        setApiSecret(cachedConfig.apiSecret || '');
        setEnableAlerts(cachedConfig.enableAlerts ?? true);
      }

      // Always use current user email as default
      if (user?.email && mounted) {
        setEmail(user.email);
      } else if (mounted) {
        setEmail('');
      }

      const cachedThreshold = loadCache(THRESHOLD_CACHE);
      if (cachedThreshold?.threshold && mounted) {
        setThreshold(cachedThreshold.threshold);
      }

      try {
        const res = await getLowStockThreshold();
        if (mounted && typeof res?.threshold === 'number') {
          setThreshold(res.threshold);
          saveCache(THRESHOLD_CACHE, { threshold: res.threshold });
        }
      } catch (e) {
        console.error(e);
      } finally {
        mounted && setLoading(false);
      }
    };

    init();
    return () => (mounted = false);
  }, [user?.email]);

  /* ================= SAVE ================= */
  const saveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await updateLowStockThreshold(threshold);
      saveCache(THRESHOLD_CACHE, { threshold });
      alert('Threshold updated');
    } finally {
      setSavingThreshold(false);
    }
  };

  const saveApiConfig = () => {
    setSavingApi(true);
    saveCache(CONFIG_CACHE, { apiUrl, apiSecret, enableAlerts, email });
    setTimeout(() => {
      setSavingApi(false);
      alert('API settings saved');
    }, 400);
  };

  const saveAlertConfig = () => {
    setSavingConfig(true);
    saveCache(CONFIG_CACHE, { apiUrl, apiSecret, enableAlerts, email });
    setTimeout(() => {
      setSavingConfig(false);
      alert('Alert settings saved');
    }, 400);
  };

  /* ================= UI ================= */
  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <Spinner animation="border" />
      </div>
    );
  }

  const FancyCard = ({ title, icon, color, children }) => (
    <Card
      className="border-0 mb-4"
      style={{
        borderRadius: 18,
        boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
        background: '#fff',
      }}
    >
      <Card.Header
        className="bg-transparent"
        style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}
      >
        <h5 style={{ fontWeight: 800, color }}>
          <i className={`${icon} me-2`} />
          {title}
        </h5>
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card>
  );

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ fontWeight: 800 }}>
          <i className="fas fa-cog me-2 text-primary" />
          System Settings
        </h2>
        <Badge bg="primary" pill>
          Advanced
        </Badge>
      </div>

      <Alert
        variant="info"
        style={{
          borderRadius: 14,
          boxShadow: '0 6px 20px rgba(52,152,219,.25)',
        }}
      >
        <i className="fas fa-info-circle me-2" />
        Threshold saved to server · Others saved locally
      </Alert>

      <Row className="g-4">
        {/* API */}
        <Col md={6}>
          <FancyCard
            title="API Configuration"
            icon="fas fa-link"
            color="#3498db"
          >
            <Form.Group className="mb-4">
              <Form.Label>API URL</Form.Label>
              <Form.Control
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                style={{ borderRadius: 12 }}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>API Secret</Form.Label>
              <Form.Control
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter secret manually"
                style={{ borderRadius: 12 }}
              />
            </Form.Group>

            <Button
              type="button"
              onClick={saveApiConfig}
              disabled={savingApi}
              style={{ borderRadius: 12, fontWeight: 700 }}
            >
              {savingApi ? <Spinner size="sm" /> : 'Save API Settings'}
            </Button>
          </FancyCard>
        </Col>

        {/* NOTIFICATION */}
        <Col md={6}>
          <FancyCard
            title="Notification Settings"
            icon="fas fa-bell"
            color="#27ae60"
          >
            <Form.Group className="mb-3">
              <Form.Label>Low Stock Threshold</Form.Label>
              <Form.Control
                type="number"
                value={threshold}
                min={0}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{ borderRadius: 12 }}
              />
            </Form.Group>

            <Button
              type="button"
              variant="success"
              onClick={saveThreshold}
              disabled={savingThreshold}
              className="mb-4"
              style={{ borderRadius: 12, fontWeight: 700 }}
            >
              {savingThreshold ? <Spinner size="sm" /> : 'Save Threshold'}
            </Button>

            <hr />

            <Form.Check
              type="switch"
              label="Enable Email Alerts"
              checked={enableAlerts}
              onChange={(e) => setEnableAlerts(e.target.checked)}
            />

            {enableAlerts && (
              <>
                <Form.Group className="mt-3">
                  <Form.Label>Email Recipient</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ borderRadius: 12 }}
                  />
                </Form.Group>

                <Button
                  type="button"
                  className="mt-3"
                  onClick={saveAlertConfig}
                  disabled={savingConfig}
                  style={{ borderRadius: 12 }}
                >
                  {savingConfig ? <Spinner size="sm" /> : 'Save Alert Settings'}
                </Button>
              </>
            )}
          </FancyCard>
        </Col>
      </Row>
    </div>
  );
};

export default Settings;
