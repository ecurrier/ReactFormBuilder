import React from 'react';
import PropTypes from 'prop-types';
import Step from './Step.jsx';

const FormBuilder = ({ config }) => {
  const steps = Array.isArray(config?.Steps)
    ? [...config.Steps].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    : [];

  const visibleSteps = steps.filter((step) =>
    step.Actions?.some((action) => action.Type === 'Field_Input'),
  );

  if (visibleSteps.length === 0) {
    return <p>No field inputs were provided in this configuration.</p>;
  }

  return (
    <div className="form-builder">
      {visibleSteps.map((step) => (
        <Step key={step.StepId ?? step.Name} step={step} />
      ))}
    </div>
  );
};

FormBuilder.propTypes = {
  config: PropTypes.shape({
    Steps: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};

export default FormBuilder;
