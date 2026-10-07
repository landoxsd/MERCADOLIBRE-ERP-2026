/* src/app/auth/page.js */
'use client';
import { useState, useEffect } from 'react';
import styles from './auth.module.css';

export default function AuthPage() {
  const [authUrl, setAuthUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para el modo "V4 Skills" (Manual)
  const [manualCode, setManualCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  // URL de retorno autorizada registrada en MercadoLibre Developers
  const [redirectUri, setRedirectUri] = useState('https://enquiries-aviation-batteries-gaps.trycloudflare.com/api/auth/callback');
  const [existingAccounts, setExistingAccounts] = useState([]);

  useEffect(() => {
    fetch('/api/auth/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.accounts) setExistingAccounts(data.accounts);
      })
      .catch(err => console.error(err));
  }, []);

  const handleLogin = () => {
    window.location.href = `/api/auth/login?mode=login&redirectUri=${encodeURIComponent(redirectUri)}`;
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      // Usamos el redirectUri seleccionado para generar el link
      const res = await fetch(`/api/auth/login?mode=delegate&redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      setAuthUrl(data.authUrl);
    } catch (e) {
      console.error(e);
      alert("Error al generar el link.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManualCode = async () => {
    if (!manualCode) return;
    setSubmittingCode(true);
    try {
      // Enviamos el código AL CALLBACK directamente, pasando la URI que usamos para generarlo
      const res = await fetch(`/api/auth/callback?code=${manualCode.trim()}&redirectUri=${encodeURIComponent(redirectUri)}`);
      if (res.redirected) {
        window.location.href = res.url;
      } else {
        alert("El código parece haber expirado o es inválido.");
      }
    } catch (e) {
      alert("Error al vincular con el código proporcionado.");
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleCopy = () => {
    if (!authUrl) return;
    navigator.clipboard.writeText(authUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={`glass-panel ${styles.card}`}>
        <div className={styles.header}>
          <div className={styles.logo}><span>ML</span></div>
          <h1 className={styles.title}>Vincular Cuenta</h1>
          <p className={styles.subtitle}>Métodos Avanzados (V4 Skills)</p>
        </div>

        <div className={styles.configSection}>
          <label>URL de Retorno Autorizada:</label>
          <select
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            className={styles.select}
          >
            <option value="https://enquiries-aviation-batteries-gaps.trycloudflare.com/api/auth/callback">Servidor Dell R630 (Cloudflare HTTPS)</option>
            <option value="https://mercadolibre-erp.vercel.app/api/auth/callback">Antiguo (Vercel)</option>
          </select>
          <p className={styles.hint}>Usa Servidor Dell R630 (registrado en MercadoLibre Developers).</p>
        </div>

        <div className={styles.actions}>
          <button className={`btn-primary ${styles.loginBtn}`} onClick={handleLogin}>
            🚀 Iniciar enlace directo
          </button>

          <div className={styles.divider}><span>O USA EL MODO DELEGADO</span></div>

          <button
            className={`btn-glass ${styles.delegateBtn}`}
            onClick={handleGenerateLink}
            disabled={loading}
          >
            {loading ? 'Generando...' : '🔗 Generar Link para Cliente/Otro'}
          </button>

          {authUrl && (
            <div className={styles.delegatePanel}>
              <div className={styles.urlBox}>
                <span className={styles.urlText}>{authUrl}</span>
                <button className={`btn-primary ${styles.copyBtn}`} onClick={handleCopy}>
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              <div className={styles.instructions}>
                <h4>Instrucciones "Estilo V4":</h4>
                <ol>
                  <li>Envía el link a la persona.</li>
                  <li>Cuando autorice, será redirigida a la web seleccionada.</li>
                  <li>Pídele que copie el código final de la URL (después de <code>?code=</code>).</li>
                  <li>Pégalo aquí abajo:</li>
                </ol>
              </div>

              <div className={styles.manualEntry}>
                <input
                  type="text"
                  placeholder="Pega el código de autorización aquí..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className={styles.input}
                />
                <button
                  className={styles.submitBtn}
                  onClick={handleSubmitManualCode}
                  disabled={submittingCode || !manualCode}
                >
                  {submittingCode ? 'Vinculando...' : '✔️ Vincular ahora'}
                </button>
              </div>
            </div>
          )}
        </div>

        {existingAccounts.length > 0 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              onClick={() => {
                // Establecer cookie con la primera cuenta para poder entrar al dashboard
                const firstAccount = existingAccounts[0];
                document.cookie = `meli_erp_account=${firstAccount.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
                window.location.href = '/dashboard';
              }}
              className="btn-glass"
              style={{ display: 'block', width: '100%', padding: '1rem', border: '1px solid var(--primary)', cursor: 'pointer', background: 'transparent', color: 'inherit', fontSize: 'inherit' }}
            >
              🏠 Ir al Dashboard ({existingAccounts.length} cuentas vinculadas)
            </button>
          </div>
        )}

        <p className={styles.securityNote}>
          🔒 Método seguro compatible con bloqueos de CloudFront.
        </p>
      </div>
    </div>
  );
}
