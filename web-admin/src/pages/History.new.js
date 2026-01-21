// History.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Alert,
  Modal,
  Form,
  Row,
  Col,
  Container,
  Badge,
  Spinner,
} from 'react-bootstrap';
import { getHistory, updateHistory, deleteHistory, getItems, updateItem } from '../api';
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
const CACHE_KEY = 'history_cached_data';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({ qty: '', action: '' });
  const [currentItemStock, setCurrentItemStock] = useState(0); // 🔑 Tambah state untuk current stock
  const [filter, setFilter] = useState({
    from: '',
    to: '',
    query: '',
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
      console.warn('Failed to cache history', e);
    }
  };

  // ---------------------------------------------------------------
  // Load history (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadHistory = useCallback(async (params = {}, forceRefresh = false) => {
    // 1. Load from cache (only on first mount)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (Array.isArray(cached)) {
        console.log('📦 Loading from cache:', cached.length, 'items');
        setHistory(cached);
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      console.log('🔄 Fetching fresh history...');
      const data = await getHistory(params);
      const safeData = Array.isArray(data) ? data : [];

      console.log('✅ Fresh data received:', safeData.length, 'items');

      // Only update if changed
      setHistory((prev) => {
        const hasChanged = !deepEqual(prev, safeData);
        console.log('📊 Data changed:', hasChanged);
        return hasChanged ? safeData : prev;
      });

      // Save to cache
      saveToCache(safeData);
    } catch (err) {
      console.error('❌ Load history error:', err);
      setError('Failed to load history');
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    // 🔑 Cek apakah cache perlu di-clear (dari Items.js)
    const shouldForceRefresh = !localStorage.getItem(CACHE_KEY);
    loadHistory({}, shouldForceRefresh);
  }, [loadHistory]);

  // 🔑 Listen untuk update dari Items page
  useEffect(() => {
    const handleHistoryUpdate = () => {
      console.log('🔔 History update detected from Items, refreshing...');
      loadHistory({}, true); // Force refresh
    };

    window.addEventListener('historyUpdated', handleHistoryUpdate);
    
    return () => {
      window.removeEventListener('historyUpdated', handleHistoryUpdate);
    };
  }, [loadHistory]);

  // 🔑 Tambah: Auto-refresh setiap 30 detik untuk catch updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        console.log('🔄 Auto-refreshing history...');
        loadHistory({}, true);
      }
    }, 30000); // 30 detik

    return () => clearInterval(interval);
  }, [loading, loadHistory]);

  // Refresh after CRUD
  const refreshHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getHistory();
      const safeData = Array.isArray(data) ? data : [];
      setHistory(safeData);
      saveToCache(safeData);
    } catch (err) {
      setError('Failed to refresh history');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Client-side filtering
  // ---------------------------------------------------------------
  const filteredHistory = history.filter((item) => {
    const q = filter.query.trim().toLowerCase();
    if (!q) return true;
    const itemName = String(item.item_name ?? '').toLowerCase();
    const employeeName = String(item.employee_name ?? '').toLowerCase();
    return itemName.includes(q) || employeeName.includes(q);
  });

  const dateFilteredHistory = filteredHistory.filter((item) => {
    if (!filter.from && !filter.to) return true;
    const itemDate = new Date(item.timestamp);
    let fromOk = true,
      toOk = true;
    if (filter.from)
      fromOk = itemDate >= new Date(filter.from + 'T00:00:00');
    if (filter.to) toOk = itemDate <= new Date(filter.to + 'T23:59:59');
    return fromOk && toOk;
  });

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  const handleEdit = async (entry) => {
    setEditEntry(entry);
    
    // 🔑 Perhitungan qty berdasarkan action dan stock_before/stock_after
    let valueToEdit = 0;
    
    if (entry.action === 'deduct') {
      // Untuk deduct: ambil qty langsung dari entry.qty
      valueToEdit = entry.qty;
    } else if (entry.action === 'add') {
      // Untuk add: qty = stock_after - stock_before
      valueToEdit = Math.max(0, entry.stock_after - entry.stock_before);
    } else if (entry.action === 'min') {
      // Untuk min: qty = stock_before - stock_after
      valueToEdit = Math.max(0, entry.stock_before - entry.stock_after);
    }
    
    setEditForm({
      qty: valueToEdit,
      action: entry.action,
    });
    
    // 🔑 Fetch current stock dari items table
    try {
      const items = await getItems();
      const currentItem = items.find(item => item.id === entry.item_id);
      setCurrentItemStock(currentItem?.stock ?? 0);
      console.log('[UI] Current item stock from items table:', currentItem?.stock);
    } catch (err) {
      console.error('[UI] Failed to fetch current item stock:', err);
      setCurrentItemStock(0);
    }
    
    setShowEditModal(true);
  };

  const handleDelete = async (entry) => {
    if (
      window.confirm(
        `Are you sure you want to delete this history entry?\n\n${JSON.stringify(
          entry,
          null,
          2
        )}`
      )
    ) {
      setLoading(true);
      setError('');
      try {
        await deleteHistory(entry.id);
        await refreshHistory();
      } catch (err) {
        setError('Failed to delete history entry');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditFormChange = (e) => {
    let value = e.target.value;
    
    // 🔑 Validasi: qty tidak boleh negatif
    if (e.target.name === 'qty' && Number(value) < 0) {
      value = '0';
    }
    
    setEditForm((f) => ({
      ...f,
      [e.target.name]: value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('[UI] Submitting edit form:', editForm);
    console.log('[UI] Edit entry before:', editEntry);

    try {
      const newValue = Number(editForm.qty);
      
      const payload = {
        id: editEntry.id,
        action: editForm.action,
      };

      if (editEntry.action === 'deduct') {
        payload.qty = newValue;
        console.log('[UI] Updating qty for deduct:', {
          oldQty: editEntry.qty,
          newQty: newValue,
        });

        await updateHistory(payload);
        console.log('[UI] Update history success');

        // 🔑 Logika diperbaiki: 
        // Jika qty BERTAMBAH (lebih banyak dikeluarkan) → stok BERKURANG
        // Jika qty BERKURANG (lebih sedikit dikeluarkan) → stok BERTAMBAH
        const qtyDifference = editEntry.qty - newValue; // terbalik: old - new
        const newItemStock = currentItemStock + qtyDifference;
        
        console.log('[UI] Updating item stock:', {
          itemId: editEntry.item_id,
          currentStock: currentItemStock,
          oldQty: editEntry.qty,
          newQty: newValue,
          qtyDifference: qtyDifference,
          newStock: newItemStock,
          explanation: newValue > editEntry.qty 
            ? 'Qty bertambah (lebih banyak dikeluarkan) → stok berkurang'
            : 'Qty berkurang (lebih sedikit dikeluarkan) → stok bertambah'
        });

        try {
          await updateItem({
            id: editEntry.item_id,
            stock: newItemStock,
          });
          console.log('[UI] Update item stock success');
          
          window.dispatchEvent(new Event('itemsUpdated'));
        } catch (itemErr) {
          console.error('[UI] Item update failed:', itemErr);
          setError('History updated but item stock update failed. Please refresh items.');
        }

      } else {
        payload.stock_after = newValue;
        console.log('[UI] Updating stock_after:', {
          oldStockAfter: editEntry.stock_after,
          newStockAfter: newValue,
        });

        await updateHistory(payload);
        console.log('[UI] Update history success');
      }

      setShowEditModal(false);
      await refreshHistory();
    } catch (err) {
      console.error('[UI] Update failed:', err);
      setError('Failed to update history entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleFilterChange = (e) => {
    setFilter((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFilterApply = () => {
    // Filters are client-side only
  };

  // ---------------------------------------------------------------
  // Load items data
  // ---------------------------------------------------------------
  // useEffect(() => {
  //   const loadItemsData = async () => {
  //     try {
  //       const itemsData = await getItems();
  //       setItems(Array.isArray(itemsData) ? itemsData : []);
  //       console.log('✅ Items loaded:', itemsData);
  //     } catch (err) {
  //       console.error('❌ Failed to load items:', err);
  //     }
  //   };
    
  //   loadItemsData();
  // }, []);

  // ---------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------
  const columns = [
    {
      field: 'timestamp',
      header: 'Date',
      style: { width: 180, fontFamily: 'monospace', fontSize: 15, color: '#888' },
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#888' }}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
        </span>
      ),
    },
    {
      field: 'employee_name',
      header: 'Employee Name',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'item_name',
      header: 'Item Name',
      style: { fontWeight: 700, color: '#23272b' },
      render: (historyItem) => (
        <span style={{ fontWeight: 700, color: '#23272b' }}>
          {historyItem.item_name}
        </span>
      ),
    },
    {
      field: 'action',
      header: 'Action',
      render: (item) => {
        let badgeClass = 'bg-success';
        
        // Logika warna badge
        if (item.action === 'add' || item.action === 'min') {
          // Jika action add atau min, cek stock_before
          if (item.stock_before === 0) {
            badgeClass = item.action === 'add' ? 'bg-success' : 'bg-info'; 
          } else {
            badgeClass = item.action === 'add' ? 'bg-success' : 'bg-danger';
          }
        } else if (item.action === 'deduct') {
          badgeClass = 'bg-danger';
        }
        
        return (
          <span
            className={`badge ${badgeClass}`}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              borderRadius: 20,
              fontWeight: 600,
              textTransform: 'uppercase',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {item.action}
          </span>
        );
      },
    },
    {
      field: 'stock_changes',
      header: 'Stock Change',
      render: (item) => {
        // 🔑 Hitung display qty dari stock_before/stock_after
        let displayQty = 0;
        
        if (item.action === 'deduct') {
          displayQty = item.qty;
        } else if (item.action === 'add') {
          displayQty = Math.max(0, item.stock_after - item.stock_before);
        } else if (item.action === 'min') {
          displayQty = Math.max(0, item.stock_before - item.stock_after);
        }
        
        const isBerkurang = item.action === 'min';
        const isDeduct = item.action === 'deduct';
        
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 'bold',
              color: item.action === 'add' ? '#198754' : item.action === 'min' ? '#0dcaf0' : '#dc3545'
            }}>
              {isBerkurang ? 'Berkurang: ' : isDeduct ? 'Dikeluarkan: ' : item.action === 'add' ? 'Bertambah: ' : 'Stock: '}
              <span style={{ fontFamily: 'monospace', fontSize: 16 }}>
                {displayQty ?? 0}
              </span>
            </div>
          </div>
        );
      },
      style: { textAlign: 'center', minWidth: 150 },
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
        <span className="mt-3 text-muted">Loading cached history…</span>
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
            className="fas fa-history me-3 text-success"
            style={{ animation: 'bounce 2s infinite' }}
          ></i>
          History
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
            onClick={() => loadHistory({}, true)}
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
            <i className="fas fa-sync-alt me-2"></i> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <div
        className="card mb-4 p-4"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
          boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
        }}
      >
        <Form>
          <Row className="align-items-end g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>From</Form.Label>
                <Form.Control
                  type="date"
                  name="from"
                  value={filter.from}
                  onChange={handleFilterChange}
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
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Until</Form.Label>
                <Form.Control
                  type="date"
                  name="to"
                  value={filter.to}
                  onChange={handleFilterChange}
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
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Search</Form.Label>
                <Form.Control
                  type="text"
                  name="query"
                  placeholder="Search by item or employee name..."
                  value={filter.query}
                  onChange={handleFilterChange}
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
            <Col md={2}>
              <Button
                variant="primary"
                className="w-100"
                style={{
                  borderRadius: 12,
                  fontWeight: 700,
                  padding: '12px 16px',
                  boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
                  background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
                  transition: 'all 0.3s ease',
                }}
                onClick={handleFilterApply}
                disabled={loading}
                type="button"
              >
                Apply Filter
              </Button>
            </Col>
          </Row>
        </Form>
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
            data={dateFilteredHistory}
            columns={columns}
            keyField="id"
            actions
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
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
              color: '#27ae60',
              letterSpacing: 0.5,
              textShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Edit History Entry
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body
            style={{
              background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              padding: '2rem',
            }}
          >
            {editEntry?.action === 'deduct' && (
              <>
                <div style={{
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: '1.5rem',
                  fontSize: 13,
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Edit Deduct:</strong> Mengubah quantity akan mempengaruhi stok item
                </div>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b', marginBottom: '0.5rem' }}>
                    Quantity Saat Ini
                  </Form.Label>
                  <div style={{
                    borderRadius: 12,
                    background: '#f0f0f0',
                    fontSize: 18,
                    fontWeight: 700,
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: '2px solid #ddd',
                    color: '#333',
                    fontFamily: 'monospace',
                  }}>
                    {editEntry?.qty ?? 0}
                  </div>
                  <Form.Text style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>
                    📊 Jumlah barang yang dikeluarkan sebelum perubahan
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 700, color: '#23272b', marginBottom: '0.5rem' }}>
                    Quantity Dikeluarkan Baru
                  </Form.Label>
                  <Form.Control
                    name="qty"
                    type="number"
                    min="0"
                    value={editForm.qty}
                    onChange={handleEditFormChange}
                    required
                    disabled={loading}
                    style={{
                      borderRadius: 12,
                      background: '#fff',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: '2px solid #007bff',
                      fontWeight: 600,
                    }}
                    className="hover-scale-input"
                  />
                  <Form.Text style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>
                    💡 Masukkan jumlah barang yang dikeluarkan (baru) - Minimum: 0
                  </Form.Text>
                </Form.Group>

                {Number(editForm.qty) !== Number(editEntry?.qty) && (
                  <div style={{
                    background: '#e7f3ff',
                    border: '2px solid #0d6efd',
                    borderRadius: 12,
                    padding: '16px',
                    marginBottom: '1.5rem',
                    fontSize: 13,
                  }}>
                    <strong style={{ color: '#004085', fontSize: 14 }}>📈 Preview Perubahan Stok:</strong>
                    <div style={{ marginTop: 12, lineHeight: 1.8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>Qty Lama:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#666' }}>
                          {editEntry?.qty ?? 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>Qty Baru:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d6efd' }}>
                          {editForm.qty || 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #0d6efd' }}>
                        <span style={{ fontWeight: 600 }}>Selisih Qty:</span>
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 700,
                          color: Number(editForm.qty) > Number(editEntry?.qty) ? '#dc3545' : '#198754'
                        }}>
                          {Number(editForm.qty) > Number(editEntry?.qty) ? '+' : ''}{Number(editForm.qty) - Number(editEntry?.qty)}
                          <span style={{ fontSize: 11, marginLeft: 4 }}>
                            {Number(editForm.qty) > Number(editEntry?.qty) ? '(lebih banyak dikeluarkan)' : '(lebih sedikit dikeluarkan)'}
                          </span>
                        </span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>Stok Item Saat Ini:</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {currentItemStock}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>Perubahan Stok:</span>
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontWeight: 700,
                            color: Number(editForm.qty) > Number(editEntry?.qty) ? '#dc3545' : '#198754'
                          }}>
                            {Number(editForm.qty) > Number(editEntry?.qty) ? '-' : '+'}{Math.abs(Number(editForm.qty) - Number(editEntry?.qty))}
                            <span style={{ fontSize: 11, marginLeft: 4 }}>
                              {Number(editForm.qty) > Number(editEntry?.qty) ? '(stok berkurang)' : '(stok bertambah)'}
                            </span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>Stok Item Setelah Update:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#666' }}>
                              {currentItemStock}
                            </span>
                            <span style={{ fontWeight: 700, color: '#666' }}>→</span>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontWeight: 700,
                              color: Number(editForm.qty) > Number(editEntry?.qty) ? '#dc3545' : '#198754',
                              fontSize: 16,
                              padding: '4px 8px',
                              background: Number(editForm.qty) > Number(editEntry?.qty) ? '#f8d7da' : '#d4edda',
                              borderRadius: 6
                            }}>
                              {currentItemStock + (Number(editEntry?.qty) - Number(editForm.qty))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {editEntry?.action !== 'deduct' && (
              <>
                {/* 🔑 Untuk add/min: hitung qty dari stock_before dan stock_after */}
                {(() => {
                  const calculatedQty = editEntry?.action === 'add' 
                    ? Math.max(0, editEntry?.stock_after - editEntry?.stock_before)
                    : editEntry?.action === 'min'
                    ? Math.max(0, editEntry?.stock_before - editEntry?.stock_after)
                    : 0;
                  
                  return (
                    <>
                      <Form.Group className="mb-4">
                        <Form.Label style={{ fontWeight: 700, color: '#23272b', marginBottom: '0.5rem' }}>
                          Quantity Saat Ini ({editEntry?.action === 'add' ? 'Bertambah' : 'Berkurang'})
                        </Form.Label>
                        <div style={{
                          borderRadius: 12,
                          background: '#f0f0f0',
                          fontSize: 18,
                          fontWeight: 700,
                          padding: '12px 16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                          border: '2px solid #ddd',
                          color: '#333',
                          fontFamily: 'monospace',
                        }}>
                          {calculatedQty}
                        </div>
                        <Form.Text style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>
                          📊 Dihitung dari: {editEntry?.action === 'add' 
                            ? `${editEntry?.stock_after} - ${editEntry?.stock_before}` 
                            : `${editEntry?.stock_before} - ${editEntry?.stock_after}`}
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label style={{ fontWeight: 700, color: '#23272b', marginBottom: '0.5rem' }}>
                          Quantity Baru
                        </Form.Label>
                        <Form.Control
                          name="qty"
                          type="number"
                          min="0"
                          value={editForm.qty}
                          onChange={handleEditFormChange}
                          required
                          disabled={loading}
                          style={{
                            borderRadius: 12,
                            background: '#fff',
                            fontSize: 16,
                            padding: '12px 16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            border: '2px solid #007bff',
                            fontWeight: 600,
                          }}
                          className="hover-scale-input"
                        />
                        <Form.Text style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>
                          💡 Masukkan jumlah perubahan stok yang baru
                        </Form.Text>
                      </Form.Group>

                      {Number(editForm.qty) !== calculatedQty && (
                        <div style={{
                          background: '#e7f3ff',
                          border: '2px solid #0d6efd',
                          borderRadius: 12,
                          padding: '16px',
                          marginBottom: '1.5rem',
                          fontSize: 13,
                        }}>
                          <strong style={{ color: '#004085', fontSize: 14 }}>📈 Preview Perubahan:</strong>
                          <div style={{ marginTop: 12, lineHeight: 1.8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                              <span style={{ fontWeight: 600 }}>Qty Lama:</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#666' }}>
                                {calculatedQty}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                              <span style={{ fontWeight: 600 }}>Qty Baru:</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d6efd' }}>
                                {editForm.qty || 0}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #0d6efd' }}>
                              <span style={{ fontWeight: 600 }}>Selisih Qty:</span>
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 700,
                                color: Number(editForm.qty) > calculatedQty ? '#dc3545' : '#198754'
                              }}>
                                {Number(editForm.qty) > calculatedQty ? '+' : ''}{Number(editForm.qty) - calculatedQty}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Action</Form.Label>
              <Form.Control
                name="action"
                value={editForm.action ?? ''}
                onChange={handleEditFormChange}
                required
                disabled={true}
                style={{
                  borderRadius: 12,
                  background: '#f8fafd',
                  fontSize: 16,
                  padding: '12px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: 'none',
                  color: '#888',
                }}
                className="hover-scale-input"
              />
              <Form.Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                🔒 Action tidak dapat diubah
              </Form.Text>
            </Form.Group>
            {columns
              .filter((col) => !['qty', 'action', 'stock_changes'].includes(col.field))
              .map((col) => (
                <Form.Group className="mb-4" key={col.field}>
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>{col.header}</Form.Label>
                  <Form.Control
                    type="text"
                    value={editEntry ? editEntry[col.field] : ''}
                    readOnly
                    style={{
                      borderRadius: 12,
                      background: '#f8fafd',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                      color: '#888',
                    }}
                  />
                </Form.Group>
              ))}
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
              onClick={() => setShowEditModal(false)}
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
              variant="success"
              type="submit"
              disabled={loading}
              style={{
                borderRadius: 12,
                fontWeight: 700,
                padding: '12px 24px',
                boxShadow: '0 4px 15px rgba(25,135,84,0.3)',
                background: 'linear-gradient(90deg, #198754 0%, #0f5132 100%)',
                transition: 'all 0.3s ease',
              }}
              className="hover-scale"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default History;