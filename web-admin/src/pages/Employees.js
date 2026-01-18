// Employees.js
import React, { useState, useEffect, useCallback } from 'react';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from '../api';
import DataTable from '../components/DataTable';
import { Button, Modal, Form, Alert, Container, Badge, Spinner } from 'react-bootstrap';

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
// Cache key
// -------------------------------------------------------------------
const CACHE_KEY = 'employees_cached_data';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [generatedPin, setGeneratedPin] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'employee',
    pin: '',
    email: '',
  });

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

  const saveToCache = (data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache employees', e);
    }
  };

  // ---------------------------------------------------------------
  // Load employees (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadEmployees = useCallback(async (forceRefresh = false) => {
    // 1. Try cache first
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (Array.isArray(cached)) {
        setEmployees(cached);
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const data = await getEmployees();
      const safeData = Array.isArray(data) ? data : [];

      // Only update if different
      setEmployees((prev) => (deepEqual(prev, safeData) ? prev : safeData));

      // Save to cache
      saveToCache(safeData);
    } catch (err) {
      setError('Failed to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Refresh after CRUD
  const refreshEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getEmployees();
      const safeData = Array.isArray(data) ? data : [];
      setEmployees(safeData);
      saveToCache(safeData);
    } catch (err) {
      setError('Failed to refresh employees');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Form handlers
  // ---------------------------------------------------------------
  const handleChange = (e) => {
    setFormData((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  };

  const handleEdit = (emp) => {
    setCurrentEmployee(emp);
    setFormData({
      name: emp.name,
      role: emp.role,
      pin: '',
      email: emp.email || '',
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setCurrentEmployee(null);
    setGeneratedPin(null);
    setFormData({
      name: '',
      role: 'employee',
      pin: '',
      email: '',
    });
    setShowModal(true);
  };

  const handleDelete = async (emp) => {
    if (window.confirm(`Are you sure you want to delete employee "${emp.name}"?`)) {
      setLoading(true);
      setError('');
      try {
        await deleteEmployee(emp.id);
        await refreshEmployees();
      } catch (err) {
        console.error('Delete error:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to delete employee';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    // PIN validation: required for add, optional for update but must validate if provided
    if (!currentEmployee && !formData.pin.trim()) {
      setError('PIN is required for new employee');
      setLoading(false);
      return;
    }

    if (currentEmployee && formData.pin.trim() && formData.pin.trim().length < 4) {
      setError('PIN must be at least 4 characters');
      setLoading(false);
      return;
    }

    if (!currentEmployee && formData.pin.trim().length < 4) {
      setError('PIN must be at least 4 characters');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
      };

      // Only include PIN if provided (for updates) or always for new employees
      if (formData.pin.trim()) {
        payload.pin = formData.pin.trim();
      } else if (!currentEmployee) {
        setError('PIN is required for new employee');
        setLoading(false);
        return;
      }

      console.log('Submitting payload:', payload);

      if (currentEmployee) {
        await updateEmployee({ id: currentEmployee.id, ...payload });
      } else {
        await addEmployee(payload);
      }
      setShowModal(false);
      await refreshEmployees();
    } catch (err) {
      console.error('Submit error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save employee';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------
  const columns = [
    {
      field: 'id',
      header: 'ID',
      style: { width: 90, color: '#888', fontWeight: 500 },
    },
    {
      field: 'name',
      header: 'Name',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'email',
      header: 'Email',
      style: { color: '#495057' },
    },
    {
      field: 'role',
      header: 'Role',
      render: (item) => (
        <span
          className={`badge ${item.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}
          style={{
            fontSize: 14,
            borderRadius: 20,
            fontWeight: 600,
            textTransform: 'uppercase',
            padding: '8px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {item.role}
        </span>
      ),
    },
    {
      field: 'last_login',
      header: 'Last Login',
      style: { fontFamily: 'monospace', fontSize: 15, color: '#888' },
    },
  ];

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <Container
        fluid
        className="p-4 d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="mt-3 text-muted">Loading cached employees…</span>
      </Container>
    );
  }

  return (
    <Container
      fluid
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
          <i className="fas fa-users me-3 text-info" style={{ animation: 'bounce 2s infinite' }}></i>
          Employees
        </h2>

        <div className="d-flex align-items-center gap-3">
          {refreshing && (
            <Badge bg="info" className="d-flex align-items-center px-3 py-2">
              <Spinner animation="border" size="sm" className="me-2" />
              Refreshing…
            </Badge>
          )}
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={loading}
            style={{
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              padding: '12px 24px',
              boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
            }}
            className="hover-scale"
          >
            <i className="fas fa-plus me-2"></i> Add Employee
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert
          variant="danger"
          className="mb-4"
          style={{
            borderRadius: 12,
            boxShadow: '0 4px 15px rgba(220,53,69,0.2)',
            animation: 'fadeInUp 0.5s ease-out',
          }}
        >
          {error}
        </Alert>
      )}

      {/* Data Table */}
      <div
        className="card shadow-lg border-0 mb-4 data-table-container"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
          boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
          overflow: 'hidden',
        }}
      >
        <div className="card-body p-0">
          <DataTable
            data={employees}
            columns={columns}
            keyField="id"
            actions
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>

      {/* Modal */}
      <Modal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setGeneratedPin(null);
        }}
        centered
        contentClassName="border-0"
        style={{ borderRadius: 20 }}
        backdropClassName="custom-backdrop"
      >
        <Modal.Header
          closeButton
          style={{
            borderBottom: 'none',
            background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: '1.5rem 2rem',
          }}
        >
          <Modal.Title
            style={{
              fontWeight: 800,
              color: '#3498db',
              letterSpacing: 0.5,
              textShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            {currentEmployee ? 'Edit Employee' : 'Add Employee'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body
            style={{
              background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              padding: '2rem',
            }}
          >
            {generatedPin && (
              <Alert variant="success" className="mb-4">
                <strong>✓ Employee added successfully!</strong><br />
                PIN Hash: <code style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-all' }}>{generatedPin}</code>
              </Alert>
            )}

            {!generatedPin && (
              <>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Name *</Form.Label>
                  <Form.Control
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    style={{
                      borderRadius: 12,
                      background: '#fff',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                    }}
                    className="hover-scale-input"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Email *</Form.Label>
                  <Form.Control
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    style={{
                      borderRadius: 12,
                      background: '#fff',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                    }}
                    className="hover-scale-input"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Role *</Form.Label>
                  <Form.Select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    style={{
                      borderRadius: 12,
                      background: '#fff',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                    }}
                    className="hover-scale-input"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                    {currentEmployee ? 'New PIN (leave blank to keep current)' : 'PIN *'}
                  </Form.Label>
                  <Form.Control
                    name="pin"
                    type="password"
                    value={formData.pin}
                    onChange={handleChange}
                    placeholder={currentEmployee ? 'Enter new PIN (optional)' : 'Enter PIN (required)'}
                    required={!currentEmployee}
                    disabled={loading}
                    minLength={!currentEmployee ? 4 : undefined}
                    style={{
                      borderRadius: 12,
                      background: '#fff',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                    }}
                    className="hover-scale-input"
                  />
                  {currentEmployee && (
                    <Form.Text className="d-block mt-2" style={{ fontSize: 12, color: '#888' }}>
                      Leave blank to keep the current PIN unchanged
                    </Form.Text>
                  )}
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer
            style={{
              borderTop: 'none',
              background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              padding: '1.5rem 2rem',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setGeneratedPin(null);
              }}
              disabled={loading}
              style={{
                borderRadius: 12,
                fontWeight: 700,
                padding: '12px 24px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
              }}
              className="hover-scale"
            >
              {generatedPin ? 'Close' : 'Cancel'}
            </Button>
            {!generatedPin && (
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
                style={{
                  borderRadius: 12,
                  fontWeight: 700,
                  padding: '12px 24px',
                  boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
                  background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
                  transition: 'all 0.3s ease',
                }}
                className="hover-scale"
              >
                {loading ? 'Saving...' : 'Save Employee'}
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Employees;