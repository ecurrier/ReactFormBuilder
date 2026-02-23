(function (global) {
	"use strict";

	global.FRCC = global.FRCC || {};
	global.FRCC.Portal = global.FRCC.Portal || {};
	global.FRCC.Portal.Validations = (function () {
		const actionTypes = Object.freeze({
			FieldInput: 203_300_000,
			TableEntry: 203_300_002,
		});

		const tableValidationTypes = Object.freeze({
			AtLeastOnRecord: 643_260_000,
			NoValidation: 643_260_001,
		});

		class ValidationValidator {
			constructor(validation, validator) {
				this.Validation = validation;
				this.Validator = validator;
				this._currentValidationType = null;
				this._currentValidationMessage = null;
			}

			getCurrentValidationType = () => {
				if (this._currentValidationType) {
					return this._currentValidationType;
				}

				switch (this.Validation.ActionType) {
					case actionTypes.FieldInput:
						return this.Validation.FieldValidationType;
					case actionTypes.TableEntry:
						return this.Validation.TableValidationType;
					default:
						return null;
				}
			};
			getCurrentValidationMessage = () => (this._currentValidationType ? this._currentValidationMessage : this.Validation.Message);
			setValidationType = (type) => (this._currentValidationType = type);
			resetValidationType = () => {
				this._currentValidationType = null;
				this._currentValidationMessage = null;
			};
			setValidationMessage = (message) => (this._currentValidationMessage = message);

			updateMessageAndTooltip = () => {
				var message = this.getCurrentValidationMessage();
				this.Validator.errormessage = `<a href='#${this.Validator.controltovalidate}'>${message}</a>`;
			};
		}

		var preValidationResults = new FRCC.Portal.Utilities.Dictionary();
		var currentRequiredFields = new FRCC.Portal.Utilities.Dictionary();
		var currentValidations = new FRCC.Portal.Utilities.Dictionary();

		var setupValidations = function (validationConfiguration) {
			_setupPreSubmitValidation(validationConfiguration);

			validationConfiguration.Validations.forEach((validation) => {
				var validator = null;
				switch (validation.ActionType) {
					case actionTypes.FieldInput: // Field Input
						validator = _setupFieldValidation(validation);
						break;
					case actionTypes.TableEntry: // Table Entry
						validator = _setupTableValidation(validation);
						break;
					// File upload validation (203300001) will be handled in documents.js web file
				}

				currentValidations.add(validation.Identifier, new ValidationValidator(validation, validator));
			});

			validationConfiguration?.RequiredFields?.forEach(_setupFieldRequirement);
			_addSubmissionValidation();
		};

		var _setupPreSubmitValidation = function (validationConfiguration) {
			$(".submit-btn").each((index, button) => {
				const submitFunction = button.onclick;
				const stepNumberOrId = $(button)
					.attr("onclick")
					?.match(/Page_ClientValidate\('validation-(?<validationgroup>[^']+)'\)/)?.groups["validationgroup"];
				button.onclick = (event) => {
					let preventSubmitFlag = false;
					const preventSubmit = () => (preventSubmitFlag = true);

					validationConfiguration.Validations.filter((v) => stepNumberOrId == (v.StepId || v.StepNumber)) // If there is no step ID, check for step number to be backwards compatible
						// Run asynchronous prevalidations synchronously
						.reduce(
							(previousPromise, v) =>
								preventSubmitFlag ? previousPromise : previousPromise.then(() => _handlePreSubmitValidation(v, preventSubmit)),
							Promise.resolve()
						)
						.then(() => {
							if (!preventSubmitFlag) {
								submitFunction(event);
							}
						})
						.catch((error) => {
							console.log(`An error occurred during prevalidation: ${error}.`);
							alert(`An error occurred during prevalidation: ${error}.`);
							preventSubmit();
						});
				};
			});
		};

		var _handlePreSubmitValidation = function (validation, preventSubmit) {
			switch (validation.FieldValidationType) {
				case 643_260_006: // Valid Address
					FRCC.Portal.Utilities.showProgressIndicator("Validating address...");

					var eygaApiContext = _getEygaApiContextFromForm();
					$(`input#${validation.Identifier}`).data("folder");

					var request = {
						AddressLines: validation.AddressLineFields.map((f) => $(`input#${f.FieldLogicalName}`)?.[0]?.value),
						Locality: $(`input#${validation.LocalityField.FieldLogicalName}`)?.[0]?.value,
						AdministrativeArea: $(`input#${validation.AdministrativeAreaField.FieldLogicalName}`)?.[0]?.value,
						PostalCode: $(`input#${validation.PostalCodeField.FieldLogicalName}`)?.[0]?.value,
						RegionCode: validation.RegionCodeField
							? $(`input#${validation.RegionCodeField.FieldLogicalName}`)?.[0]?.value || validation.RegionCodeDefault
							: validation.RegionCodeDefault,
					};
					if (!request.AddressLines[0] && !request.AddressLines[1] && !request.Locality && !request.AdministrativeArea && !request.PostalCode) {
						preValidationResults.add(validation.Identifier, true);
						return;
					}

					return FRCC.Portal.Utilities.callEygaApi(FRCC.Portal.Utilities.ApiCall.ValidateAddress, eygaApiContext, request)
						.then((response) => {
							if (response.ValidationLevel == "Invalid" || !response.Address) {
								preValidationResults.add(validation.Identifier, false);
								return;
							} else if (
								request.AddressLines.every((x, i) => x?.trim()?.toLowerCase() == response.Address.AddressLines?.[i]?.trim()?.toLowerCase()) &&
								request.Locality?.trim()?.toLowerCase() == response.Address.Locality?.trim()?.toLowerCase() &&
								request.AdministrativeArea?.trim()?.toLowerCase() == response.Address.AdministrativeArea?.trim()?.toLowerCase() &&
								request.PostalCode?.trim()?.toLowerCase() == response.Address.PostalCode?.trim()?.toLowerCase() &&
								request.RegionCode?.trim()?.toLowerCase() == response.Address.RegionCode?.trim()?.toLowerCase()
							) {
								preValidationResults.add(validation.Identifier, true);
								return;
							}

							FRCC.Portal.Utilities.hideProgressIndicator();
							return _openAddressConfirmationDialog(validation, request, response).then(
								function accept(address) {
									if (address) {
										validation.AddressLineFields.forEach((f, i) => $(`input#${f.FieldLogicalName}`).val(address.AddressLines[i]));
										$(`input#${validation.LocalityField.FieldLogicalName}`).val(address.Locality);
										$(`input#${validation.AdministrativeAreaField.FieldLogicalName}`).val(address.AdministrativeArea);
										$(`input#${validation.PostalCodeField.FieldLogicalName}`).val(address.PostalCode);
										if (validation.RegionCodeField) {
											$(`input#${validation.RegionCodeField.FieldLogicalName}`).val(address.RegionCode);
										}
									}

									_clearValidationErrors(validation);

									preValidationResults.add(validation.Identifier, true);
								},
								function cancel() {
									preventSubmit();
								}
							);
						})
						.finally(() => {
							FRCC.Portal.Utilities.hideProgressIndicator();
						});

				default:
					return Promise.resolve();
			}
		};

		var _clearValidationErrors = function (validation) {
			validation.AddressLineFields.forEach((f, i) => $(`input#${f.FieldLogicalName}`).parent().removeClass("has-error"));
			$(`input#${validation.LocalityField.FieldLogicalName}`).parent().removeClass("has-error");
			$(`input#${validation.AdministrativeAreaField.FieldLogicalName}`).parent().removeClass("has-error");
			$(`input#${validation.PostalCodeField.FieldLogicalName}`).parent().removeClass("has-error");
			if (validation.RegionCodeField) {
				$(`input#${validation.RegionCodeField.FieldLogicalName}`).parent().removeClass("has-error");
			}
		};

		var _openAddressConfirmationDialog = (validation, request, response) =>
			new Promise((resolve, reject) => {
				var originalAddressFormatted = _formatAddressLines(request);
				$("#original-address-formatted").html(originalAddressFormatted);

				var suggestedAddressFormatted = _formatAddressLines(response.Address, request);
				$("#suggested-address-formatted").html(suggestedAddressFormatted);

				_setupAddressModalInput("addressmodal-old-street1", validation.AddressLineFields?.[0], request.AddressLines?.[0]);
				_setupAddressModalInput("addressmodal-old-street2", validation.AddressLineFields?.[1], request.AddressLines?.[1]);
				_setupAddressModalInput("addressmodal-old-city", validation.LocalityField, request.Locality);
				_setupAddressModalInput("addressmodal-old-state", validation.AdministrativeAreaField, request.AdministrativeArea);
				_setupAddressModalInput("addressmodal-old-zip", validation.PostalCodeField, request.PostalCode);
				_setupAddressModalInput("addressmodal-old-country", validation.RegionCodeField, request.RegionCode);

				_setupAddressModalInput("addressmodal-street1", validation.AddressLineFields?.[0], response.Address.AddressLines?.[0]);
				_setupAddressModalInput("addressmodal-street2", validation.AddressLineFields?.[1], response.Address.AddressLines?.[1]);
				_setupAddressModalInput("addressmodal-city", validation.LocalityField, response.Address.Locality);
				_setupAddressModalInput("addressmodal-state", validation.AdministrativeAreaField, response.Address.AdministrativeArea);
				_setupAddressModalInput("addressmodal-zip", validation.PostalCodeField, response.Address.PostalCode);
				_setupAddressModalInput("addressmodal-country", validation.RegionCodeField, response.Address.RegionCode);

				const closeButton = $("button#addressModalCancelBtn")[0];
				closeButton.onclick = () => {
					closeButton.onclick = null;
					reject();
				};

				const noChangesButton = $("button#addressModalNoChangesBtn")[0];
				noChangesButton.onclick = () => {
					$("#addressModal").modal("hide");
					noChangesButton.onclick = null;
					resolve();
				};

				const acceptButton = $("button#addressModalSaveBtn")[0];
				acceptButton.onclick = () => {
					$("#addressModal").modal("hide");
					acceptButton.onclick = null;
					resolve(response.Address);
				};

				$("#addressModal").modal();
			});

		var _formatAddressLines = function (address, comparisonAddress = null) {
			const street1 = _formatAddressLine(address.AddressLines?.[0], comparisonAddress?.AddressLines?.[0]);
			const street2 = _formatAddressLine(address.AddressLines?.[1], comparisonAddress?.AddressLines?.[1]);
			const city = _formatAddressLine(address.Locality, comparisonAddress?.Locality);
			const stateCode = _formatAddressLine(address.AdministrativeArea, comparisonAddress?.AdministrativeArea);
			const postalCode = _formatAddressLine(address.PostalCode, comparisonAddress?.PostalCode);

			return `${street1}</br>${street2}${street2 ? "</br>" : ""}${city}, ${stateCode} ${postalCode}`;
		};

		var _formatAddressLine = function (addressLine, comparisonLine) {
			if (!addressLine) {
				return "";
			}

			if (!comparisonLine) {
				return addressLine;
			}

			const isDifferent = comparisonLine?.toLowerCase() !== addressLine?.toLowerCase();

			return isDifferent ? `<em class="text-danger text-weight-semibold">${addressLine}</em>` : addressLine;
		};

		var _setupAddressModalInput = function (inputId, validationField, value) {
			const input = $(`input#${inputId}`);
			if (validationField) {
				input.val(value);
				input.labels().text(validationField.Label);
				input.show();
				input.labels().show();
			} else {
				input.hide();
				input.labels().hide();
			}
		};

		var _getEygaApiContextFromForm = function () {
			var regardingId = $("#hdn-recordid").val();
			var regardingType = $("#hdn-recordtype").val();
			var userId = $("#hdn-userid").val();
			return new FRCC.Portal.Utilities.EygaApiContext(regardingId, regardingType, userId);
		};

		var _setupFieldValidation = function (validation) {
			switch (validation.FieldValidationType) {
				case 643_260_000: // Equals
					return _addPageValidatorForValidation(validation, function () {
						return _evaluateEqualsValidation(validation);
					});
				case 643_260_001: // Less Than
					return _addPageValidatorForValidation(validation, function () {
						var pageValue = $(`input#${validation.Identifier}`)[0].value;
						var comparisonValue = validation.Value;
						if (!isNaN(pageValue) && Number(pageValue) < Number(comparisonValue)) {
							return true;
						} else {
							return false;
						}
					});
				case 643_260_007: // Greater Than
					return _addPageValidatorForValidation(validation, function () {
						var pageValue = $(`input#${validation.Identifier}`)[0].value;
						var comparisonValue = validation.Value;
						if (!isNaN(pageValue) && Number(pageValue) > Number(comparisonValue)) {
							return true;
						} else {
							return false;
						}
					});
				case 643_260_006: // Valid Address
					return _addPageValidatorForValidation(validation, function () {
						var response = preValidationResults.get(validation.Identifier);
						return response === true;
					});
			}
		};

		var _evaluateEqualsValidation = function (validation) {
			var rightValue = validation.Value || "";
			var leftValue = "";
			switch (validation.SourceFieldType) {
				case 643_260_007: // Yes or No
					if (rightValue) {
						rightValue = rightValue.toLowerCase().trim();
						if (rightValue == "true" || rightValue == "yes") {
							rightValue = "1";
						}
						if (rightValue == "false" || rightValue == "no") {
							rightValue = "0";
						}
					}

					leftValue = $(`#${validation.Identifier} :checked`)[0]?.value || "";
					break;
				default:
					leftValue = $(`input#${validation.Identifier}`)[0].value || "";
			}

			return leftValue == rightValue;
		};

		var _setupTableValidation = function (validation) {
			return _addPageValidatorForValidation(validation, function () {
				var currentValidationType = currentValidations.get(validation.Identifier).getCurrentValidationType();

				switch (currentValidationType) {
					case tableValidationTypes.AtLeastOnRecord: // At least one row
						return $(`#${validation.Identifier} table tbody tr`).length > 0;
					default:
						return true;
				}
			});
		};

		var _setupFieldRequirement = function (requiredField) {
			var fieldName = requiredField.FieldName;
			var displayName = requiredField.DisplayName;
			var fieldType = requiredField.FieldType;
			var stepId = requiredField.StepId;
			var isRequiredByDefault = requiredField.IsRequiredByDefault;

			var control = $(`#${fieldName}`);
			if (!control) {
				return;
			}

			if (isRequiredByDefault) {
				var cell = control.closest(".cell");
				cell.find(".info").addClass("required");
			}

			_addPageValidator(`validator-require-${fieldName}`, fieldName, `validation-${stepId}`, `'${displayName}' is a required field.`, () =>
				_checkRequiredField(fieldName, fieldType, isRequiredByDefault)
			);
		};

		var _checkRequiredField = function (fieldName, fieldType, isRequiredByDefault) {
			if (!isRequiredByDefault && currentRequiredFields.get(fieldName) !== true) {
				return true;
			}

			var control = $(`#${fieldName}`);
			if (!control) {
				return true;
			}

			var cell = control.closest(".cell");
			if (cell.css("display") == "none") {
				// If hidden, don't enforce requirement
				return true;
			}

			switch (fieldType) {
				case 643_260_007: // Yes or No
					return $(`#${fieldName} :checked`)[0]?.value === "1";
				default:
					return Boolean(control.val());
			}
		};

		var setFieldRequirement = function (fieldName, isRequired) {
			var control = $(`#${fieldName}`);
			if (!control) {
				return true;
			}

			var cell = control.closest(".cell");
			if (isRequired) {
				cell.find(".info").addClass("required");
			} else {
				cell.find(".info").removeClass("required");
			}

			currentRequiredFields.add(fieldName, isRequired);
		};

		var setTableEntryValidation = function (targetAction, type, message) {
			var currentValidation = currentValidations.get(targetAction);
			if (currentValidation) {
				currentValidation.setValidationType(type);
				currentValidation.setValidationMessage(message);
				currentValidation.updateMessageAndTooltip();
			}
		};

		var resetTableEntryValidation = function (targetAction) {
			var currentValidation = currentValidations.get(targetAction);
			if (currentValidation) {
				currentValidation.resetValidationType();
				currentValidation.updateMessageAndTooltip();
			}
		};

		var _addPageValidatorForValidation = function (validation, validationFunction) {
			var validationTarget =
				(validation.AddressLineFields && validation.AddressLineFields.length) > 0
					? validation.AddressLineFields[0].FieldLogicalName
					: validation.Identifier !== null
						? validation.Identifier
						: validation.StepNumber;
			/* Check for a hard-coded "ValidationGroup" for places where are using validation outside of
			 * applications. Otherwise, in the form builder, we use a patter on of validation{step number} */
			var validationGroup =
				validation.ValidationGroup !== undefined && validation.ValidationGroup !== null
					? validation.ValidationGroup
					: `validation-${validation.StepId || validation.StepNumber}`; // If there is no StepId, use StepNumber for validation groups (to be backwards compatible)
			return _addPageValidator(`validator-${validation.Identifier}`, validationTarget, validationGroup, validation.Message, validationFunction);
		};

		var _addPageValidator = function (validationId, validationTarget, validationGroup, validationMessage, validationFunction) {
			if (typeof Page_Validators == "undefined") return;

			var validator = document.createElement("span");
			validator.style.display = "none";
			validator.id = `validator-${validationId}`;
			validator.controltovalidate = validationTarget;
			validator.errormessage = `<a href='#${validationTarget}'>${validationMessage}</a>`;
			validator.validationGroup = validationGroup;
			validator.initialvalue = "";
			validator.evaluationfunction = validationFunction;
			Page_Validators.push(validator);

			return validator;
		};

		var _addSubmissionValidation = (validResultCallback) => {
			let lastSection = $(".accordion-content").last();
			if (!lastSection?.length) {
				return;
			}

			let submitButton = lastSection.find("#UpdateButton");
			submitButton.attr("onclick", "").unbind("click");
			submitButton.attr("onclick", "").on("click", (e) => {
				let validationResult = true;
				if (typeof Page_ClientValidate === "function") {
					validationResult = $(".accordion-content")
						.map((index, item) => ({ number: index + 1, element: item }))
						.splice(1)
						.every((accordion) => {
							const sectionValid = Page_ClientValidate(`validation-${accordion.element.id}`);
							if (!sectionValid && accordion.element.classList.contains("hidden")) {
								FRCC.Portal.Utilities.openAccordian(accordion.number);
							}

							return sectionValid;
						});
				}

				if (validationResult) {
					if (validResultCallback) {
						// Optional way to add any additional logic once the all sections have been validated
						validResultCallback();
					}
					clearIsDirty();
					disableButtons();
					$(this).val("Processing...");
					WebForm_DoPostBackWithOptions(
						new WebForm_PostBackOptions(submitButton.attr("name"), "", true, `validation-${lastSection.attr("id")}`, "", false, true)
					);
				}
			});

			// Validate no dirty fields on submit
			var validaton = {
				StepNumber: lastSection[0].id,
				Identifier: "ValidateNoDirtyFields",
				Message: `You have unsaved changes in other sections. Please Save those changes before Submitting.`,
			};

			return _addPageValidatorForValidation(validaton, function (e) {
				let dirty = $.find(".dirty");
				let nonLastDirtySection = dirty.filter((d) => lastSection.find(d).length === 0);
				let parents = [];
				nonLastDirtySection.forEach((f) => parents.push($(f).closest(".accordion-content")[0].id));
				parents = [...new Set(parents)];

				if (parents.length > 0) {
					let href = `${parents[0]}-unsaved-changes`;
					e.errormessage = `<a href='#${href}'>You have unsaved changes in other sections. Please Save those changes before Submitting</a>`;
				}

				return nonLastDirtySection.length === 0;
			});
		};

		return {
			setupValidations: setupValidations,
			setFieldRequirement: setFieldRequirement,
			setTableEntryValidation: setTableEntryValidation,
			resetTableEntryValidation: resetTableEntryValidation,
		};
	})();
})(this);
