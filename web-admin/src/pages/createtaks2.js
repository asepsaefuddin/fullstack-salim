import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Table,
  Modal,
  Badge,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { getTasks, addTask, updateTask, deleteTask, getEmployees } from '../api';
import DataTable from '../components/DataTable';

// Helper: deep equality check for objects/arrays
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

// Local-storage keys
const CACHE_KEYS = {
  TASKS: 'cached_tasks',
  EMPLOYEES: 'cached_employees',
};

const CreateTask = () => {
  // State
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); // initial load (incl. cache)
  const [refreshing, setRefreshing] = useState(false); // background refresh
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    task_id: '',
    title: '',
    description: '',
    status: 'assigned',
  });

  const [modals, setModals] = useState({
    showEdit: false,
    showDelete: false,
    currentTask: null,
  });

  const navigate = useNavigate();

  // Cache helpers
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
      console.warn('Failed to cache data', e);
    }
  };

  // Load initial data (cache → API → update cache)
  const loadAllData = useCallback(async (forceRefresh = false) => {
    // 1. Try cache first (only on first mount)
    if (!forceRefresh) {
      const cachedTasks = loadFromCache(CACHE_KEYS.TASKS);
      const cachedEmployees = loadFromCache(CACHE_KEYS.EMPLOYEES);

      if (cachedTasks && cachedEmployees) {
        setTasks(cachedTasks);
        setEmployees(cachedEmployees);
        setLoading(false);
        setRefreshing(true); // show "refreshing…" while fetching fresh data
      }
    }

    // 2. Always fetch fresh data (even if we have cache)
    try {
      const [tasksData, employeesData] = await Promise.all([
        getTasks(),
        getEmployees(),
      ]);

      const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

      const newTasks = safeArray(tasksData);
      const newEmployees = safeArray(employeesData);

      // Update state only if something changed
      setTasks((prev) => (deepEqual(prev, newTasks) ? prev : newTasks));
      setEmployees((prev) => (deepEqual(prev, newEmployees) ? prev : newEmployees));

      // Persist fresh data
      saveToCache(CACHE_KEYS.TASKS, newTasks);
      saveToCache(CACHE_KEYS.EMPLOYEES, newEmployees);
    } catch (err) {
      console.error('Failed to load fresh data:', err);
      setError(`Failed to refresh data: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Employee normalization helpers
  const normalizeEmployeeEntries = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  };

  const resolveEmployeeName = (entry) => {
    const candidateName = typeof entry === 'object' && entry !== null ? entry.name : null;
    const candidateId =
      typeof entry === 'object' && entry !== null
        ? entry.id ?? entry.employee_id ?? entry.emp_id
        : entry;
    const found =
      employees.find((e) => `${e.id}` === `${candidateId}`) ||
      employees.find((e) => `${e.employee_id}` === `${candidateId}`);
    return found?.name || candidateName || `${candidateId || '-'}`;
  };

  const getEmployeeNames = (employeeIds) =>
    normalizeEmployeeEntries(employeeIds)
      .map((entry) => resolveEmployeeName(entry))
      .join(', ');

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Task CRUD
  const refreshTasks = async () => {
    try {
      const fresh = await getTasks();
      const safe = Array.isArray(fresh) ? fresh : [];
      setTasks(safe);
      saveToCache(CACHE_KEYS.TASKS, safe);
    } catch (err) {
      setError(`Failed to refresh tasks: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validasi
      if (!formData.title.trim()) {
        setError('Task title is required');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
      };

      console.log('Submitting task:', payload);

      if (modals.showEdit) {
        payload.task_id = formData.task_id;
        await updateTask(payload);
        alert('Task updated successfully!');
      } else {
        await addTask(payload);
        alert('Task created successfully!');
      }
      
      await refreshTasks();
      resetForm();
      setModals({ showEdit: false, showDelete: false, currentTask: null });
    } catch (err) {
      console.error('Submit error:', err);
      setError(`Operation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTask = (task) => {
    setFormData({
      task_id: task.task_id,
      title: task.title,
      description: task.description || '',
      status: task.status || 'assigned',
    });
    setModals({ ...modals, showEdit: true, currentTask: task });
  };

  const handleDeleteTask = async () => {
    if (!modals.currentTask) return;
    setIsSubmitting(true);
    setError('');

    try {
      await deleteTask(modals.currentTask.task_id);
      alert('Task deleted successfully!');
      await refreshTasks();
      setModals({ ...modals, showDelete: false, currentTask: null });
    } catch (err) {
      setError(`Deletion failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      task_id: '',
      title: '',
      description: '',
      status: 'assigned',
    });
  };

  // Render helpers
  const renderStatusBadge = (status) => (
    <Badge
      bg={status === 'completed' ? 'success' : 'primary'}
      className="text-capitalize"
      style={{
        fontSize: 14,
        padding: '8px 16px',
        borderRadius: 20,
        fontWeight: 600,
        textTransform: 'uppercase',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {status}
    </Badge>
  );

  // DataTable columns
  const taskColumns = [
    {
      field: 'title',
      header: 'Task Title',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'description',
      header: 'Description',
      render: (t) => t.description || <span className="text-muted">No description</span>,
    },
    {
      field: 'status',
      header: 'Status',
      render: (t) => renderStatusBadge(t.status),
    },
    {
      field: 'read_by_list',
      header: 'Read By',
      render: (t) => {
        const normalized = normalizeEmployeeEntries(t.read_by_list);
        const readList = normalized.length ? getEmployeeNames(normalized) : '';
        if (!readList) return <span className="text-muted">Not read yet</span>;
        return (
          <span>
            {readList}
            <Badge
              bg="info"
              className="ms-2"
              style={{ borderRadius: 20, padding: '6px 12px', fontWeight: 600 }}
            >
              {t.read_by_count ?? normalized.length}
            </Badge>
          </span>
        );
      },
    },
    {
      field: 'checked_by_list',
      header: 'Checked By',
      render: (t) => {
        const normalized = normalizeEmployeeEntries(t.checked_by_list);
        const checkedList = normalized.length ? getEmployeeNames(normalized) : '';
        if (!checkedList) return <span className="text-muted">Not checked yet</span>;
        return (
          <span>
            {checkedList}
            <Badge
              bg="info"
              className="ms-2"
              style={{ borderRadius: 20, padding: '6px 12px', fontWeight: 600 }}
            >
              {t.checked_by_count ?? normalized.length}
            </Badge>
          </span>
        );
      },
    },
    {
      field: 'done_by',
      header: 'Done By',
      render: (t) => {
        // done_by is a single employee ID, not an array
        if (!t.done_by) return <span className="text-muted">Not done yet</span>;
        const employeeName = resolveEmployeeName(t.done_by);
        return (
          <span>
            <Badge
              bg="success"
              style={{ borderRadius: 20, padding: '6px 12px', fontWeight: 600 }}
            >
              {employeeName}
            </Badge>
          </span>
        );
      },
    },
    {
      field: 'assigned_at',
      header: 'Assigned Date',
      style: { fontFamily: 'monospace', fontSize: 15, color: '#888' },
      render: (t) =>
        t.assigned_at ? (
          new Date(t.assigned_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        ) : (
          <span className="text-muted">N/A</span>
        ),
    },
    {
      field: 'actions',
      header: 'Actions',
      render: (task) => (
        <div className="d-flex gap-2">
          {/* Detail button -> go to history */}
          <Button
            variant="outline-info"
            size="sm"
            onClick={() => navigate(`/history/${task.task_id}`)}
            disabled={isSubmitting}
            style={{ borderRadius: 12 }}
          >
            <i className="fas fa-info-circle"></i>
          </Button>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => handleEditTask(task)}
            disabled={isSubmitting}
            style={{ borderRadius: 12 }}
          >
            <i className="fas fa-edit"></i>
          </Button>
          <Button
            variant="outline-success"
            size="sm"
            onClick={async () => {
              try {
                await updateTask({
                  task_id: task.task_id,
                  title: task.title,
                  description: task.description || '',
                  status: 'completed',
                });
                alert('Task marked as completed!');
                await refreshTasks();
              } catch (err) {
                setError(`Failed to complete task: ${err.message}`);
              }
            }}
            disabled={isSubmitting}
            style={{ borderRadius: 12 }}
          >
            <i className="fas fa-check"></i>
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => setModals({ ...modals, showDelete: true, currentTask: task })}
            disabled={isSubmitting}
            style={{ borderRadius: 12 }}
          >
            <i className="fas fa-trash"></i>
          </Button>
        </div>
      ),
    },
  ];

  // Render
  if (loading) {
    return (
      <Container
        fluid
        className="p-4 d-flex justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="ms-3">Loading cached data…</span>
      </Container>
    );
  }

  return (
    <Container
      fluid
      className="p-4"
      style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}
    >
      {/* Header + Refresh indicator */}
      <div className="d-flex justify-content-between align-items-center mb-5">
        <h2 style={{ fontWeight: 800, color: '#23272b', letterSpacing: 1.5 }}>
          <i className="fas fa-tasks me-3 text-primary"></i>
          Task Management
        </h2>
        {refreshing && (
          <Badge bg="info" className="d-flex align-items-center">
            <Spinner animation="border" size="sm" className="me-2" />
            Refreshing…
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* FORM CARD */}
      <Row className="g-4 mb-4">
        <Col md={12}>
          <Card className="shadow-lg border-0" style={{ borderRadius: 20 }}>
            <Card.Header
              style={{
                background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
                borderBottom: 'none',
                padding: '1.5rem 2rem',
              }}
            >
              <h5 className="mb-0" style={{ fontWeight: 800, color: '#23272b' }}>
                <i
                  className={`fas ${
                    modals.showEdit ? 'fa-edit text-warning' : 'fa-plus-circle text-success'
                  } me-2`}
                ></i>
                {modals.showEdit ? 'Edit Task' : 'Create New Task'}
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                {/* Title */}
                <Row className="mb-4">
                  <Form.Group as={Col} controlId="formTaskTitle">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                      Task Title *
                    </Form.Label>
                    <Form.Control
                      type="text"
                      name="title"
                      placeholder="Enter task title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      style={{
                        borderRadius: 12,
                        background: '#fff',
                        fontSize: 16,
                        padding: '12px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        border: 'none',
                      }}
                    />
                  </Form.Group>
                </Row>

                {/* Description */}
                <Row className="mb-4">
                  <Form.Group as={Col} controlId="formTaskDescription">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                      Description
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      name="description"
                      rows={4}
                      placeholder="Enter task description"
                      value={formData.description}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      style={{
                        borderRadius: 12,
                        background: '#fff',
                        fontSize: 16,
                        padding: '12px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        border: 'none',
                      }}
                    />
                  </Form.Group>
                </Row>

                {/* Status */}
                <Row className="mb-4">
                  <Form.Group as={Col} md={6} controlId="formTaskStatus">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                      Status *
                    </Form.Label>
                    <Form.Select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                      disabled={isSubmitting}
                      style={{
                        borderRadius: 12,
                        background: '#fff',
                        fontSize: 16,
                        padding: '12px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        border: 'none',
                      }}
                    >
                      <option value="assigned">Assigned</option>
                      <option value="completed">Completed</option>
                    </Form.Select>
                  </Form.Group>
                </Row>

                {/* Submit / Cancel */}
                <div className="d-flex justify-content-end gap-2 mt-4">
                  {modals.showEdit && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        resetForm();
                        setModals({ ...modals, showEdit: false, currentTask: null });
                      }}
                      disabled={isSubmitting}
                      style={{
                        borderRadius: 12,
                        fontWeight: 700,
                        padding: '12px 24px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant={modals.showEdit ? 'warning' : 'success'}
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      borderRadius: 12,
                      fontWeight: 700,
                      padding: '12px 24px',
                      boxShadow: modals.showEdit
                        ? '0 4px 15px rgba(255,193,7,0.3)'
                        : '0 4px 15px rgba(25,135,84,0.3)',
                      background: modals.showEdit
                        ? 'linear-gradient(90deg, #ffc107 0%, #fd7e14 100%)'
                        : 'linear-gradient(90deg, #198754 0%, #0f5132 100%)',
                      border: 'none',
                    }}
                  >
                    {isSubmitting ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <i
                          className={`fas ${modals.showEdit ? 'fa-sync' : 'fa-save'} me-2`}
                        ></i>
                        {modals.showEdit ? 'Update Task' : 'Create Task'}
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* TASKS TABLE */}
      <Row>
        <Col md={12}>
          <div
            className="card shadow-lg border-0 mb-4"
            style={{
              borderRadius: 20,
              background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
              boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
              overflow: 'hidden',
            }}
          >
            <div className="card-body p-0">
              <DataTable
                data={tasks}
                columns={taskColumns}
                keyField="task_id"
                title="Existing Tasks"
                icon="tasks"
                variant="primary"
                searchable
                pagination
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* DELETE MODAL */}
      <Modal
        show={modals.showDelete}
        onHide={() => setModals({ ...modals, showDelete: false })}
        centered
      >
        <Modal.Header
          closeButton
          style={{
            borderBottom: 'none',
            background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
          }}
        >
          <Modal.Title style={{ fontWeight: 800, color: '#dc3545' }}>
            Confirm Deletion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
          }}
        >
          Are you sure you want to delete the task "
          <strong>{modals.currentTask?.title}</strong>"? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer
          style={{
            borderTop: 'none',
            background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
          }}
        >
          <Button
            variant="secondary"
            onClick={() => setModals({ ...modals, showDelete: false })}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteTask} disabled={isSubmitting}>
            {isSubmitting ? <Spinner animation="border" size="sm" /> : 'Delete Task'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CreateTask;