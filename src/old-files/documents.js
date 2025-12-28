(function (global) {
	"use strict";

	global.FRCC = global.FRCC || {};
	global.FRCC.Portal = global.FRCC.Portal || {};
	global.FRCC.Portal.Documents = (function () {
		const documentValidationTypes = Object.freeze({
			NoValidation: 203_300_000,
			OneFileOnly: 203_300_001,
			AtLeastOneFile: 203_300_002,
		});

		class DocumentContext {
			constructor(documentPath, idTag) {
				this.documentPath = documentPath;
				this.idTag = idTag;
			}
		}

		class DocumentValidator {
			constructor(documentConfiguration, validator, domContext) {
				this.DocumentConfiguration = documentConfiguration;
				this.Validator = validator;
				this._domContext = domContext;
				this._currentValidationType = null;
				this._currentValidationMessage = null;
			}

			getCurrentValidationType = () => this._currentValidationType || this.DocumentConfiguration.DocumentValidation;
			getCurrentValidationMessage = () => (this._currentValidationType ? this._currentValidationMessage : this.DocumentConfiguration.ValidationMessage);
			setValidationType = (type) => (this._currentValidationType = type);
			resetValidationType = () => {
				this._currentValidationType = null;
				this._currentValidationMessage = null;
			};
			setValidationMessage = (message) => (this._currentValidationMessage = message);

			updateMessageAndTooltip = () => {
				var message = this.getCurrentValidationMessage();
				var tooltip = null;
				switch (this.getCurrentValidationType()) {
					case documentValidationTypes.OneFileOnly:
						message =
							this._currentValidationMessage ||
							`You must attach one required document for this category: ${this.DocumentConfiguration.FolderName}`;
						tooltip = "You can only submit one document. Any new document will replace the existing one.";
						break;
					case documentValidationTypes.AtLeastOneFile:
						message =
							this._currentValidationMessage ||
							`You must attach one or more required documents for this category: ${this.DocumentConfiguration.FolderName}`;
						tooltip = null;
						break;
				}

				var webResourceId = _getWebResourceId(this.DocumentConfiguration.Identifier);
				this.Validator.errormessage = `<a href='#${webResourceId}'>${message}</a>`;

				var docUploadContainer = $(`#${webResourceId} .file-upload-core`, this._domContext);
				if (tooltip) {
					docUploadContainer.attr("title", tooltip);
					docUploadContainer.attr("data-toggle", "tooltip");
				} else {
					docUploadContainer.removeAttr("title");
					docUploadContainer.removeAttr("data-toggle");
				}
			};
		}

		var currentDocumentValidations = new FRCC.Portal.Utilities.Dictionary();
		var Page_Validators = undefined;

		var _getDocumentContextFromForm = function () {
			var documentPath = $("#hdn-documentpath").val();
			var applicationNumber = $("#hdn-applicationnumber").val();
			return new DocumentContext(documentPath, applicationNumber);
		};

		var _getEygaApiContextFromForm = function () {
			var regardingId = $("#hdn-recordid").val();
			var regardingType = $("#hdn-recordtype").val();
			var userId = $("#hdn-userid").val();
			return new FRCC.Portal.Utilities.EygaApiContext(regardingId, regardingType, userId);
		};

		var _getWebResourceId = (docUploadId) => `WebResource_FileUpload_${docUploadId}`;
		var _getSessionName = (docUploadId) => `Files_${docUploadId}`;

		var setupFileUploadsReadOnly = (config, childId = null, domContext = document) => {
			/* Create as separate function instead of new parameter on setupFileUploads because
			 * don't want to force client implementations to repbulish their forms */
			var childId = childId;
			var domContext = domContext;
			config.forEach((docUpload) => {
				var webResourceId = _getWebResourceId(docUpload.Identifier);
				ConvertIframeIntoElements(webResourceId);

				$(`#${webResourceId} .btn`).attr("disabled", true);
				$(`#${webResourceId} .alert-success`).attr({ "aria-label": "success" }); // Needed for accessibility

				_listFilesById(
					docUpload.Identifier,
					docUpload.FolderName,
					_getEygaApiContextFromForm(),
					_getDocumentContextFromForm(),
					true,
					childId,
					domContext
				);
			});
		};

		var setupFileUploads = (config, childId = null, domContext = document, pageValidators = null) => {
			var childId = childId;
			var domContext = domContext;
			config.forEach((docUpload) => {
				var webResourceId = _getWebResourceId(docUpload.Identifier);
				ConvertIframeIntoElements(webResourceId);
				$(`#${webResourceId} .file-upload-core`, domContext).change(function () {
					_uploadFiles(docUpload.Identifier, docUpload.FolderName, $(this)[0].files, docUpload.DocumentValidation, childId, domContext);
					$(this)[0].value = null;
				});

				//$(`#${webResourceId} p`).attr({'aria-atomic':'true', 'aria-live': 'assertive'}); // Needed for accessibility
				$(`#${webResourceId} .alert-success`).attr({ "aria-label": "success" }); // Needed for accessibility
				//$(`#${webResourceId} .disable-upload-message`, domContext).hide();
				//$(`#${webResourceId} .upload-button`, domContext).removeAttr('disabled');
				//$(`#${webResourceId} .table`, domContext).show();

				_listFilesById(
					docUpload.Identifier,
					docUpload.FolderName,
					_getEygaApiContextFromForm(),
					_getDocumentContextFromForm(),
					false,
					childId,
					domContext
				);

				var validator = _setupFileUploadValidation(docUpload, domContext, pageValidators || Page_Validators);
				currentDocumentValidations.add(webResourceId, new DocumentValidator(docUpload, validator, domContext));
			});
		};

		var ConvertIframeIntoElements = (webResourceId) => {
			var control = $("#" + webResourceId);
			if (control.length > 0 && control[0].tagName == "IFRAME") {
				var uploadControlBody = $(control).contents().find("body").html();
				$(control)
					.parent()
					.append("<literal id='" + webResourceId + "'>" + uploadControlBody + "</literal>");
				$(control).remove();
			}
		};

		var downloadAttachment = async (fullName) => {
			var eygaApiContext = _getEygaApiContextFromForm();
			var payload = fullName;

			var result = await global.FRCC.Portal.Utilities.callEygaApi(FRCC.Portal.Utilities.ApiCall.DownloadDocument, eygaApiContext, payload);

			var blob = new Blob([result], { type: "application/octet-stream" });
			var link = document.createElement("a");
			link.href = window.URL.createObjectURL(blob);
			link.download = fullName.split("/").pop();
			link.click();
		};

		var _uploadFiles = async (docUploadId, folderName, fileArr, documentValidation, childId = null, domContext = document) => {
			try {
				var webResourceId = _getWebResourceId(docUploadId);
				$(`#${webResourceId} .alert-success`, domContext).hide();
				$(`#${webResourceId} .alert-success`).attr({ "aria-hidden": "true" }); // Needed for accessibility
				$(`#${webResourceId} .alert-success`).removeAttr("aria-live aria-atomic");
				$(`#${webResourceId} .loading-ui`, domContext).find("p").text("Uploading files");
				$(`#${webResourceId} .loading-ui`, domContext).attr("role", "alert");
				$(`#${webResourceId} .loading-ui`, domContext).show();

				console.log("Uploading files...");

				var file = fileArr[0];

				var maxSize = await global.FRCC.Portal.Utilities.getEYGAConfigurationSetting("eyfrcc_maxfilesizemb");
				var validExtensions = await global.FRCC.Portal.Utilities.getEYGAConfigurationSetting("eyfrcc_allowedextensions");

				var validationError = _isFileValid(file, maxSize, validExtensions);
				if (validationError) {
					throw validationError;
				}
				//TODO: IF HEIC file type convert first to jpeg

				var eygaApiContext = _getEygaApiContextFromForm();
				var documentContext = _getDocumentContextFromForm();

				if (documentValidation == documentValidationTypes.OneFileOnly.toString()) {
					// Only one doc of type
					var existingFiles = global.FRCC.Portal.Utilities.getSession(_getSessionName(docUploadId));
					if (existingFiles?.[folderName]?.length) {
						for (var i = 0; i < existingFiles[folderName].length; i++) {
							await _deleteFile(eygaApiContext, existingFiles[folderName][i]);
						}
					}
				}

				await _uploadFile(eygaApiContext, documentContext, file, folderName, childId);

				setTimeout(() => {
					_listFilesById(docUploadId, folderName, eygaApiContext, documentContext, false, childId, domContext);
					$(`#${webResourceId} .loading-ui`, domContext).hide();
					$(`#${webResourceId} .loading-ui`, domContext).removeAttr("role");
					$(`#${webResourceId} .alert-success`, domContext).show();
					$(`#${webResourceId} .alert-success`).attr({ "aria-atomic": "true", "aria-live": "polite" }); // Needed for accessibility
				}, 2000);
			} catch (error) {
				alert(error);
				console.log(error);
				$(`#${webResourceId} .loading-ui`, domContext).hide();
				$(`#${webResourceId} .loading-ui`, domContext).removeAttr("role");
			}
		};

		var _uploadFile = async (eygaApiContext, documentContext, file, folderName, childId = null) => {
			var now = new Date();
			var uploadDate = `${now.getUTCMonth() + 1}/${now.getUTCDate()}/${now.getUTCFullYear()} ${now.getUTCHours() % 12 || 12}-${now.getUTCMinutes().toString().padStart(2, "0")}-${now.getUTCSeconds().toString().padStart(2, "0")} ${now.getUTCHours() >= 12 ? "PM" : "AM"}`;
			var payload = new FormData();
			var tags = {
				Id: documentContext.idTag,
				Folder: folderName,
				"Upload Date": uploadDate,
				Status: "Accepted",
				RestrictDelete: false,
			};
			if (childId) {
				tags["ChildId"] = childId;
			}

			payload.append(
				"json",
				JSON.stringify({
					Name: file.name,
					DocumentFolder: folderName,
					RecordFolder: documentContext.documentPath,
					Tags: tags,
				})
			);
			payload.append("file", file);

			await global.FRCC.Portal.Utilities.callEygaApi(FRCC.Portal.Utilities.ApiCall.UploadDocument, eygaApiContext, payload);
		};

		var _listFilesById = async (docUploadId, folderName, eygaApiContext, documentContext, isReadOnly, childId = null, domContext = document) => {
			var webResourceId = _getWebResourceId(docUploadId);
			$(`#${webResourceId} .loading-ui`, domContext).find("p").text("Loading files");

			var payload = {
				Id: documentContext.idTag,
				Folder: folderName,
				Status: "Accepted",
			};
			if (childId) {
				payload["ChildId"] = childId;
			}
			var response = await global.FRCC.Portal.Utilities.callEygaApi(FRCC.Portal.Utilities.ApiCall.GetDocumentsById, eygaApiContext, payload);

			if (response?.length) {
				$(`#${webResourceId} .table`, domContext).show();
			}

			$(`#${webResourceId} .table`, domContext).find("tr:gt(0)").remove();
			var files = {};
			for (const file of response) {
				var newRow = domContext.createElement("tr");
				var nameCell = domContext.createElement("td");
				nameCell.innerHTML = `<button type="button" class="btn btn-link-inline" href="javascript:void(0)" onclick="FRCC.Portal.Documents.downloadAttachment('${file.fullName}')"><p>${file.name}</p></button>`;
				newRow.appendChild(nameCell);

				var deleteCell = domContext.createElement("td");
				deleteCell.className = "contains-component text-right";
				var deleteLink = domContext.createElement("button");
				deleteLink.href = "javascript:void(0)";
				deleteLink.type = "button";
				deleteLink.className = "btn btn-link btn-md btn-icon-only";
				deleteLink.ariaLabel = "remove";
				deleteLink.innerHTML = `<span class="glyphicon glyphicon-trash icon-size-md"></span>`;
				if (isReadOnly) {
					deleteLink.disabled = true;
				} else {
					deleteLink.onclick = () => {
						global.FRCC.Portal.Utilities.openConfirmationModal("Delete File", "Are you sure you want to remove this file?", "Delete").then(
							async (result) => {
								if (!result) {
									return;
								}

								try {
									$(`#${webResourceId} .alert-success`, domContext).hide();
									$(`#${webResourceId} .alert-success`).attr({ "aria-hidden": "true" }); // Needed for accessibility
									$(`#${webResourceId} .alert-success`).removeAttr("aria-live").removeAttr("aria-atomic");
									$(`#${webResourceId} .loading-ui`, domContext).find("p").text("Deleting files...");
									$(`#${webResourceId} .loading-ui`, domContext).attr("role", "alert");
									$(`#${webResourceId} .loading-ui`, domContext).show();

									console.log("Deleting file...");

									await _deleteFile(eygaApiContext, file.fullName);

									setTimeout(() => {
										_listFilesById(docUploadId, folderName, eygaApiContext, documentContext, isReadOnly, childId, domContext);
										$(`#${webResourceId} .loading-ui`, domContext).hide();
										$(`#${webResourceId} .loading-ui`, domContext).removeAttr("role");
									}, 1000);
								} catch (error) {
									alert(error);
									console.log(error);
									$(`#${webResourceId} .loading-ui`, domContext).hide();
									$(`#${webResourceId} .loading-ui`, domContext).removeAttr("role");
								}
							}
						);
					};
				}
				deleteCell.appendChild(deleteLink);
				newRow.appendChild(deleteCell);

				$(newRow).insertAfter($(`#${webResourceId} .table tr:last`, domContext));

				if (!files[file.tags.Folder]) {
					files[file.tags.Folder] = [];
				}
				files[file.tags.Folder].push(file.fullName);
			}

			global.FRCC.Portal.Utilities.saveSession(_getSessionName(docUploadId), files);

			$(`#${webResourceId} .loading-ui`, domContext).hide();
			$(`#${webResourceId} .loading-ui`, domContext).removeAttr("role");
		};

		var _deleteFile = async (eygaApiContext, fullName) => {
			var payload = fullName;
			return global.FRCC.Portal.Utilities.callEygaApi(FRCC.Portal.Utilities.ApiCall.DeleteDocument, eygaApiContext, payload);
		};

		var _setupFileUploadValidation = function (docUpload, domContext = document, pageValidators = null) {
			var webResourceId = _getWebResourceId(docUpload.Identifier);
			var target = $(`#${webResourceId} .form-field-file-upload`).parents(".control").siblings(".info");
			if (docUpload && docUpload.DocumentValidation != documentValidationTypes.NoValidation) {
				target.addClass("required");
			}

			var defaultValidationMessage = "You must attach one required document for this category";
			if (!docUpload.ValidationMessage) {
				docUpload.ValidationMessage = defaultValidationMessage;
			}

			docUpload.ValidationMessage += ": " + docUpload.FolderName;

			return _addPageValidator(
				docUpload,
				() => {
					var currentType = currentDocumentValidations.get(webResourceId).getCurrentValidationType();
					switch (currentType) {
						case documentValidationTypes.OneFileOnly:
							var files = global.FRCC.Portal.Utilities.getSession(_getSessionName(docUpload.Identifier));
							var folderFiles = files?.[docUpload.FolderName];

							if (folderFiles?.length) {
								target.removeClass("has-error");
								return true;
							} else {
								target.addClass("has-error");
								return false;
							}
						case documentValidationTypes.AtLeastOneFile:
							var files = global.FRCC.Portal.Utilities.getSession(_getSessionName(docUpload.Identifier));
							if (!files) {
								return false;
							}
							var folderNames = Object.keys(files);

							if (folderNames?.includes(docUpload.FolderName)) {
								target.removeClass("has-error");
								return true;
							} else {
								target.addClass("has-error");
								return false;
							}
						default:
							return true;
					}
				},
				"You can only submit one document. Any new document will replace the existing one.",
				domContext,
				pageValidators || Page_Validators
			);
		};

		//for validation message pass in a function that returns a string.
		//keep track of validator object on 331 dynamically change that error message on the fly
		var _addPageValidator = function (docUpload, validationFunction, tooltipMessage = null, domContext = document, pageValidators = null) {
			if (tooltipMessage) {
				var webResourceId = _getWebResourceId(docUpload.Identifier);
				$(`#${webResourceId} .file-upload-core`, domContext).attr("title", tooltipMessage);
				$(`#${webResourceId} .file-upload-core`, domContext).attr("data-toggle", "tooltip");
			}

			if (!pageValidators) {
				pageValidators = Page_Validators;
			}
			if (typeof pageValidators == "undefined") {
				return;
			}
			var validator = document.createElement("span");
			validator.style.display = "none";
			validator.id = `validator-${docUpload.Identifier}`;
			validator.controltovalidate = "";
			validator.errormessage = `<a href='#WebResource_FileUpload_${docUpload.Identifier}'>${docUpload.ValidationMessage}</a>`;
			validator.validationGroup = `validation-${docUpload.StepId || docUpload.StepNumber}`;
			validator.initialvalue = "";
			validator.evaluationfunction = validationFunction;
			pageValidators.push(validator);

			return validator;
		};

		var _isFileValid = function (file, maxSize, extensionsString) {
			let fileExtension = file.name.split(".")[1];
			let fileMimetype = file.type;

			var maxFileSize = maxSize ?? 100;
			//throw error if file size is greater than 100mb
			if (file.size / 1000000 > maxFileSize) {
				return "ERROR: You are attempting to upload a file larger than " + maxFileSize + "mb";
			}

			if (!/^[\w,\s-()]+\.[A-Za-z0-9]{3,4}$/i.test(file.name)) {
				return "ERROR: You are attempting to upload an invalid filename.";
			}

			if (!fileMimetype && !fileExtension) {
				return "ERROR: No input given.";
			}

			var validExtensionsString = JSON.parse(extensionsString);
			const validFileTypes = validExtensionsString.ValidFileTypes;
			const matchingTypes = validFileTypes.find((r) => r.m.toLowerCase() === fileMimetype.toLowerCase());

			if (!matchingTypes) {
				// Check for special case where heic and heif has no valid mimeType
				if (fileExtension !== ".heic" && fileExtension !== ".heif") {
					return `ERROR: ${fileMimetype} is not a valid mimeType.`;
				}
			} else {
				if (!fileExtension) {
					return `ERROR: File Extension is required.`;
				} else {
					const validExtensions = matchingTypes.e.toLowerCase();

					if (!validExtensions.includes(fileExtension.toLowerCase())) {
						return `ERROR: ${fileExtension} is not a valid extension for ${fileMimetype}.`;
					}
				}
			}

			/*
                let validExtensions = [];

                if (validExtensionsString !== null && validExtensionsString !== "") {
                    validExtensions = validExtensionsString.split(",");
                } else {
                    validExtensions = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/bmp', 'application/msword', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingm', 'image/gif', 'image/jpeg', 'image/png', 'application/vnd.ms-powerpoint',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/rtf', 'image/tiff', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'image/heic', 'image/heif', 'text/csv'];
                }

                if (!validExtensions.includes(file.type)) {
                    //sometimes heic files have empty file types and should not go into this alert
                    if (fileExtension !== "heic" && fileExtension !== "heif") {
                        return "ERROR: You are attempting to upload an invalid document type.";
                    }
                }
            //*/
			return null;
		};

		var setDocumentValidation = function (targetAction, type, message) {
			var currentValidation = currentDocumentValidations.get(targetAction);
			if (!currentValidation || !currentValidation.Validator) {
				return;
			}

			currentValidation.setValidationType(type);
			currentValidation.setValidationMessage(message);
			var target = $(`#${targetAction} .form-field-file-upload`).parents(".control").siblings(".info");
			if (type && type != documentValidationTypes.NoValidation) {
				target.addClass("required");
			} else {
				target.removeClass("required");
			}

			currentValidation.updateMessageAndTooltip();
		};

		var resetDocumentValidation = function (targetAction) {
			var target = $(`#${targetAction} .form-field-file-upload`).parents(".control").siblings(".info");

			var currentValidation = currentDocumentValidations.get(targetAction);
			if (
				currentValidation.DocumentConfiguration.DocumentValidation &&
				currentValidation.DocumentConfiguration.DocumentValidation != documentValidationTypes.NoValidation
			) {
				target.addClass("required");
			} else {
				target.removeClass("required");
			}

			currentValidation.resetValidationType();
			currentValidation.updateMessageAndTooltip();
		};

		return {
			setupFileUploads: setupFileUploads,
			downloadAttachment: downloadAttachment,
			DocumentContext: DocumentContext,
			setupFileUploadsReadOnly: setupFileUploadsReadOnly,
			setDocumentValidation: setDocumentValidation,
			resetDocumentValidation: resetDocumentValidation,
		};
	})();
})(this);
