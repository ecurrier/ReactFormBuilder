import React from 'react';
import PropTypes from 'prop-types';
import FieldInput from './fields/FieldInput.jsx';

const Step = ({ step, hasNext, hasPrev, onNext, onPrev, positionLabel }) => {
  const fieldActions = Array.isArray(step.Actions)
    ? step.Actions.filter((action) => action.Type === 'Field_Input').sort(
        (a, b) => (a.Order ?? 0) - (b.Order ?? 0),
      )
    : [];

  if (fieldActions.length === 0) {
    return null;
  }

  const stepIdentifier = step.StepId ?? step.Name ?? 'step';
  const entityName = step.EntityName ?? 'Not specified';
  const configOrder =
    typeof step.Order === 'number' ? `Config order ${step.Order}` : null;

  return (
    <section className="step" aria-labelledby={`step-${stepIdentifier}`}>
      <header>
        {positionLabel ? (
          <p className="step-position" aria-live="polite">
            {positionLabel}
          </p>
        ) : null}
        <h2 id={`step-${stepIdentifier}`}>{step.Name ?? entityName}</h2>
        <small>
          Entity: {entityName}
          {configOrder ? ` - ${configOrder}` : null}
        </small>
      </header>
      <div className="fields">
        {fieldActions.map((action) => (
          <FieldInput key={action.ActionId ?? action.Name} action={action} />
        ))}
      </div>
      <footer className="step-footer" aria-label="Step navigation buttons">
        <button
          type="button"
          className="nav-button"
          onClick={onPrev}
          disabled={!hasPrev}
        >
          Previous
        </button>
        <button
          type="button"
          className="nav-button primary"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
        </button>
      </footer>
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
  hasNext: PropTypes.bool,
  hasPrev: PropTypes.bool,
  onNext: PropTypes.func,
  onPrev: PropTypes.func,
  positionLabel: PropTypes.string,
};

Step.defaultProps = {
  hasNext: false,
  hasPrev: false,
  onNext: undefined,
  onPrev: undefined,
  positionLabel: undefined,
};

export default Step;
