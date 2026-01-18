// Dashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Table, Badge, Spinner } from 'react-bootstrap';
import { getItems, getEmployees, getHistory, getLowStockThreshold } from '../api';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';

// -------------------------------------------------------------------
// Simple deep-equality helper
// -------------------------------------------------------------------
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
};

// -------------------------------------------------------------------
// Local-storage cache keys
// -------------------------------------------------------------------
const CACHE_KEYS = {
  ITEMS: 'dashboard_cached_items',
  EMPLOYEES: 'dashboard_cached_employees',
  HISTORY: 'dashboard_cached_history',
  THRESHOLD: 'dashboard_cached_threshold',
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    lowStockItemsList: [],
    totalEmployees: 0,
    recentActivity: [],
  });

  const [loading, setLoading] = useState(true);        // initial load (incl. cache)
  const [refreshing, setRefreshing] = useState(false); // background refresh
  const [error, setError] = useState('');

  // ---------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------
  const loadFromCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveToCache = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache dashboard data', e);
    }
  };

  // ---------------------------------------------------------------
  // Load data (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    // 1. Load from cache (only on first render)
    if (!forceRefresh) {
      const cachedItems = loadFromCache(CACHE_KEYS.ITEMS);
      const cachedEmployees = loadFromCache(CACHE_KEYS.EMPLOYEES);
      const cachedHistory = loadFromCache(CACHE_KEYS.HISTORY);
      const cachedThreshold = loadFromCache(CACHE_KEYS.THRESHOLD);

      if (cachedItems && cachedEmployees && cachedHistory !== null && cachedThreshold !== null) {
        const lowStockThreshold = cachedThreshold.threshold || 1;
        const lowStockItemsList = cachedItems.filter(
          (item) => Number(item.stock) < lowStockThreshold
        );

        setStats({
          totalItems: cachedItems.length,
          lowStockItems: lowStockItemsList.length,
          lowStockItemsList,
          totalEmployees: cachedEmployees.length,
          recentActivity: cachedHistory,
        });

        setLoading(false);
        setRefreshing(true); // show "refreshing" while syncing
      }
    }

    // 2. Always fetch fresh data
    try {
      const [itemsData, employeesData, historyData, thresholdData] = await Promise.all([
        getItems(),
        getEmployees(),
        getHistory({ limit: 5 }),
        getLowStockThreshold(),
      ]);

      const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
      const items = safeArray(itemsData);
      const employees = safeArray(employeesData);
      const history = safeArray(historyData);
      const threshold = thresholdData?.threshold ?? 1;

      const lowStockItemsList = items.filter((item) => Number(item.stock) < threshold);

      const newStats = {
        totalItems: items.length,
        lowStockItems: lowStockItemsList.length,
        lowStockItemsList,
        totalEmployees: employees.length,
        recentActivity: history,
      };

      // Update only if changed
      setStats((prev) => (deepEqual(prev, newStats) ? prev : newStats));

      // Cache fresh data
      saveToCache(CACHE_KEYS.ITEMS, items);
      saveToCache(CACHE_KEYS.EMPLOYEES, employees);
      saveToCache(CACHE_KEYS.HISTORY, history);
      saveToCache(CACHE_KEYS.THRESHOLD, { threshold });
    } catch (err) {
      console.error('Failed to load fresh dashboard data:', err);
      setError(`Failed to refresh data: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ---------------------------------------------------------------
  // Table columns for recent activity
  // ---------------------------------------------------------------
  const historyColumns = [
    {
      field: 'timestamp',
      header: 'Date',
      style: { width: '180px' },
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: 15 }}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
        </span>
      ),
    },
    { field: 'employee_name', header: 'Employee' },
    { field: 'item_name', header: 'Item' },
    {
      field: 'qty',
      header: 'Qty',
      style: { width: '80px', textAlign: 'center' },
    },
    {
      field: 'action',
      header: 'Action',
      render: (item) => (
        <span
          className={`badge ${item.action === 'deduct' ? 'bg-danger' : 'bg-success'}`}
          style={{
            fontSize: 14,
            padding: '8px 16px',
            borderRadius: 20,
            letterSpacing: 0.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {item.action}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading) {
    return (
      <Container
        fluid
        className="p-4 d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="mt-3 text-muted">Loading cached data…</span>
      </Container>
    );
  }

  return (
    <Container
      fluid
      className="p-4"
      style={{ background: 'transparent', minHeight: '100vh', position: 'relative' }}
    >
      {/* Header + Refresh Badge */}
      <div className="d-flex justify-content-between align-items-center mb-5">
        <h1
          className="dashboard-header"
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
            className="fas fa-tachometer-alt me-3 text-primary"
            style={{ animation: 'pulse 2s infinite' }}
          ></i>
          Dashboard
        </h1>

        {refreshing && (
          <Badge bg="info" className="d-flex align-items-center px-3 py-2">
            <Spinner animation="border" size="sm" className="me-2" />
            Refreshing…
          </Badge>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <Row className="g-4 mb-5">
        <Col md={3}>
          <StatsCard title="Total Items" value={stats.totalItems} icon="box" variant="primary" />
        </Col>
        <Col md={3}>
          <StatsCard
            title="Low Stock"
            value={stats.lowStockItems}
            icon="exclamation-triangle"
            variant="warning"
          />
        </Col>
        <Col md={3}>
          <StatsCard title="Employees" value={stats.totalEmployees} icon="users" variant="info" />
        </Col>
        <Col md={3}>
          <StatsCard
            title="Today's Activity"
            value={stats.recentActivity.length}
            icon="history"
            variant="success"
          />
        </Col>
      </Row>

      {/* Low Stock Items Table */}
      {stats.lowStockItems > 0 ? (
        <Row className="mb-5">
          <Col md={12}>
            <div
              className="card shadow-lg border-0 low-stock-alert"
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
                boxShadow: '0 10px 40px rgba(255,193,7,0.2)',
              }}
            >
              <div
                className="card-header bg-transparent border-0 py-4 px-4"
                style={{ borderBottom: '1px solid rgba(240,244,250,0.5)' }}
              >
                <h5
                  className="mb-0"
                  style={{
                    fontWeight: 800,
                    color: '#23272b',
                    letterSpacing: 1,
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <i
                    className="fas fa-exclamation-triangle me-3 text-warning"
                    style={{ animation: 'bounce 1.5s infinite' }}
                  ></i>
                  Low Stock Items
                </h5>
              </div>
              <div className="card-body p-0">
                <Table responsive hover bordered={false} className="mb-0 table-hover">
                  <thead style={{ background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                    <tr>
                      <th style={{ padding: '15px 20px' }}>Item Name</th>
                      <th style={{ padding: '15px 20px' }}>Item ID</th>
                      <th style={{ padding: '15px 20px' }}>Current Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.lowStockItemsList.map((item, index) => (
                      <tr key={index} style={{ transition: 'all 0.3s' }}>
                        <td style={{ padding: '15px 20px' }}>{item.name}</td>
                        <td style={{ padding: '15px 20px' }}>{item.id}</td>
                        <td style={{ padding: '15px 20px' }}>
                          <span
                            className="badge bg-danger"
                            style={{
                              fontSize: 14,
                              padding: '8px 16px',
                              borderRadius: 20,
                              boxShadow: '0 2px 8px rgba(220,53,69,0.3)',
                            }}
                          >
                            {Number(item.stock)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          </Col>
        </Row>
      ) : (
        <Row className="mb-5">
          <Col md={12}>
            <div
              className="card shadow-lg border-0"
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
                boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
                padding: '3rem',
              }}
            >
              <div className="card-body text-center">
                <i
                  className="fas fa-box-open fa-3x text-success mb-3 empty-state-icon"
                  style={{ textShadow: '0 2px 10px rgba(40,167,69,0.2)' }}
                ></i>
                <h5 className="text-muted" style={{ fontWeight: 600, letterSpacing: 0.5 }}>
                  No items are currently low on stock
                </h5>
                <p className="text-muted small">Everything is well-stocked and ready!</p>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Recent Activity */}
      <Row className="mb-4">
        <Col md={12}>
          <div
            className="card shadow-lg border-0"
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
              boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
            }}
          >
            <div
              className="card-header bg-transparent border-0 py-4 px-4"
              style={{ borderBottom: '1px solid rgba(240,244,250,0.5)' }}
            >
              <h5
                className="mb-0"
                style={{
                  fontWeight: 800,
                  color: '#23272b',
                  letterSpacing: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <i
                  className="fas fa-history me-3 text-success"
                  style={{ animation: 'spin 2s linear infinite' }}
                ></i>
                Recent Activity
              </h5>
            </div>
            <div className="card-body p-0">
              <DataTable
                data={stats.recentActivity}
                columns={historyColumns}
                keyField="timestamp"
                searchable={false}
                pagination={false}
              />
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;