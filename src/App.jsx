import React, { useCallback, useEffect, useState } from 'react';
import formConfig from './data/formConfig.json';
import FormBuilder from './components/FormBuilder.jsx';

const DATA_SOURCE_URL = 'https://api.example.com/forms/configuration';

const App = () => {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDebugData, setIsDebugData] = useState(false);
  const env = import.meta.env ?? {};
  const isDebugMode = env.VITE_USE_DEBUG_CONFIG === 'true' || env.DEV;

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (isDebugMode) {
        setConfig(formConfig);
        setIsDebugData(true);
        return;
      }

      const response = await fetch(DATA_SOURCE_URL);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setConfig(data);
      setIsDebugData(false);
    } catch (error) {
      console.error('Failed to load form configuration', error);
      setErrorMessage('Unable to load the live form configuration. Showing debug data instead.');
      setConfig(formConfig);
      setIsDebugData(true);
    } finally {
      setIsLoading(false);
    }
  }, [isDebugMode]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            GF
          </span>
          <span className="brand-name">GrantFlow Portal</span>
        </div>
        <nav className="site-nav" aria-label="Primary">
          <a href="#overview" className="nav-link">
            Overview
          </a>
          <a href="#applications" className="nav-link">
            Applications
          </a>
          <a href="#reporting" className="nav-link">
            Reporting
          </a>
          <a href="#support" className="nav-link">
            Support
          </a>
        </nav>
        <button type="button" className="header-cta">
          Portal Access
        </button>
      </header>
      <main className="site-main">
        <div className="app">
          {isLoading || !config ? (
            <div className="form-loader" role="status">
              <span className="loader-spinner" aria-hidden="true" />
              Loading form configuration...
            </div>
          ) : (
            <>
              {errorMessage ? (
                <div className="form-alert" role="alert">
                  <div>
                    <strong>Connection issue</strong>
                    <p>{errorMessage}</p>
                  </div>
                  {!isDebugMode ? (
                    <button type="button" className="retry-button" onClick={loadConfig}>
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="page-heading">
                <p className="eyebrow">Application Workspace</p>
                <h1>{config.Name ?? 'Application Form'}</h1>
                <p className="form-meta">
                  {config.FormTypeName ?? 'Application'} - {config.Metadata?.ProgramName ?? 'Program'}
                </p>
                {isDebugData ? <span className="debug-badge">Debug data</span> : null}
              </div>
              <FormBuilder config={config} />
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <div>
          <strong>GrantFlow</strong> - Delivering simple, structured application experiences.
        </div>
        <div className="footer-links">
          <a href="#privacy">Privacy</a>
          <a href="#status">Status</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
