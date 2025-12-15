import React, { useCallback, useEffect, useState } from 'react';
import formConfig from './data/formConfig.json';
import FormBuilder from './components/FormBuilder.jsx';

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

      // Power Pages Web API call to retrieve form configuration
      const recordId = new URLSearchParams(window.location.search).get('id');
      const webApiUrl = `${window.location.origin}/_api/eyfrcc_versions(${recordId})/?$select=eyfrcc_formcontent`;

      const response = await fetch(webApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const versionRecord = await response.json();
      if (!versionRecord.eyfrcc_formcontent) {
        throw new Error('Form content field is empty');
      }

      const formConfiguration = JSON.parse(versionRecord.eyfrcc_formcontent);
      setConfig(formConfiguration);
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
    </div>
  );
};

export default App;
