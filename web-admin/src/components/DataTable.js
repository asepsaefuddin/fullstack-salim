import React, { useState } from 'react';
import { Table, Button, Form, Pagination, Badge } from 'react-bootstrap';

const DataTable = ({ 
  data, 
  columns, 
  keyField, 
  searchable = true, 
  pagination = true,
  actions = false,
  onEdit = () => {},
  onDelete = () => {},
  onView = () => {}
}) => {
  // Defensive: always use an array
  const safeData = Array.isArray(data) ? data : [];

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtering
  const filteredData = safeData.filter(item =>
    columns.some(col =>
      String(item[col.field] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = pagination
    ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredData;

  // Render cell helper
  const renderCell = (item, col) => {
    if (col.render) return col.render(item);
    if (col.badge) return (
      <Badge 
        bg={col.badge} 
        style={{ 
          fontSize: 14, 
          padding: '8px 16px', 
          borderRadius: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        {item[col.field]}
      </Badge>
    );
    return item[col.field];
  };

  return (
    <div
      className="data-table-container"
      style={{
        background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
        borderRadius: 20,
        boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
        padding: 32,
        marginBottom: 32,
        border: 'none',
        animation: 'fadeInUp 0.5s ease-out'
      }}
    >
      {searchable && (
        <Form.Group className="mb-4">
          <div className="d-flex align-items-center">
            <Form.Control
              type="text"
              placeholder="🔍 Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="me-2 hover-scale-input"
              style={{
                borderRadius: 12,
                border: 'none',
                background: '#fff',
                fontSize: 16,
                padding: '12px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease'
              }}
            />
            <Button
              variant="outline-secondary"
              onClick={() => setSearchTerm('')}
              style={{
                borderRadius: 12,
                border: 'none',
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                padding: '12px 16px',
                transition: 'all 0.3s ease'
              }}
              className="hover-scale"
            >
              <i className="fas fa-times"></i>
            </Button>
          </div>
        </Form.Group>
      )}

      <div className="table-responsive">
        <Table
          striped
          bordered={false}
          hover
          className="mb-0 table-hover"
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            background: 'transparent',
            fontSize: 15
          }}
        >
          <thead style={{ background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)' }}>
            <tr>
              {columns.map(col => (
                <th
                  key={col.field}
                  style={{
                    ...col.style,
                    fontWeight: 700,
                    color: '#3498db',
                    background: 'transparent',
                    borderBottom: '2px solid rgba(240,244,250,0.5)',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '15px 20px'
                  }}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th
                  style={{
                    width: '120px',
                    fontWeight: 700,
                    color: '#3498db',
                    background: 'transparent',
                    borderBottom: '2px solid rgba(240,244,250,0.5)',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '15px 20px'
                  }}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map(item => (
                <tr key={item[keyField]} style={{ verticalAlign: 'middle', transition: 'all 0.3s ease' }}>
                  {columns.map(col => (
                    <td key={`${item[keyField]}-${col.field}`} style={{ 
                      verticalAlign: 'middle', 
                      padding: '15px 20px',
                      fontWeight: 500
                    }}>
                      {renderCell(item, col)}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-nowrap" style={{ verticalAlign: 'middle', padding: '15px 20px' }}>
                      {/* {onView && (
                        <Button
                          variant="info"
                          size="sm"
                          className="me-2 hover-scale"
                          style={{ 
                            borderRadius: 10, 
                            fontWeight: 600,
                            padding: '8px 12px',
                            boxShadow: '0 2px 8px rgba(23,162,184,0.3)'
                          }}
                          onClick={() => onView(item)}
                        >
                          <i className="fas fa-eye"></i>
                        </Button>
                      )} */}
                      {onEdit && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="me-2 hover-scale"
                          style={{ 
                            borderRadius: 10, 
                            fontWeight: 600,
                            padding: '8px 12px',
                            boxShadow: '0 2px 8px rgba(52,152,219,0.3)',
                            background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)'
                          }}
                          onClick={() => onEdit(item)}
                        >
                          <i className="fas fa-edit"></i>
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          style={{ 
                            borderRadius: 10, 
                            fontWeight: 600,
                            padding: '8px 12px',
                            boxShadow: '0 2px 8px rgba(220,53,69,0.3)',
                            background: 'linear-gradient(90deg, #dc3545 0%, #c82333 100%)'
                          }}
                          className="hover-scale"
                          onClick={() => onDelete(item)}
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center text-muted py-5"
                  style={{ 
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                    fontSize: 16,
                    fontWeight: 600
                  }}
                >
                  <i className="fas fa-box-open fa-2x mb-2 empty-state-icon" style={{ 
                    color: '#6c757d',
                    textShadow: '0 2px 10px rgba(108,117,125,0.2)'
                  }}></i>
                  <div>No data found</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div className="text-muted" style={{ fontSize: 15, fontWeight: 500 }}>
            Showing {Math.min(paginatedData.length, itemsPerPage)} of {filteredData.length} items
          </div>
          <Pagination className="mb-0">
            <Pagination.Prev
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              style={{
                borderRadius: 50,
                border: 'none',
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease'
              }}
              className="hover-scale"
            />
            {[...Array(totalPages)].map((_, index) => (
              <Pagination.Item
                key={index + 1}
                active={index + 1 === currentPage}
                onClick={() => setCurrentPage(index + 1)}
                style={{
                  borderRadius: 50,
                  fontWeight: 700,
                  minWidth: 40,
                  textAlign: 'center',
                  border: 'none',
                  background: index + 1 === currentPage 
                    ? 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)' 
                    : '#fff',
                  color: index + 1 === currentPage ? '#fff' : '#23272b',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s ease'
                }}
                className="hover-scale"
              >
                {index + 1}
              </Pagination.Item>
            ))}
            <Pagination.Next
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              style={{
                borderRadius: 50,
                border: 'none',
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease'
              }}
              className="hover-scale"
            />
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default DataTable;