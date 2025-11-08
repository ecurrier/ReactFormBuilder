import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Step from './Step.jsx';

const FormBuilder = ({ config }) => {
  const orderedSteps = useMemo(() => {
    if (!Array.isArray(config?.Steps)) {
      return [];
    }

    return [...config.Steps].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
  }, [config]);

  const visibleSteps = useMemo(
    () =>
      orderedSteps.filter((step) =>
        step.Actions?.some((action) => action.Type === 'Field_Input'),
      ),
    [orderedSteps],
  );

  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    setActiveStepIndex(0);
  }, [visibleSteps.length]);

  if (visibleSteps.length === 0) {
    return <p>No field inputs were provided in this configuration.</p>;
  }

  const clampIndex = (index) => {
    if (visibleSteps.length === 0) {
      return 0;
    }

    const min = 0;
    const max = visibleSteps.length - 1;
    return Math.min(Math.max(index, min), max);
  };

  const goToStep = (index) => {
    setActiveStepIndex(clampIndex(index));
  };

  const goToPrevious = () => {
    setActiveStepIndex((prev) => clampIndex(prev - 1));
  };

  const goToNext = () => {
    setActiveStepIndex((prev) => clampIndex(prev + 1));
  };

  const currentStep = visibleSteps[activeStepIndex];
  const hasPrevious = activeStepIndex > 0;
  const hasNext = activeStepIndex < visibleSteps.length - 1;

  return (
    <div className="form-builder">
      <aside className="step-sidebar" aria-label="Step navigation">
        <ol className="step-list">
          {visibleSteps.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <li key={step.StepId ?? step.Name}>
                <button
                  type="button"
                  className={`step-link${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span className="step-index">{index + 1}</span>
                  <span className="step-title">{step.Name ?? `Step ${index + 1}`}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
      <div className="step-stage">
        <Step
          key={currentStep.StepId ?? currentStep.Name}
          step={currentStep}
          hasPrev={hasPrevious}
          hasNext={hasNext}
          onPrev={hasPrevious ? goToPrevious : undefined}
          onNext={hasNext ? goToNext : undefined}
          positionLabel={`Step ${activeStepIndex + 1} of ${visibleSteps.length}`}
        />
      </div>
    </div>
  );
};

FormBuilder.propTypes = {
  config: PropTypes.shape({
    Steps: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};

export default FormBuilder;
