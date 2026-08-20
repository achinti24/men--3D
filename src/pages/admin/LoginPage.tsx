import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as authService from '../../services/auth.service';
import { ApiError } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import './LoginPage.css';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await authService.register(email, password, fullName);
      }
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
        <p className="login-page__subtitle">Panel de administración de restaurantes.</p>

        <form className="admin-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="admin-form__field">
              Nombre completo
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} />
            </label>
          )}
          <label className="admin-form__field">
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
          </label>
          <label className="admin-form__field">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={200}
            />
          </label>

          {error && <ErrorMessage message={error} />}

          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="login-page__toggle">
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta?{' '}
              <button type="button" onClick={() => setMode('register')}>
                Crea una
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Ingresa
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
