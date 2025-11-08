import React from 'react';
import PropTypes from 'prop-types';
import FieldInput from './fields/FieldInput.jsx';

const Step = ({ step }) => {
  const fieldActions = Array.isArray(step.Actions)
    ? step.Actions.filter((action) => action.Type === 'Field_Input').sort(
        (a, b) => (a.Order ?? 0) - (b.Order ?? 0),
      )
    : [];

  if (fieldActions.length === 0) {
    return null;
  }

  return (
    <section className="step" aria-labelledby={`step-${step.StepId}`}>
      <header>
        <h2 id={`step-${step.StepId}`}>{step.Name}</h2>
        <small>
          Entity: {step.EntityName} · Step {step.Order}
        </small>
      </header>
      <div className="fields">
        {fieldActions.map((action) => (
          <FieldInput key={action.ActionId ?? action.Name} action={action} />
        ))}
      </div>
    </section>
  );
};

Step.propTypes = {
  step: PropTypes.shape({
    StepId: PropTypes.string,
    Name: PropTypes.string,
    EntityName: PropTypes.string,
    Order: PropTypes.number,
    Actions: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};

export default Step;
