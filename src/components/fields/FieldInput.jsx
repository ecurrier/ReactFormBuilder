import React from 'react';
import PropTypes from 'prop-types';

const formatDescription = (description) => {
  if (!description) {
    return null;
  }

  const trimmed = description.trim();

  if (trimmed.startsWith('<')) {
    return <small dangerouslySetInnerHTML={{ __html: trimmed }} />;
  }

  return <small>{trimmed}</small>;
};

const renderInput = (properties, inputId) => {
  const description = typeof properties.Description === 'string' ? properties.Description.trim() : '';

  const commonProps = {
    id: inputId,
    name: properties.LogicalName ?? inputId,
    readOnly: properties.IsReadOnly,
    required: properties.IsRequired,
    placeholder: description && !description.startsWith('<') ? description : undefined,
  };

  switch (properties.DataType) {
    case 'MultiLineText':
      return <textarea {...commonProps} rows={4} />;
    case 'YesNo':
      return (
        <input
          {...commonProps}
          type="checkbox"
          defaultChecked={false}
          onChange={() => {}}
          disabled={properties.IsReadOnly}
        />
      );
    case 'WholeNumber':
    case 'Decimal':
    case 'Currency':
      return <input {...commonProps} type="number" step="any" />;
    case 'SingleLineText':
    case 'Lookup':
      return <input {...commonProps} type="text" />;
    case 'Choice':
      return (
        <div className="choice-placeholder" role="note">
          Choice field placeholder — configure options in a future iteration.
        </div>
      );
    default:
      return <input {...commonProps} type="text" />;
  }
};

const FieldInput = ({ action }) => {
  const properties = action?.Properties ?? {};
  const inputId =
    properties.LogicalName ?? action.ActionId ?? action.Name ?? 'field-input';
  const label = properties.Label ?? action.Name ?? properties.LogicalName;

  return (
    <div className={`field${properties.IsHidden ? ' hidden-field' : ''}`}>
      {label && (
        <label htmlFor={inputId}>
          <span>{label}</span>
          {properties.IsRequired ? <span aria-hidden="true">*</span> : null}
          {properties.IsReadOnly ? <span aria-hidden="true">🔒</span> : null}
        </label>
      )}
      {renderInput(properties, inputId)}
      {formatDescription(properties.Description)}
      {properties.ValidationMessage ? (
        <small role="alert">{properties.ValidationMessage}</small>
      ) : null}
      {Array.isArray(properties.ChildActions) && properties.ChildActions.length > 0 ? (
        <div className="child-action-group">
          {properties.ChildActions.filter((child) => child.Type === 'Field_Input')
            .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
            .map((child) => (
              <FieldInput key={child.ActionId ?? child.Name} action={child} />
            ))}
        </div>
      ) : null}
    </div>
  );
};

FieldInput.propTypes = {
  action: PropTypes.shape({
    ActionId: PropTypes.string,
    Name: PropTypes.string,
    Properties: PropTypes.shape({
      LogicalName: PropTypes.string,
      Label: PropTypes.string,
      DataType: PropTypes.string,
      Description: PropTypes.string,
      IsRequired: PropTypes.bool,
      IsReadOnly: PropTypes.bool,
      IsHidden: PropTypes.bool,
      ValidationMessage: PropTypes.string,
      ChildActions: PropTypes.arrayOf(PropTypes.object),
    }),
  }).isRequired,
};

export default FieldInput;
