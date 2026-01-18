import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Container, Card, Spinner } from 'react-bootstrap';
import { login } from '../api';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Pass email/password directly
      const userData = await login(email, password);
      if (userData && userData.role === "admin") {
        onLogin(userData);
        navigate('/');
      } else {
        throw new Error("Not an admin");
      }
    } catch (err) {
      setError('Invalid email, password, or not an admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{
        width: 400,
        padding: '32px 0 24px 0',
        borderRadius: 18,
        boxShadow: '0 8px 32px rgba(52,152,219,0.18)',
        border: 'none'
      }}>
        <Card.Body>
          <div className="text-center mb-4">
            <div style={{
              background: 'linear-gradient(135deg, #3498db 70%, #2980b9 100%)',
              borderRadius: '50%',
              width: 64,
              height: 64,
              margin: '0 auto 18px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(52,152,219,0.13)'
            }}>
              <i className="fas fa-user-shield fa-2x text-white"></i>
            </div>
            <Card.Title style={{ fontWeight: 700, fontSize: 28, color: '#3498db', letterSpacing: 1 }}>
              Admin Login
            </Card.Title>
            <div style={{ color: '#888', fontSize: 15, marginTop: 2, marginBottom: 8 }}>
              Enter your email and password
            </div>
          </div>

          <Form onSubmit={handleSubmit}>
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#23272b' }}>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  borderRadius: 10,
                  background: '#f0f4fa',
                  fontSize: 17,
                  padding: '14px 12px'
                }}
                autoFocus
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#23272b' }}>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  borderRadius: 10,
                  background: '#f0f4fa',
                  fontSize: 17,
                  padding: '14px 12px'
                }}
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              className="w-100"
              style={{
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 17,
                padding: '13px 0',
                boxShadow: '0 2px 8px rgba(52,152,219,0.10)'
              }}
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;