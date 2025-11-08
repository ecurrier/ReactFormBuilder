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

const getPlaceholder = (dataType) => {
  switch (dataType) {
    case 'MultiLineText':
      return 'Please provide additional details...';
    case 'WholeNumber':
    case 'Decimal':
    case 'Currency':
      return 'Please enter a numeric value...';
    case 'Lookup':
      return 'Please search for a record...';
    case 'SingleLineText':
      return 'Please enter a value...';
    default:
      return ['YesNo', 'Choice'].includes(dataType) ? undefined : 'Please input a value...';
  }
};

const renderInput = (properties, inputId, placeholder) => {
  const commonProps = {
    id: inputId,
    name: properties.LogicalName ?? inputId,
    readOnly: properties.IsReadOnly,
    required: properties.IsRequired,
  };

  if (placeholder) {
    commonProps.placeholder = placeholder;
  }

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
    case 'Choice': {
      const choices = Array.isArray(properties.Choices) ? properties.Choices : [];
      if (choices.length === 0) {
        return (
          <div className="choice-placeholder" role="note">
            No options are configured for this field yet.
          </div>
        );
      }

      const multiSelect = Boolean(properties.CanSelectMultiple);
      const selectProps = {
        ...commonProps,
        multiple: multiSelect,
        defaultValue: multiSelect ? [] : '',
      };

      if (properties.IsReadOnly) {
        selectProps.disabled = true;
      }

      if (multiSelect && choices.length > 3) {
        selectProps.size = Math.min(choices.length, 6);
      }

      return (
        <select {...selectProps}>
          {!multiSelect ? (
            <option value="" disabled hidden>
              Select an option...
            </option>
          ) : null}
          {choices.map((choice) => (
            <option key={choice.Value ?? choice.Label} value={choice.Value ?? choice.Label}>
              {choice.Label ?? choice.Value ?? 'Option'}
            </option>
          ))}
        </select>
      );
    }
    default:
      return <input {...commonProps} type="text" />;
  }
};

const FieldInput = ({ action }) => {
  const properties = action?.Properties ?? {};
  const inputId =
    properties.LogicalName ?? action.ActionId ?? action.Name ?? 'field-input';
  const label = properties.Label ?? action.Name ?? properties.LogicalName;
  const childFieldActions = Array.isArray(properties.ChildActions)
    ? properties.ChildActions.filter((child) => child.Type === 'Field_Input').sort(
        (a, b) => (a.Order ?? 0) - (b.Order ?? 0),
      )
    : [];
  const hasChildFieldInputs = childFieldActions.length > 0;
  const placeholder = hasChildFieldInputs ? undefined : getPlaceholder(properties.DataType);

  if (hasChildFieldInputs) {
    return (
      <div
        className={`field-collection${properties.IsHidden ? ' hidden-field' : ''}`}
        role="group"
        aria-label={label ?? 'Nested fields'}
      >
        {label ? <p className="field-collection-title">{label}</p> : null}
        {formatDescription(properties.Description)}
        <div className="child-action-group">
          {childFieldActions.map((child) => (
            <FieldInput key={child.ActionId ?? child.Name} action={child} />
          ))}
        </div>
      </div>
    );
  }

  const fieldClassNames = ['field'];
  if (properties.IsHidden) {
    fieldClassNames.push('hidden-field');
  }
  if (properties.IsReadOnly) {
    fieldClassNames.push('readonly-field');
  }

  return (
    <div className={fieldClassNames.join(' ')}>
      {label && (
        <label htmlFor={inputId}>
          <span>{label}</span>
          {properties.IsRequired ? <span aria-hidden="true">*</span> : null}
        </label>
      )}
      {renderInput(properties, inputId, placeholder)}
      {formatDescription(properties.Description)}
      {properties.ValidationMessage ? (
        <small role="alert">{properties.ValidationMessage}</small>
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
      Choices: PropTypes.arrayOf(
        PropTypes.shape({
          Value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          Label: PropTypes.string,
        }),
      ),
      CanSelectMultiple: PropTypes.bool,
    }),
  }).isRequired,
};

export default FieldInput;
