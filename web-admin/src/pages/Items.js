// Items.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Form,
  Modal,
  Alert,
  Row,
  Col,
  Container,
  Badge,
  Spinner,
} from 'react-bootstrap';
import { getItems, addItem, updateItem, deleteItem, addHistory } from '../api';
import DataTable from '../components/DataTable';

// -------------------------------------------------------------------
// Deep equality helper
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
const CACHE_KEY = 'items_cached_data';

const Items = () => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    stock: '',
    min_stock: '',
    barcode: '',
  });
  const [adjustmentMode, setAdjustmentMode] = useState('set');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [initialStock, setInitialStock] = useState(0); // 🔑 Tambah state ini
  const [refreshKey, setRefreshKey] = useState(0); // 🔑 Tambah state untuk force re-render

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
      console.warn('Failed to cache items', e);
    }
  };

  // ---------------------------------------------------------------
  // Load items (cache first to API to update cache)
  // ---------------------------------------------------------------
  const loadItems = useCallback(async (forceRefresh = false) => {
    console.log('🔄 Loading items, forceRefresh:', forceRefresh);
    
    // 1. Load from cache (only on first mount)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (Array.isArray(cached)) {
        console.log('📦 Using cached items:', cached.length);
        setItems(cached);
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const response = await getItems();
      const safeData = Array.isArray(response) ? response : [];

      console.log('✅ Fresh items from API:', safeData);
      console.log('🔍 First item stock:', safeData[0]?.stock);

      // 🔑 Force update tanpa compare
      setItems(safeData);
      saveToCache(safeData);
    } catch (err) {
      console.error('❌ Load items error:', err);
      setError('Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Refresh after CRUD
  const refreshItems = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getItems();
      const safeData = Array.isArray(response) ? response : [];
      
      console.log('🔄 Refresh items result:', safeData);
      
      // 🔑 Force update state tanpa deep equality check
      setItems(safeData);
      saveToCache(safeData);
      
      console.log('✅ Items state updated');
    } catch (err) {
      console.error('❌ Refresh items error:', err);
      setError('Failed to refresh items');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Get current user info
  // ---------------------------------------------------------------
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      console.log('🔍 Raw localStorage user:', userStr);
      
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('🔍 Parsed user object:', user);
        
        const currentUser = {
          id: user.id || user.employee_id || 'UNKNOWN',
          name: user.name || user.employee_name || user.username || 'Admin',
        };
        
        console.log('✅ Current user resolved:', currentUser);
        return currentUser;
      }
      
      console.warn('⚠️ No user found in localStorage');
    } catch (e) {
      console.error('❌ Failed to get user info:', e);
    }
    
    return { id: 'SYSTEM', name: 'System Admin' };
  };

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.name.trim()) {
        throw new Error('Item name is required');
      }

      const newStock = Number(formData.stock) || 0;
      const oldStock = initialStock;
      const currentUser = getCurrentUser();

      console.log('🔍 Stock comparison:', {
        oldStock,
        newStock,
        difference: newStock - oldStock,
      });

      const payload = {
        id: currentItem?.id,
        name: formData.name.trim(),
        category: formData.category.trim(),
        stock: newStock,
      };

      // 1️⃣ Update/Add item
      let savedItem;
      if (currentItem) {
        console.log('📝 Updating item:', payload);
        savedItem = await updateItem(payload);
      } else {
        console.log('📝 Adding new item:', payload);
        savedItem = await addItem(payload);
      }

      console.log('✅ Item saved:', savedItem);

      // 2️⃣ Tentukan action berdasarkan stock_before dan stock_after
      let action = null;
      let qty = 0;
      const stockBefore = oldStock;
      const stockAfter = newStock;

      if (currentItem) {
        // Edit item: tentukan action berdasarkan perubahan stock
        if (stockAfter !== stockBefore) {
          if (stockAfter > stockBefore) {
            // Stock bertambah = add
            action = 'add';
            qty = stockAfter - stockBefore;
          } else {
            // Stock berkurang = min
            action = 'min';
            qty = stockBefore - stockAfter;
          }
          console.log('✅ Action determined:', { 
            action, 
            qty, 
            stockBefore, 
            stockAfter,
            logic: stockAfter > stockBefore ? 'stock increased (add)' : 'stock decreased (min)'
          });
        } else {
          console.log('ℹ️ No stock change detected');
        }
      } else if (newStock > 0) {
        // Item baru dengan initial stock = add
        action = 'add';
        qty = newStock;
        console.log('✅ New item with initial stock:', { 
          action, 
          qty, 
          stockBefore: 0, 
          stockAfter: newStock 
        });
      }

      // 3️⃣ Insert history jika ada perubahan stock
      if (action && qty > 0 && savedItem) {
        const historyPayload = {
          employee_id: currentUser.id,
          employee_name: currentUser.name,
          item_id: savedItem.id,
          item_name: savedItem.name,
          action,
          qty,
          stock_before: stockBefore,
          stock_after: stockAfter,
        };

        console.log('📝 Creating history record:', historyPayload);

        await addHistory(historyPayload);

        console.log('✅ History recorded successfully');
        
        // Clear history cache
        localStorage.removeItem('history_cached_data');
        
        // Trigger event
        window.dispatchEvent(new CustomEvent('historyUpdated'));
      }

      // Clear cache
      localStorage.removeItem('items_cached_data');
      localStorage.removeItem('history_cached_data');
      
      // Close modal
      setShowModal(false);
      
      // Force refresh
      await loadItems(true);
      
      // 🔑 Force re-render DataTable
      setRefreshKey(prev => prev + 1);
      
      console.log('✅ All operations completed with force refresh');
      
    } catch (err) {
      console.error('❌ Submit error:', err);
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setCurrentItem(item);
    setInitialStock(item.stock); // 🔑 Simpan stock awal
    setFormData({
      name: item.name,
      category: item.category,
      stock: item.stock,
      min_stock: item.min_stock || 1,
      barcode: item.barcode || 1,
    });
    setAdjustmentMode('set');
    setAdjustmentValue('');
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      setLoading(true);
      setError('');
      try {
        await deleteItem(item.id);
        await refreshItems();
      } catch (err) {
        setError('Failed to delete item');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStockChange = () => {
    if (!adjustmentValue) return;

    const currentStock = parseFloat(formData.stock) || 0;
    const adjustment = parseFloat(adjustmentValue) || 0;

    let newStock;
    switch (adjustmentMode) {
      case 'add':
        newStock = currentStock + adjustment;
        break;
      case 'deduct':
        newStock = Math.max(0, currentStock - adjustment);
        break;
      default:
        newStock = adjustment;
    }

    setFormData({ ...formData, stock: newStock });
    setAdjustmentValue('');
  };

  // ---------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------
  const columns = [
    {
      field: 'id',
      header: 'ID',
      style: { width: '120px', color: '#888', fontWeight: 500 },
    },
    {
      field: 'name',
      header: 'Name',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'category',
      header: 'Category',
      style: { color: '#495057' },
    },
    {
      field: 'stock',
      header: 'Stock',
      render: (item) => (
        <span
          className={item.stock < 1 ? 'text-danger fw-bold low-stock-alert' : 'fw-bold'}
          style={{
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.stock}
          {item.stock < 1 && (
            <i
              className="fas fa-exclamation-circle ms-2"
              style={{ animation: 'pulse 2s infinite' }}
            ></i>
          )}
        </span>
      ),
      style: { textAlign: 'center' },
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
        <span className="mt-3 text-muted">Loading cached items…</span>
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
          <i
            className="fas fa-box me-3 text-primary"
            style={{ animation: 'bounce 2s infinite' }}
          ></i>
          Manage Items
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
            onClick={() => {
              setCurrentItem(null);
              setInitialStock(0); // 🔑 Reset initialStock untuk item baru
              setFormData({
                name: '',
                category: '',
                stock: '',
                min_stock: 1,
                barcode: 1,
              });
              setAdjustmentMode('set');
              setAdjustmentValue('');
              setShowModal(true);
            }}
            disabled={loading}
            style={{
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              padding: '12px 24px',
              boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
              transition: 'all 0.3..',
              background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
            }}
            className="hover-scale"
          >
            Add New Item
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
          Russell: 20,
          background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
          boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
          overflow: 'hidden',
        }}
      >
        <div className="card-body p-0">
          <DataTable
            key={refreshKey} // 🔑 Tambah key untuk force re-render
            data={items || []}
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
        onHide={() => setShowModal(false)}
        size="lg"
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
            {currentItem ? 'Edit Item' : 'Add New Item'}
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
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Item Name *</Form.Label>
              <Form.Control
                type="text"
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
            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Category</Form.Label>
                  <Form.Control
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
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
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Current Stock *</Form.Label>
                  <Form.Control
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    min="0"
                    required
                    readOnly
                    disabled={loading}
                    style={{
                      borderRadius: 12,
                      background: '#e9ecef',
                      fontSize: 16,
                      padding: '12px 16px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="border-top pt-4 mt-4" style={{ borderColor: 'rgba(240,244,250,0.5)' }}>
              <h5 className="mb-4" style={{ fontWeight: 700, color: '#23272b', letterSpacing: 0.5 }}>
                Adjust Stock
              </h5>
              <Row className="align-items-end">
                <Col md={4}>
                  <Form.Group className="mb-4">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Adjustment Type</Form.Label>
                    <Form.Select
                      value={adjustmentMode}
                      onChange={(e) => setAdjustmentMode(e.target.value)}
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
                      <option value="set">Set New Quantity</option>
                      <option value="add">Add Quantity</option>
                      <option value="deduct">Deduct Quantity</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-4">
                    <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>
                      {adjustmentMode === 'set'
                        ? 'New Quantity'
                        : adjustmentMode === 'add'
                        ? 'Quantity to Add'
                        : 'Quantity to Deduct'}
                    </Form.Label>
                    <Form.Control
                      type="number"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(e.target.value)}
                      min="0"
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
                </Col>
                <Col md={4}>
                  <Button
                    variant={adjustmentMode === 'deduct' ? 'outline-danger' : 'outline-primary'}
                    onClick={handleStockChange}
                    disabled={!adjustmentValue || loading}
                    className="w-100 hover-scale"
                    style={{
                      borderRadius: 12,
                      fontWeight: 700,
                      padding: '12px 16px',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    }}
                  >
                    {adjustmentMode === 'deduct' ? 'Deduct' : 'Apply'}
                  </Button>
                </Col>
              </Row>
            </div>
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
              onClick={() => setShowModal(false)}
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
              Cancel
            </Button>
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
              {loading ? 'Saving...' : 'Save Item'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Items;