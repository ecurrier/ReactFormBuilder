import React from 'react';
import formConfig from './data/formConfig.json';
import FormBuilder from './components/FormBuilder.jsx';

const App = () => (
  <div className="app">
    <h1>{formConfig.Name}</h1>
    <p className="form-meta">
      {formConfig.FormTypeName} · {formConfig.Metadata?.ProgramName}
    </p>
    <FormBuilder config={formConfig} />
  </div>
);

export default App;
