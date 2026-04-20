'use client';
import { useState } from 'react';
import styles from './auth.module.css';

export default function AuthPage() {
  const [delegateUrl, setDelegateUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    window.location.href = '/api/auth/login?mode=login';
  };

  const handleDelegate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login?mode=delegate');
      const data = await res.json();
      setDelegateUrl(data.delegateUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!delegateUrl) return;
    navigator.clipboard.writeText(delegateUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className={styles.page}>
      {/* Orbes de fondo animados */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={`glass-panel ${styles.card}`}>
        {/* Logo / Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span>ML</span>
          </div>
          <h1 className={styles.title}>ERP Mercado Libre</h1>
          <p className={styles.subtitle}>Gestión Multicuenta Avanzada</p>
        </div>

        {/* Botón de Login Normal */}
        <div className={styles.actions}>
          <button
            id="btn-login-meli"
            className={`btn-primary ${styles.loginBtn}`}
            onClick={handleLogin}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            Iniciar Sesión con Mercado Libre
          </button>

          <div className={styles.divider}>
            <span>o</span>
          </div>

          {/* Botón de Login Delegado (como en Integraly) */}
          <button
            id="btn-delegate-login"
            className={`btn-glass ${styles.delegateBtn}`}
            onClick={handleDelegate}
            disabled={loading}
          >
            {loading ? 'Generando enlace...' : '🔗 Delegar Login a otra persona'}
          </button>

          {/* Panel con la URL generada */}
          {delegateUrl && (
            <div className={styles.delegatePanel}>
              <p className={styles.delegateInfo}>
                Comparte este enlace con el administrador de la cuenta (válido por 10 minutos):
              </p>
              <div className={styles.urlBox}>
                <span className={styles.urlText}>{delegateUrl}</span>
                <button
                  id="btn-copy-delegate-url"
                  className={`btn-primary ${styles.copyBtn}`}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copiado' : 'Copiar URL'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info de seguridad */}
        <p className={styles.securityNote}>
          🔒 Tus credenciales se almacenan encriptadas. Nunca compartimos tu información.
        </p>
      </div>
    </div>
  );
}
