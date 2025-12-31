(function (global) {
	"use strict";

	global.FRCC = global.FRCC || {};
	global.FRCC.Portal = global.FRCC.Portal || {};
	global.FRCC.Portal.Utilities = (function () {
		class EygaApiType {
			static Documents = "eyfrcc_documentapiurl";
			static Identity = "eyfrcc_identityapiurl";
			static Address = "eyfrcc_addressapiurl";
			static SAMGov = "eyfrcc_samgovapiurl";
		}

		class EygaApiContext {
			constructor(regardingId, regardingType, userId) {
				this.regardingId = regardingId ? regardingId.replace("{", "").replace("}", "") : null;
				this.regardingType = regardingType;
				this.userId = userId ? userId.replace("{", "").replace("}", "") : null;
			}
		}

		class EygaApiCall {
			constructor(displayName, apiType, apiMethod, httpMethod, xhrFields, contentType, processData) {
				this.displayName = displayName;
				this.apiType = apiType;
				this.apiMethod = apiMethod;
				this.httpMethod = httpMethod;
				this.xhrFields = xhrFields != undefined ? xhrFields : {};
				this.contentType = contentType != undefined ? contentType : "application/json";
				this.processData = processData != undefined ? processData : true;
			}
		}

		class ApiCall {
			static UploadDocument = new EygaApiCall("Upload Document", EygaApiType.Documents, "/upload", "POST", {}, false, false);
			static GetSASUrl = new EygaApiCall("Get SAS Url", EygaApiType.Documents, "/getsasurl", "GET");
			static DownloadDocument = new EygaApiCall("Download Document", EygaApiType.Documents, "/download", "POST", { responseType: "blob" });
			static DeleteDocument = new EygaApiCall("Delete Download", EygaApiType.Documents, "/delete", "DELETE");
			static GetDocumentsById = new EygaApiCall("Get Documents By Id", EygaApiType.Documents, "/searchbytags", "POST");
			static IdentityRequest = new EygaApiCall("Initiate Identity Request", EygaApiType.Identity, "/requests", "POST");
			static ValidateAddress = new EygaApiCall("Validate Address", EygaApiType.Address, "/validate", "POST");
			static GetSAMGovEntity = new EygaApiCall("Get SAM.gov Entity", EygaApiType.SAMGov, "/entities", "GET");
			static GetSAMGovExclusion = new EygaApiCall("Get SAM.gov Exclusion", EygaApiType.SAMGov, "/exclusions", "GET");
		}

		class Dictionary {
			constructor() {
				this._results = {};
			}

			add = (identifier, result) => (this._results[identifier] = result);
			get = (identifier) => this._results[identifier];
			remove = (identifier) => delete this._results[identifier];
		}

		const StepNames = Object.freeze({
			RiskIndicator: "Risk Indicator",
		});

		const RiskAssessmentOutcomeType = Object.freeze({
			AddFieldToReviewChecklist: 643_260_000,
			AddFieldToApplication: 643_260_001,
			AddStageToReviewProcess: 643_260_002,
			AdjustReportingFrequency: 643_260_003,
			DenyApplication: 643_260_004,
		});

		// Values are stored as strings because that's how they are read from the hidden input
		const ApplicationTableUsages = {
			AsAnApplicationTable: "643260000",
			AsASecondaryReportTable: "643260002",
			AsAThirdPartyTable: "643260006",
			ForOtherApplicationData: "643260001",
			ForNonApplicationData: "643260005",
		};

		const SaveDraftResponseCodes = {
			Success: 200,
			Error: 400,
			NoUnsavedChanges: 304,
		};

		var saveSession = function (name, obj) {
			sessionStorage.setItem(name, JSON.stringify(obj));
			return true;
		};

		var getSession = function (name) {
			var obj = {};
			var itemFromStorage = sessionStorage.getItem(name);
			if (itemFromStorage !== "undefined") {
				obj = JSON.parse(itemFromStorage);
			}
			return obj;
		};

		// Given the ID of a step on an application, "opens" the div for that step, swapping the images appropriately
		var openAccordian = function (id) {
			var image = $(`#${id}-image`); // Remove after all application forms have been published
			var accordianContent = $(`#${id}`);
			var accordianHeader = $(`#${id}-accordion`); // Remove after all application forms have been published
			var accordianHeaderButton = $(`#${id}-accordion button`);
			var accordianHeaderImage = $(`#${id}-accordion i`);

			if (accordianHeader.hasClass("disabled") || accordianHeaderButton.prop("disabled")) {
				return;
			}

			if (accordianContent.hasClass("hidden")) {
				accordianHeaderImage.removeClass("glyphicon-menu-right");
				accordianHeaderImage.addClass("glyphicon-menu-down");
				accordianContent.removeClass("hidden");
				accordianHeaderButton.attr("aria-expanded", true);
				image.attr("src", "/Images/down-arrow.svg"); // Remove after all application forms have been published
			} else {
				accordianHeaderImage.removeClass("glyphicon-menu-down");
				accordianHeaderImage.addClass("glyphicon-menu-right");
				accordianContent.addClass("hidden");
				accordianHeaderButton.attr("aria-expanded", false);
				image.attr("src", "/Images/side-arrow.svg"); // Remove after all application forms have been published
			}
		};

		var handleTablePaging = function (previousPage, currentPage, serviceUrl, selectorPrefix, createRowCallback, setOnClickEvent) {
			var loadingIconSelector = `#${selectorPrefix}Loading`;
			$(loadingIconSelector).show();
			var noResultsMessage = `.${selectorPrefix}NoResultsMessage`;
			$(noResultsMessage).hide();
			$(`#${selectorPrefix}Next`).addClass("disabled");
			$(`#${selectorPrefix}Previous`).addClass("disabled");

			appAjax("Retrieving records...", {
				type: "GET",
				url: serviceUrl.replace("{0}", currentPage),
				contentType: "application/json",
				success: function (response) {
					var data = JSON.parse(response);
					if (data.results.length > 0) {
						$(loadingIconSelector).hide();
						_refreshTable(data.results, selectorPrefix, createRowCallback);
						_refreshPageList(currentPage, data.itemsPerPageCount, data, setOnClickEvent, selectorPrefix);
					} else {
						$(loadingIconSelector).hide();
						_displayNoResults(selectorPrefix);
						$("#page-list").empty();
						currentPage = previousPage;
						$(`#${selectorPrefix}Next`).removeClass("disabled");
						$(`#${selectorPrefix}Previous`).removeClass("disabled");
					}
				},
				failure: function (res) {
					currentPage = previousPage;
				},
			});

			return currentPage;
		};

		var _refreshTable = function (results, selectorPrefix, createRowCallback) {
			//clear all rows
			$(`#${selectorPrefix}Table`).find("tbody>tr").remove();

			//populate table with paginated data
			for (let i = 0; i < results.length; i++) {
				$(`#${selectorPrefix}Table`).find("tbody").append(createRowCallback(results[i]));
			}

			// initialize any popover elements that were added
			$('[data-toggle="popover"]').popover();
		};

		var _refreshPageList = function (currentPage, itemsPerPage, result, setOnClickEvent, selectorPrefix) {
			var pageButtonList = $(`#${selectorPrefix}-page-list-custom`);
			pageButtonList.empty();

			//making this reusable for components with pagination in a for loop
			var sectionSelector;
			if (result.thirdPartyId) {
				sectionSelector = result.thirdPartyId;
			}

			if (!itemsPerPage) itemsPerPage = 10;
			var totalPages = Math.ceil(result.totalRecordCount / itemsPerPage);

			//remove pagination for 1 page
			if (totalPages == 1) {
				return;
			}

			//add left arrow - disabled if on page 1
			var previousPage = currentPage - 1;
			if (previousPage == 0) {
				pageButtonList.append(
					`<li class="disabled"><a id="${selectorPrefix}Previous" data-page="${previousPage}" aria-label="Previous page" title="Previous Page" class="entity-pager-prev-link" data-original-title="Previous page"><span aria-hidden="true">&lt;</span></a></li>`
				);
			} else {
				pageButtonList.append(
					`<li><a href="javascript:void(0)" id="${selectorPrefix}Previous" data-page="${previousPage}" aria-label="Previous page" title="Previous Page" class="entity-pager-prev-link" data-original-title="Previous page"><span aria-hidden="true">&lt;</span></a></li>`
				);
				pageButtonList
					.children("li")
					.last()
					.on("click", function () {
						if (sectionSelector) {
							setOnClickEvent(previousPage, sectionSelector);
						} else {
							setOnClickEvent(previousPage);
						}
					});
			}

			//determine range of buttons around selected page

			//scenario 1: beginning of list
			if (currentPage < 8 || (currentPage == 8 && totalPages == 8)) {
				//if there are less than 8 pages don't need ellipses or last page
				if (totalPages <= 8) {
					_createPageLinks(1, totalPages, currentPage, setOnClickEvent, selectorPrefix, sectionSelector);
				} else {
					_createPageLinks(1, 8, currentPage, setOnClickEvent, selectorPrefix, sectionSelector);
					//is this check really necessary??
					if (totalPages != 9) {
						pageButtonList.append(
							`<li class="disabled"><a aria-label="ellipsis indicating non-visible pages" data-page=".." aria-disabled="true"><span aria-hidden="true">..</span></a></li>`
						);
					}
					pageButtonList.append(
						`<li><a href="javascript:void(0)" aria-label="page ${totalPages}" data-page="${totalPages}" aria-current="false">${totalPages}</a></li>`
					);
					pageButtonList
						.children("li")
						.last()
						.on("click", function () {
							if (sectionSelector) {
								setOnClickEvent(totalPages, sectionSelector);
							} else {
								setOnClickEvent(totalPages);
							}
						});
				}
			}
			//display first page and ellipses for following two scenarios
			else {
				//display page 1
				pageButtonList.append(`<li><a href="javascript:void(0)" aria-label="page 1" data-page="1" aria-current="false">1</a></li>`);
				pageButtonList
					.children("li")
					.last()
					.on("click", function () {
						if (sectionSelector) {
							setOnClickEvent(1, sectionSelector);
						} else {
							setOnClickEvent(1);
						}
					});
				//display ellipses
				pageButtonList.append(
					`<li class="disabled"><a aria-label="ellipsis indicating non-visible pages" data-page=".." aria-disabled="true"><span aria-hidden="true">..</span></a></li>`
				);

				//scenario 2: showing end of list
				if (currentPage > totalPages - 7) {
					_createPageLinks(totalPages - 7, totalPages, currentPage, setOnClickEvent, selectorPrefix, sectionSelector);
				}
				//scenario 3: show middle of list
				else {
					_createPageLinks(currentPage - 4, currentPage + 4, currentPage, setOnClickEvent, selectorPrefix, sectionSelector);
					//display ellipses
					pageButtonList.append(
						`<li class="disabled"><a aria-label="ellipsis indicating non-visible pages" data-page=".." aria-disabled="true"><span aria-hidden="true">..</span></a></li>`
					);
					//display last page
					pageButtonList.append(
						`<li><a href="javascript:void(0)" aria-label="page ${totalPages}" data-page="${totalPages}" aria-current="false">${totalPages}</a></li>`
					);
					pageButtonList
						.children("li")
						.last()
						.on("click", function () {
							if (sectionSelector) {
								setOnClickEvent(totalPages, sectionSelector);
							} else {
								setOnClickEvent(totalPages);
							}
						});
				}
			}

			//add next arrow - disable if no more records
			var nextPage = currentPage + 1;
			if (nextPage <= totalPages || result.moreRecords) {
				//display extra pages if reached query limit but still additional pages
				if (currentPage == totalPages && result.moreRecords) {
					pageButtonList.append(
						`<li><a href="javascript:void(0)" aria-label="page ${nextPage}" data-page="${nextPage}" aria-current="false">${nextPage}</a></li>`
					);
					pageButtonList
						.children("li")
						.last()
						.on("click", function () {
							if (sectionSelector) {
								setOnClickEvent(nextPage, sectionSelector);
							} else {
								setOnClickEvent(nextPage);
							}
						});
				}

				pageButtonList.append(
					`<li><a href="javascript:void(0)" id="${selectorPrefix}Next" data-page="${nextPage}" aria-label="Next page" title="Next Page" class="entity-pager-next-link" data-original-title="Next page"><span aria-hidden="true">&gt;</span></a></li>`
				);
				pageButtonList
					.children("li")
					.last()
					.on("click", function () {
						if (sectionSelector) {
							setOnClickEvent(nextPage, sectionSelector);
						} else {
							setOnClickEvent(nextPage);
						}
					});
			} else {
				pageButtonList.append(
					`<li class="disabled"><a id="${selectorPrefix}Next" data-page="${nextPage}" aria-label="Next page" title="Next Page" class="entity-pager-next-link" data-original-title="Next page"><span aria-hidden="true">&gt;</span></a></li>`
				);
			}
			if (currentPage != 1) {
				$("a[data-page=" + currentPage + "]").focus();
			}
		};

		var _createPageLinks = function (startIndex, endIndex, currentPage, setOnClickEvent, selectorPrefix, sectionSelector) {
			var pageButtonList = $(`#${selectorPrefix}-page-list-custom`);

			for (var i = startIndex; i <= endIndex; i++) {
				(function (buttonNum) {
					pageButtonList.append(
						`<li class="${buttonNum == currentPage ? "active" : ""}"><a href="javascript:void(0)" aria-label="page ${buttonNum}" data-page="${buttonNum}" aria-current="false">${buttonNum}</a></li>`
					);
					pageButtonList
						.children("li")
						.last()
						.on("click", function () {
							if (sectionSelector) {
								setOnClickEvent(buttonNum, sectionSelector);
							} else {
								setOnClickEvent(buttonNum);
							}
						});
				})(i);
			}
		};

		var _displayNoResults = function (selectorPrefix) {
			$(`#${selectorPrefix}Table`).find("tbody>tr").remove();
			$(`.${selectorPrefix}NoResultsMessage`).show();
		};

		var _showHidePageButtons = function (moreRecords, currentPage, selectorPrefix) {
			if (!moreRecords) {
				_disablePageButton(`#${selectorPrefix}Next`);
			} else {
				_enablePageButton(`#${selectorPrefix}Next`);
			}

			if (currentPage == 1) {
				_disablePageButton(`#${selectorPrefix}Previous`);
			} else {
				_enablePageButton(`#${selectorPrefix}Previous`);
			}

			if (!moreRecords && currentPage === 1) {
				_disablePageButton(`#${selectorPrefix}PageCount`);
			} else {
				_enablePageButton(`#${selectorPrefix}PageCount`);
			}
		};

		var _enablePageButton = function (buttonSelector) {
			$(buttonSelector).parent().show();
		};

		var _disablePageButton = function (buttonSelector) {
			$(buttonSelector).parent().hide();
		};

		var formatDate = function (date) {
			if (!date || date === "") {
				return date;
			}
			const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
			const day = date.substr(3, 2);
			const month = monthNames[Number(date.substr(0, 2)) - 1];
			const year = date.substr(6, 4);
			return `${month} ${day}, ${year}`;
		};

		var searchForError = function (nameKey, myArray) {
			if (myArray && myArray.Blob) {
				for (var i = 0; i < myArray.Blob.length; i++) {
					if (myArray.Blob[i].Name["#text"] === nameKey) {
						return true;
					}
				}
				if (myArray && !Array.isArray(myArray.Blob)) {
					if (myArray.Blob.Name["#text"] === nameKey) {
						return true;
					}
				}
			}
			return false;
		};

		var _safeAjax = function safeAjax(ajaxOptions) {
			var deferredAjax = $.Deferred();
			shell
				.getTokenDeferred()
				.done(function (token) {
					// Add headers for ajax
					if (!ajaxOptions.headers) {
						$.extend(ajaxOptions, {
							headers: {
								__RequestVerificationToken: token,
							},
						});
					} else {
						ajaxOptions.headers["__RequestVerificationToken"] = token;
					}
					$.ajax(ajaxOptions)
						.done(function (data, textStatus, jqXHR) {
							validateLoginSession(data, textStatus, jqXHR, deferredAjax.resolve);
						})
						.fail(deferredAjax.reject); //ajax
				})
				.fail(function () {
					deferredAjax.rejectWith(this, arguments); // On token failure pass the token ajax and args
				});
			return deferredAjax.promise();
		};

		var appAjax = function (processingMsg, ajaxOptions) {
			FRCC.Portal.Notification.show(processingMsg);
			return _safeAjax(ajaxOptions)
				.fail(function (response) {
					if (response.responseJSON) {
						if (response.responseJSON.error.innererror) {
							openConfirmationModal("Error", response.responseJSON.error.innererror.message, "OK", "Cancel", true, true, false);
						} else {
							openConfirmationModal("Error", response.responseJSON.error.message, "OK", "Cancel", true, true, false);
						}
					} else {
						openConfirmationModal("Error", "Web API is not available...", "OK", "Cancel", true, true, false);
					}
				})
				.always(FRCC.Portal.Notification.hide);
		};

		const asyncAppAjax = async function (ajaxOptions, skipSettingCache = true) {
			// Retrieve data from cache (if available)
			const cachedData = retrieveAPIResponseFromCache(ajaxOptions.url, ajaxOptions.type);

			// If cached data was retrieved, serve immediately while making background call to API to refresh cache
			if (cachedData) {
				makeAjaxRequest(ajaxOptions, skipSettingCache);
				return $.Deferred().resolve(cachedData).promise();
			} else {
				return makeAjaxRequest(ajaxOptions, skipSettingCache);
			}
		};

		const makeAjaxRequest = async function (ajaxOptions, skipSettingCache) {
			const deferredAjax = $.Deferred();

			shell
				.getTokenDeferred()
				.done(function (token) {
					if (!ajaxOptions.headers) {
						$.extend(ajaxOptions, {
							headers: {
								__RequestVerificationToken: token,
							},
						});
					} else {
						ajaxOptions.headers["__RequestVerificationToken"] = token;
					}
					$.ajax(ajaxOptions)
						.done(function (data, textStatus, jqXHR) {
							populateAPIResponseCache(ajaxOptions.url, ajaxOptions.type, data, skipSettingCache);
							validateLoginSession(data, textStatus, jqXHR, deferredAjax.resolve);
						})
						.fail(deferredAjax.reject);
				})
				.fail(function () {
					deferredAjax.rejectWith(this, arguments);
				});

			return deferredAjax.promise();
		};

		const populateAPIResponseCache = async function (key, requestType, data, skipSettingCache) {
			if (skipSettingCache) {
				return;
			}

			if (requestType !== "GET") {
				return;
			}

			const cacheDuration = await getEYGAConfigurationSetting("eyfrcc_cacheduration");
			if (cacheDuration == 0) {
				return;
			}

			const expires = Date.now() + cacheDuration * 60 * 1000;
			const cacheEntry = { data: data, expires: expires };

			try {
				localStorage.setItem(key, JSON.stringify(cacheEntry));
			} catch (error) {
				console.error(`Error occurred setting localStorage: ${error}`);
			}
		};

		const retrieveAPIResponseFromCache = function (key, requestType) {
			if (requestType !== "GET") {
				return null;
			}

			const cachedEntryObject = localStorage.getItem(key);
			if (!cachedEntryObject) {
				return null;
			}

			const cachedEntry = JSON.parse(cachedEntryObject);
			if (Date.now() > cachedEntry.expires) {
				localStorage.removeItem(key);
				return null;
			}

			return cachedEntry.data;
		};

		var _isOldIE = function (userAgent) {
			var msie = userAgent.indexOf("MSIE");
			var trident = userAgent.indexOf("Trident/");
			if (msie > 0 || trident > 0) {
				return true; // IE 10 or older
			}
			return false; // other browser, IE 11, or Edge
		};

		var showIEWarning = function () {
			if (_isOldIE(navigator.userAgent)) {
				var ieWarning = document.getElementById("ie-banner");
				if (ieWarning) {
					ieWarning.setAttribute("style", "display: block;");
				}
			}
		};

		var _generateExpirationDate = function () {
			var date = new Date();
			date.setDate(date.getDate() + 1);
			return date;
		};

		var _generateCurrentDatePlusOneMinute = function () {
			var date = new Date();
			var oneMinuteInMilliSeconds = 60000;
			date = new Date(date.getTime() + oneMinuteInMilliSeconds);
			return date;
		};

		var getEYGAConfigurationSetting = async (settingName) => {
			var refreshSetting = true;
			var configurationSetting = window.sessionStorage.getItem(settingName);

			if (configurationSetting) {
				configurationSetting = JSON.parse(configurationSetting);
				var currentDatePlusOneMinute = _generateCurrentDatePlusOneMinute();
				if (currentDatePlusOneMinute.getTime() <= new Date(configurationSetting.expirationDate).getTime()) {
					refreshSetting = false;
				}
			}

			if (refreshSetting) {
				var settingValue = await _getEYGAConfigurationSettingFromCrm(settingName);
				sessionStorage.setItem(settingName, JSON.stringify(settingValue));
			}

			configurationSetting = JSON.parse(window.sessionStorage.getItem(settingName));
			return configurationSetting.value[0][settingName];
		};

		var _getEYGAConfigurationSettingFromCrm = function (settingName) {
			return new Promise(function (resolve, reject) {
				_safeAjax({
					type: "GET",
					url: `/_api/eyfrcc_eygaconfigurations?$select=eyfrcc_eygaconfigurationid,eyfrcc_name,${settingName}`,
					contentType: "application/json",
					success: function (result, status, xhr) {
						if (!result || !result.value || result.value.length < 1 || !result.value[0][settingName]) {
							return null;
						}

						result.expirationDate = _generateExpirationDate();
						resolve(result);
					},
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
						reject(error);
					},
				});
			});
		};

		var _getApiToken = function () {
			return new Promise(function (resolve, reject) {
				var apiTokenKey = "apiToken";
				_getApiTokenFromApi()
					.then((value) => {
						window.sessionStorage.setItem(apiTokenKey, JSON.stringify(value));
						resolve(value.eyfrcc_token);
					})
					.catch((reason) => reject(reason));
			});
		};

		var _getApiTokenFromApi = function () {
			return new Promise(function (resolve, reject) {
				_safeAjax({
					type: "GET",
					url: `/_api/eyfrcc_apitokens(${_generateGuid()})?$select=eyfrcc_token,eyfrcc_expirationdate`,
					contentType: "application/json",
					success: function (res, status, xhr) {
						resolve(res);
					},
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
						reject(error);
					},
				});
			});
		};

		var _generateGuid = function () {
			var randomGuid = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(/x/g, function (c) {
				var r = (Math.random() * 16) | 0,
					v = c === "x" ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
			return randomGuid;
		};

		var callEygaApi = async (apiCall, apiContext, payload, queryParams = null) => {
			var results = await Promise.all([getEYGAConfigurationSetting(apiCall.apiType), getHeaders(apiCall.displayName, apiContext)]);

			if (!results[0] || !results[1]) {
				return null; // Error messages for retrieval failure handled within respective calls
			}

			return new Promise(function (resolve, reject) {
				$.ajax({
					type: apiCall.httpMethod,
					url: results[0] + apiCall.apiMethod + (queryParams ? queryParams : ""),
					headers: results[1],
					data: apiCall.contentType == "application/json" ? JSON.stringify(payload) : payload,
					contentType: apiCall.contentType,
					processData: apiCall.processData,
					xhrFields: apiCall.xhrFields,
					success: function (response, status, request) {
						resolve(response);
					},
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
						handleError(error, true);
						reject(error);
					},
				});
			});
		};

		var getHeaders = function (apiAction, apiContext, generateEventId = true) {
			return Promise.all([
				_getApiToken(),
				_createEvent(generateEventId, apiAction, apiContext.regardingId, apiContext.regardingType, apiContext.userId),
				getEYGAConfigurationSetting("eyfrcc_eygaapikey"),
			])
				.then((result) => {
					if (!result || result.length < 1) {
						throw new Error("ERROR: Unexpected error retrieving API call headers");
					}
					if (!result[0] || result[0] == "") {
						throw new Error("ERROR: Unexpected error retrieving API token");
					}
					if (!result[2] || result[2] == "") {
						throw new Error("ERROR: Could not retrieve EYGA API Key; check that a valid key has been entered in the configuration");
					}
					return _returnHeaders(result[2], result[1], apiContext.regardingId, result[0]);
				})
				.catch((error) => handleError(error));
		};

		var handleError = function (errorMessage, displayError = false) {
			if (displayError) {
				alert(errorMessage);
			}
			console.log(errorMessage);
		};

		var handleAjaxError = function (request, status, error) {
			console.log(error);
		};

		var downloadPortalPageDocument = function (portalPageDocumentId) {
			var documentRecordUrl = `/_api/eyfrcc_portalpagedocuments(${portalPageDocumentId})/eyfrcc_document/$value`;
			window.open(documentRecordUrl, "_self");
		};

		var _returnHeaders = function (apiKey, eventId, regardingId, apiToken) {
			if (eventId) {
				return { "eyga-api-key": apiKey, "EYGA-EventId": eventId, "EYGA-RecordId": regardingId, "EYGA-Authorization": apiToken };
			}

			if (regardingId) {
				return { "eyga-api-key": apiKey, "EYGA-RecordId": regardingId, "EYGA-Authorization": apiToken };
			}

			if (!apiToken || apiToken == "") {
				handleError("ERROR: An error occured attempting to retrieve the API token", true);
				return null;
			}

			if (!apiKey || apiKey == "") {
				handleError("ERROR: An error occured attempting to retrieve the API key; check if key is present in the configuration settings", true);
				return null;
			}

			return { "eyga-api-key": apiKey, "EYGA-Authorization": apiToken };
		};

		var _createEvent = function (generateEventId, apiAction, regardingId, regardingType, userId) {
			if (generateEventId && regardingId && regardingType && userId) {
				var event = {};
				event["eyfrcc_RegardingId_" + regardingType + "@odata.bind"] = `/${getEntitySetName(regardingType)}(${regardingId})`;
				event["eyfrcc_PortalUser@odata.bind"] = `/contacts(${userId})`;
				event["eyfrcc_name"] = apiAction;
				event["eyfrcc_source"] = 643260000; // Portal

				return new Promise(function (resolve, reject) {
					_safeAjax({
						type: "POST",
						url: "/_api/eyfrcc_events",
						contentType: "application/json",
						data: JSON.stringify(event),
						success: function (res, status, xhr) {
							var eventId = xhr.getResponseHeader("entityid");
							resolve(eventId);
						},
						error: function (request, status, error) {
							console.log("ERROR: Event creation for " + apiAction + " failed");
							handleAjaxError(request, status, error);
							resolve(); // Return nothing if event creation fails, but continue API call
						},
					});
				});
			} else {
				Promise.resolve();
			}
		};

		var getEntitySetName = (logicalName) => {
			if (!logicalName) {
				return logicalName;
			}
			if (logicalName.endsWith("s")) {
				return logicalName + "es";
			}
			if (logicalName.endsWith("y")) {
				return logicalName + "ies";
			}
			return logicalName + "s";
		};

		var handleRiskAssessmentOutcomes = async () => {
			var urlParams = new URLSearchParams(window.location.search);
			var parentAppId = urlParams.get("parentApplicationId");
			var childAppId = urlParams.get("formId");

			var outcomes = await _getRiskAssessmentOutcomes(childAppId, parentAppId);

			_handleAddFieldToApplicationOutcomes(outcomes);
			// Add code for any new logic for risk assessment outcomes here
		};

		var _handleAddFieldToApplicationOutcomes = function (outcomes) {
			var accordion = $(".accordion-title:contains('" + StepNames.RiskIndicator + "')").closest(".accordion");
			if (!accordion.length || !accordion.attr("id")) {
				return;
			}

			var contentId = accordion.attr("id").slice(0, -10);

			outcomes
				.filter((outcome) => outcome.eyfrcc_outcometype === RiskAssessmentOutcomeType.AddFieldToApplication && outcome.outcomefieldlogicalname)
				.forEach((outcome) => {
					var row = $(["#", contentId, " #", outcome.outcomefieldlogicalname].join("")).closest("tr");
					if (!row) {
						return;
					}

					if (outcome.applicationoutcomeid) {
						row.removeClass("hidden");
					} else {
						row.addClass("hidden");
					}
				});
		};

		var _getRiskAssessmentOutcomes = function (childAppId, parentAppid) {
			return new Promise(function (resolve, reject) {
				_safeAjax({
					type: "GET",
					url: ["/Services/GetRiskAssessmentOutcomesByApplication/?formId=", childAppId, "&parentApplicationId=", parentAppid].join(""),
					contentType: "application/json",
					success: function (res, status, xhr) {
						res = JSON.parse(res);
						resolve(res ? res.results : res);
					},
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
						reject(error);
					},
				});
			});
		};

		var showProgressIndicator = (message) => {
			$("p#progressIndicatorText").text(message || "Loading...");
			$("div#progressIndicator").addClass("visible");
		};

		var hideProgressIndicator = () => {
			$("div#progressIndicator").removeClass("visible");
		};

		var viewMessage = function (id, messagesData, regardingId, regardingType, userId) {
			if (!messagesData) {
				return;
			}

			var message = messagesData[id];
			if (!message) {
				return false;
			}

			$("#eyga-view-message-modal .modal-body-subject").text(message.Subject || "No subject");
			$("#eyga-view-message-modal .modal-body-description").html(message.Description);
			$("#eyga-view-message-modal").modal("show");

			$(".reply-button").click(function () {
				$("#eyga-view-message-modal").modal("hide");
				showCreateMessageModal(regardingId, regardingType, userId);
			});

			return false;
		};

		var showCreateMessageModal = async function (regardingId, regardingType, userId) {
			$("#eyga-create-message-modal").modal();
			$("#eyga-create-message-loading").show();
			$("#eyga-create-message-form").css("visibility", "hidden");

			const categorySelect = $("#eyga-create-message-file-category");

			_safeAjax({
				type: "GET",
				url: ["/Services/GetDocumentCategoriesForRecord/?regardingType=", regardingType, "&regardingId=", regardingId].join(""),
				contentType: "application/json",
				success: function (response, status, xhr) {
					response = JSON.parse(response);

					categorySelect.empty();
					categorySelect.append("<option 'Other'>Other</option>");
					response.Categories.forEach((category) => {
						if (category == "Other") {
							return;
						}
						categorySelect.append(`<option value='${category}'>${category}</option>`);
					});
					categorySelect.val("Other");

					$("#eyga-create-message-submit")
						.off("click")
						.click(() => _createMessageAndUploadFile(response.DocumentPath, response.Tag, regardingId, regardingType, userId));

					$("#eyga-create-message-loading").hide();
					$("#eyga-create-message-form").css("visibility", "visible");
				},
				error: function (request, status, error) {
					handleAjaxError(request, status, error);
				},
			});
		};

		var _createMessageAndUploadFile = async function (documentPath, tag, regardingId, regardingType, userId) {
			showProgressIndicator("Creating message...");

			try {
				await _safeAjax({
					type: "POST",
					url: "/_api/eyfrcc_messages",
					contentType: "application/json",
					data: JSON.stringify({
						[`eyfrcc_RegardingRecordId_${regardingType}@odata.bind`]: `/${getEntitySetName(regardingType)}(${regardingId})`,
						["eyfrcc_name"]: $("#eyga-create-message-subject").val(),
						["eyfrcc_content"]: $("#eyga-create-message-content").val(),
						["eyfrcc_direction"]: 643260000, // Incoming
					}),
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
					},
				});

				const file = $("#eyga-create-message-file-input").prop("files")?.[0];
				if (file) {
					const folderName = $("#eyga-create-message-file-category").find(":selected").val() || "Other";

					var now = new Date();
					var utcMinutes = now.getUTCSeconds() > 9 ? now.getUTCSeconds() : "0" + now.getUTCSeconds();
					var utcSeconds = now.getUTCSeconds() > 9 ? now.getUTCSeconds() : "0" + now.getUTCSeconds();
					var uploadDate = `${now.getUTCMonth() + 1}/${now.getUTCDate()}/${now.getUTCFullYear()} ${now.getUTCHours() % 12 || 12}-${now.getUTCMinutes().toString().padStart(2, "0")}-${now.getUTCSeconds().toString().padStart(2, "0")} ${now.getUTCHours() >= 12 ? "PM" : "AM"}`;
					var payload = new FormData();
					payload.append(
						"json",
						JSON.stringify({
							Name: file.name,
							DocumentFolder: folderName,
							RecordFolder: documentPath,
							Tags: {
								Id: tag,
								Folder: folderName,
								"Upload Date": uploadDate,
								Status: "Accepted",
							},
							OverwriteExisting: false,
						})
					);
					payload.append("file", file);

					var eygaApiContext = new EygaApiContext(regardingId, regardingType, userId);
					await callEygaApi(ApiCall.UploadDocument, eygaApiContext, payload);
				}
			} catch (error) {
				handleError(error);
			}

			hideProgressIndicator();
			$("#eyga-create-message-modal").modal("hide");
			$("#eyga-create-message-subject").val(null);
			$("#eyga-create-message-content").val(null);
			location.reload();
		};

		var openConfirmationModal = function (
			title = "Confirm",
			message = "Are you sure?",
			confirmLabel = "Confirm",
			cancelLabel = "Cancel",
			showAlert = false,
			showAlertDanger = false,
			showCancelOption = true
		) {
			return new Promise(function (resolve, reject) {
				var confirmModalErrorContainerSelector = "#eyga-confirm-modal .modal-body .modal-body-error-container";

				$("#eyga-confirm-modal").attr("aria-label", title);
				$("#eyga-confirm-modal .modal-title").text(title);

				if (showAlert) {
					$(confirmModalErrorContainerSelector).show();
					$("#eyga-confirm-modal .modal-body .modal-body-description").hide();

					showAlertDanger
						? $(confirmModalErrorContainerSelector).addClass("alert-danger").removeClass("alert-warning")
						: $(confirmModalErrorContainerSelector).removeClass("alert-danger").addClass("alert-warning");

					$(`${confirmModalErrorContainerSelector} .modal-body-error-description`).text(message);
				} else {
					$(confirmModalErrorContainerSelector).hide();
					$("#eyga-confirm-modal .modal-body .modal-body-description").show();

					$("#eyga-confirm-modal .modal-body .modal-body-description").text(message);
				}

				showCancelOption ? $("button.cancel").show() : $("button.cancel").hide();

				const confirmModal = $("#eyga-confirm-modal");
				const confirmButton = $("#eyga-confirm-modal button.primary");
				const closeButtons = $("#eyga-confirm-modal button.cancel, #eyga-confirm-modal button.form-close");

				confirmButton.text(confirmLabel);
				confirmButton.click(() => {
					confirmModal.modal("hide");
					confirmButton.off("click");
					closeButtons.off("click");
					resolve(true);
				});

				$("#eyga-confirm-modal button.cancel").text(cancelLabel);
				closeButtons.click(() => {
					confirmModal.modal("hide");
					confirmButton.off("click");
					closeButtons.off("click");
					resolve(false);
				});

				confirmModal.modal();
			});
		};

		var openCancellationModal = function (applicationId, redirectToApplications = false) {
			$(".modal-body-error-container").hide();
			$("#eyga-cancel-application-modal").modal("show");

			$(".cancel-application-button")
				.off("click")
				.on("click", function () {
					_cancelApplication(applicationId, redirectToApplications);
				});
		};

		var openUpdateProfileModal = function (userId, userFirstName, userMiddleName, userLastName, userSuffix, userEmailAddress, userTelephone) {
			_loadProfileFields(userFirstName, userMiddleName, userLastName, userSuffix, userEmailAddress, userTelephone);
			$(".modal-body-error-container").hide();
			$("#eyga-update-profile-modal").modal();

			$("#eyga-update-profile-submit")
				.off("click")
				.on("click", function () {
					if (!_requiredFieldsPopulated("#eyga-update-profile-modal label.required")) {
						_handleModalError("Please fill in the required fields before saving.");
						return;
					}

					var firstname = $("#eyga-update-profile-firstname").val();
					var middlename = $("#eyga-update-profile-middlename").val();
					var lastname = $("#eyga-update-profile-lastname").val();
					var suffix = $("#eyga-update-profile-suffix").val();
					var emailAddress = $("#eyga-update-profile-emailaddress").val();
					var telephone = $("#eyga-update-profile-telephone").val();

					var payload = JSON.stringify({
						["firstname"]: firstname,
						["lastname"]: lastname,
						["middlename"]: middlename,
						["eyfrcc_suffix"]: suffix,
						["emailaddress1"]: emailAddress,
						["telephone1"]: telephone,
					});

					_updateProfile(userId, payload);
				});
		};

		var _loadProfileFields = function (userFirstName, userMiddleName, userLastName, userSuffix, userEmailAddress, userTelephone) {
			$("#eyga-update-profile-firstname").val(userFirstName);
			$("#eyga-update-profile-middlename").val(userMiddleName);
			$("#eyga-update-profile-lastname").val(userLastName);
			$("#eyga-update-profile-suffix").val(userSuffix);
			$("#eyga-update-profile-emailaddress").val(userEmailAddress);
			$("#eyga-update-profile-telephone").val(userTelephone);
		};

		var openUpdateOrganizationModal = async function (create, orgDetail) {
			var samGovEnabled = orgDetail.samGovEnabled;
			var userId = orgDetail.userId;
			var organizationId = orgDetail.organizationId;
			if (!create) {
				$("#eyga-update-organization-modal .modal-title").text("Edit Organization");
				_loadOrganizationFields(orgDetail);
			} else {
				$("#eyga-update-organization-modal .modal-title").text("Create Organization");
				$("#uei-number-yes").prop("checked", true);
				$("#update-organization-has-uei").show();
				$("#update-organization-no-uei").hide();
			}

			if (!samGovEnabled) {
				$(".uei-yes-no-container").hide();
				$("#update-organization-has-uei").hide();
				$("#update-organization-no-uei").show();
				$("#uei-number-no").prop("checked", true);
			}

			_clearValidationErrors();
			$("#eyga-update-organization-modal").modal();

			$("#eyga-update-organization-submit")
				.off("click")
				.on("click", function () {
					var selector =
						$('input[name="uei-number"]:checked').val() === "false"
							? "#update-organization-no-uei label.required"
							: "#update-organization-has-uei label.required";
					if (!_requiredFieldsPopulated(selector)) {
						_handleModalError("Please fill in the required fields before saving.");
						return;
					}

					var hasUniqueIdentifier = $('input[name="uei-number"]:checked').val() === "true";
					if (hasUniqueIdentifier) {
						showProgressIndicator("Creating Organization...");

						var uniqueIdentifier = $("#eyga-update-organization-uniqueidentifier").val();
						_safeAjax({
							type: "GET",
							url: `/_api/accounts?$filter=eyfrcc_uniqueidentifier eq '${uniqueIdentifier}'`,
							contentType: "application/json",
							success: async function (response, status, xhr) {
								if (response.value.length !== 0) {
									_handleModalError(
										null,
										'<span>This UEI number has already been assigned to another organization. Please contact the support team at <span style="color: red;text-decoration: underline;">support@americorps.gov</span> or <span style="font-weight: bold;">800-555-1234</span> to be added to this organization.</span>'
									);
									return;
								}

								var payload = JSON.stringify({
									["eyfrcc_hasuniqueidentifier"]: true,
									["eyfrcc_uniqueidentifier"]: uniqueIdentifier,
									["name"]: "(No name)",
									["eyfrcc_lastdatarefresh"]: _getUtcDateNow(),
								});
								if (create) {
									_createOrganization(userId, payload);
								} else {
									_updateOrganization(organizationId, payload);
								}
							},
							error: function (request, status, error) {
								_handleModalError(request.responseJSON.error.innererror.message);
								handleAjaxError(request, status, error);
							},
						});
					} else {
						if (!_validateOrganizationFields()) {
							return;
						}

						showProgressIndicator("Creating Organization...");

						var employerIdentificationNumber = $("#eyga-update-organization-employeridentificationnumber").val();
						var name = $("#eyga-update-organization-name").val();
						var type = $("#eyga-update-organization-type").val();
						var street1 = $("#eyga-update-organization-address-street1").val();
						var street2 = $("#eyga-update-organization-address-street2").val();
						var city = $("#eyga-update-organization-address-city").val();
						var stateCode = $("#eyga-update-organization-address-state").val();
						var postalCode = $("#eyga-update-organization-address-postalcode").val();
						var country = $("#eyga-update-organization-address-country").val();
						var telephone = $("#eyga-update-organization-telephone").val();
						var extension = $("#eyga-update-organization-extension").val();

						var payload = JSON.stringify({
							["eyfrcc_hasuniqueidentifier"]: false,
							["eyfrcc_uniqueidentifier"]: null,
							["eyfrcc_taxpayeridentificationnumber"]: employerIdentificationNumber,
							["name"]: name,
							["eyfrcc_organizationalentitytype"]: type,
							["address1_line1"]: street1,
							["address1_line2"]: street2,
							["address1_city"]: city,
							["address1_stateorprovince"]: stateCode,
							["address1_postalcode"]: postalCode,
							["address1_country"]: country,
							["telephone1"]: telephone,
							["eyfrcc_phoneextension"]: extension,
						});

						if (create) {
							_createOrganization(userId, payload);
						} else {
							_updateOrganization(organizationId, payload);
						}
					}
				});

			$('input[name="uei-number"]')
				.off("change")
				.on("change", function () {
					if ($('input[name="uei-number"]:checked').val() === "true") {
						$("#update-organization-has-uei").show();
						$("#update-organization-no-uei").hide();
					} else {
						$("#update-organization-has-uei").hide();
						$("#update-organization-no-uei").show();
					}
				});
		};

		var _validateOrganizationFields = function () {
			_clearValidationErrors();

			var ein = $("#eyga-update-organization-employeridentificationnumber").val();
			if (ein === "") {
				return true;
			}

			var einPattern = /^\d{9}$/;
			if (!einPattern.test(ein)) {
				$("#eyga-update-organization-employeridentificationnumber").parent().addClass("has-error");
				_handleModalError(
					"",
					'<a href="#eyga-update-organization-employeridentificationnumber">Employer Identification Number (EIN)</a> must be 9 digits.'
				);
				return false;
			}

			var phoneNumber = $("#eyga-update-organization-telephone").val();
			if (phoneNumber === "") {
				return true;
			}

			var numbersOnlyPattern = /^\d+$/;
			if (!numbersOnlyPattern.test(phoneNumber)) {
				$("#eyga-update-organization-telephone").parent().addClass("has-error");
				_handleModalError("", '<a href="#eyga-update-organization-telephone">Phone</a> must contain only digits.');
				return false;
			}

			var extension = $("#eyga-update-organization-extension").val();
			if (extension === "") {
				return true;
			}

			if (!numbersOnlyPattern.test(extension)) {
				$("#eyga-update-organization-extension").parent().addClass("has-error");
				_handleModalError("", '<a href="#eyga-update-organization-extension">Extension</a> must contain only digits.');
				return false;
			}

			return true;
		};

		var _clearValidationErrors = function () {
			$(".has-error").removeClass("has-error");
			$(".modal-body-error-container").hide();
		};

		var _loadOrganizationFields = function (orgDetail) {
			if (orgDetail.orgHasUniqueIdentifier) {
				$("#uei-number-yes").prop("checked", true);
				$("#update-organization-has-uei").show();
				$("#update-organization-no-uei").hide();
			} else {
				$("#uei-number-no").prop("checked", true);
				$("#update-organization-has-uei").hide();
				$("#update-organization-no-uei").show();
			}

			$("#eyga-update-organization-unqiueidentifier").val(orgDetail.orgUniqueIdentifier);
			$("#eyga-update-organization-employeridentificationnumber").val(orgDetail.orgEmployerIdentificationNumber);
			$("#eyga-update-organization-name").val(orgDetail.orgName);
			$("#eyga-update-organization-type").val(orgDetail.orgType);
			$("#eyga-update-organization-address-street1").val(orgDetail.orgStreet1);
			$("#eyga-update-organization-address-street2").val(orgDetail.orgStreet2);
			$("#eyga-update-organization-address-city").val(orgDetail.orgCity);
			$("#eyga-update-organization-address-state").val(orgDetail.orgState);
			$("#eyga-update-organization-address-postalcode").val(orgDetail.orgPostalCode);
			$("#eyga-update-organization-address-country").val(orgDetail.orgCountry);
			$("#eyga-update-organization-telephone").val(orgDetail.orgTelephone);
			$("#eyga-update-organization-extension").val(orgDetail.orgExtension);
		};

		var _convertToDateObject = function (dateString) {
			if (dateString === null) {
				return null;
			}

			var dateParts = dateString.split("-");
			var year = dateParts[0];
			var month = dateParts[1];
			var day = dateParts[2];

			var dateObject = new Date(year, month - 1, day);

			return dateObject;
		};

		var _getUtcDateNow = function () {
			var utcDate = new Date(
				Date.UTC(
					new Date().getUTCFullYear(),
					new Date().getUTCMonth(),
					new Date().getUTCDate(),
					new Date().getUTCHours(),
					new Date().getUTCMinutes(),
					new Date().getUTCSeconds(),
					new Date().getUTCMilliseconds()
				)
			);

			return utcDate;
		};

		var _getApplicationTableFields = function (entityName) {
			return new Promise(function (resolve, reject) {
				_safeAjax({
					type: "GET",
					url: `/Services/GetApplicationTableFields/?entityname=${entityName}`,
					contentType: "application/json",
					success: function (res, status, xhr) {
						res = JSON.parse(res);
						resolve(res);
					},
					error: function (request, status, error) {
						handleAjaxError(request, status, error);
						reject(error);
					},
				});
			});
		};

		var openUpsertAppTableRecordModal = function (modalId, entityName, options, existingRecordId) {
			// Reset values
			$(`#${modalId} input.eyga-app-table-field`).val(null);
			$(`#${modalId} select.eyga-app-table-field`).each(() => {
				$(this).val($(this).find("option:first").val());
			});
			// Clear any errors
			$(".modal-body-error-container").hide();

			if (options?.modalTitle) {
				$(`#${modalId} .modal-title`).text(options.modalTitle || "Create Record");
			}

			var recordValues = options?.recordValues || {};

			$(`#${modalId} .eyga-app-table-record-submit`)
				.off("click")
				.on("click", async function () {
					if (!_requiredFieldsPopulated(`#${modalId} label.required`)) {
						_handleModalError("Please fill in the required fields before saving.");
						return;
					}

					$(`#${modalId} .eyga-app-table-field`).each(function () {
						var fieldIdentifier = $(this).data("apptablefield");
						recordValues[fieldIdentifier] = $(this).val();
					});

					await _upsertAppTableRecord(
						entityName,
						recordValues,
						options?.progressMessage,
						options?.successCallback,
						existingRecordId,
						options?.entitySetName
					);
				});

			$(`#${modalId}`).modal("show");
		};

		var _convertAppTableRecordToEntity = async function (entityName, record) {
			var appTableFields = await _getApplicationTableFields(entityName);
			var entity = {};
			for (var key of Object.keys(record)) {
				var identifierStart = key.indexOf("{");
				var configIdentifier = identifierStart >= 0 ? key.substring(identifierStart + 1, key.indexOf("}")) : key;
				if (!appTableFields[configIdentifier]) {
					continue;
				}

				var entityPropertyName = appTableFields[configIdentifier];
				entityPropertyName = key.replace("{", "").replace("}", "").replace(configIdentifier, entityPropertyName);
				entity[entityPropertyName] = record[key] ? record[key] : null;
			}

			return entity;
		};

		var _upsertAppTableRecord = function (entityName, record, progressMessage, successCallback, existingRecordId, entitySetName) {
			showProgressIndicator(progressMessage || "Saving...");

			if (!entitySetName) {
				entitySetName = getEntitySetName(entityName);
			}

			return _convertAppTableRecordToEntity(entityName, record)
				.then((entity) => {
					_safeAjax({
						type: existingRecordId ? "PATCH" : "POST",
						url: existingRecordId ? `/_api/${entitySetName}(${existingRecordId})` : `/_api/${entitySetName}`,
						data: JSON.stringify(entity),
						contentType: "application/json",
						success: function () {
							hideProgressIndicator();
							$(".modal").modal("hide");
							if (successCallback) {
								successCallback();
							}
						},
						error: function (request, status, error) {
							_handleModalError(request.responseJSON.error.innererror.message);
							handleAjaxError(request, status, error);
						},
					});
				})
				.catch((error) => {
					_handleModalError(error);
					handleAjaxError(error);
				});
		};

		var openCreateOrganizationInvitationModal = function (userId, organizationId) {
			$("#eyga-create-organization-invitation-firstname").val(null);
			$("#eyga-create-organization-invitation-lastname").val(null);
			$("#eyga-create-organization-invitation-emailaddress").val(null);
			$("#eyga-create-organization-invitation-contacttype").val($("#eyga-create-organization-invitation-contacttype option:first").val());
			$(".modal-body-error-container").hide();
			$("#eyga-create-organization-invitation-modal").modal();

			$("#eyga-create-organization-invitation-submit")
				.off("click")
				.on("click", function () {
					if (!_requiredFieldsPopulated("#eyga-create-organization-invitation-modal label.required")) {
						_handleModalError("Please fill in the required fields before saving.");
						return;
					}

					var firstname = $("#eyga-create-organization-invitation-firstname").val();
					var lastname = $("#eyga-create-organization-invitation-lastname").val();
					var emailAddress = $("#eyga-create-organization-invitation-emailaddress").val();
					var organizationContactType = $("#eyga-create-organization-invitation-contacttype").val();

					var payload = JSON.stringify({
						["eyfrcc_firstname"]: firstname,
						["eyfrcc_lastname"]: lastname,
						["eyfrcc_emailaddress"]: emailAddress,
						["eyfrcc_organizationcontacttype"]: organizationContactType,
						["eyfrcc_Organization@odata.bind"]: `/accounts(${organizationId})`,
						["eyfrcc_From@odata.bind"]: `/contacts(${userId})`,
					});

					_createOrganizationInvitation(payload);
				});
		};

		var openCreateProjectModal = function (organizationId, userId, isApplicationView = false, programId = null, callbackFunc) {
			if (!isApplicationView) {
				$("#eyga-create-project-program").val($("#eyga-create-project-program option:first").val());
				$("#eyga-create-project-save-draft")
					.off("click")
					.on("click", function () {
						_saveProject(organizationId, userId, true, isApplicationView, programId, callbackFunc);
					});
			} else {
				$("#eyga-create-project-modal").on("hidden.bs.modal", (e) => {
					$("#eyga-create-project-modal.modal-body").scrollTop(0);
					$(".eyfrcc_fakedropdown").find('option[value="0"]').attr("selected", true);
				});
			}

			$("#eyga-create-project-name").val(null);
			$("#eyga-create-project-for-planning-grant").val($("#eyga-create-project-for-planning-grant option:first").val());
			$("#eyga-create-project-activities").val(null);
			$("#eyga-create-project-street-address-1").val(null);
			$("#eyga-create-project-street-address-2").val(null);
			$("#eyga-create-project-city").val(null);
			$("#eyga-create-project-state-territory").val($("#eyga-create-project-state-territory option:first").val());
			$("#eyga-create-project-zip-code").val(null);

			$(".modal-body-error-container").hide();
			$("#eyga-create-project-modal").modal();

			$("#eyga-create-project-submit")
				.off("click")
				.on("click", function () {
					_saveProject(organizationId, userId, false, isApplicationView, programId, callbackFunc);
				});

			$("#eyga-create-project-state-territory")
				.off("change")
				.on("change", (e) => {
					const $state = $(e.currentTarget);
					const $program = $("#eyga-create-project-program");
					FRCC.AmeriCorps.Modals.Project.checkProjectState(organizationId, programId || $program.val(), $state.val());
				});
		};

		var openUpdateUserTypeModal = function (contactId, contactName, contactType) {
			$("#eyga-update-user-type-contacttype").val(contactType);
			$("#eyga-update-user-type-modal .modal-body .h4").text(contactName);
			$(".modal-body-error-container").hide();
			$("#eyga-update-user-type-modal").modal();

			$("#eyga-update-user-type-submit")
				.off("click")
				.on("click", function () {
					var organizationContactType = $("#eyga-update-user-type-contacttype").val();

					var payload = JSON.stringify({
						["eyfrcc_organizationcontacttype"]: organizationContactType,
					});

					_updateContactUserType(contactId, payload);
				});
		};

		var _requiredFieldsPopulated = function (selector) {
			_clearValidationErrors();
			var success = true;
			var $inputs = $(selector).next("input");

			$inputs.each(function () {
				var $input = $(this);
				if ($input.val() === null || $input.val().trim() === "") {
					success = false;

					$input.parent(".form-group").addClass("has-error");
				}
			});

			return success;
		};

		var _cancelApplication = function (applicationId, redirectToApplications) {
			var options = {
				type: "PATCH",
				url: `/_api/eyfrcc_applications(${applicationId})`,
				data: JSON.stringify({
					["eyfrcc_status"]: 203300010,
					["eyfrcc_applicationopen"]: false,
				}),
			};

			if (redirectToApplications) {
				options.success = function () {
					window.location.href = "/applications";
				};
			}

			_ajaxRequest_Modal(options, "Cancelling Application...");
		};

		var _updateProfile = function (userId, payload) {
			_ajaxRequest_Modal(
				{
					type: "PATCH",
					url: `/_api/contacts(${userId})`,
					data: payload,
				},
				"Updating Profile..."
			);
		};

		var _createOrganization = function (userId, payload) {
			_ajaxRequest_Modal(
				{
					type: "POST",
					url: "/_api/accounts",
					data: payload,
					success: async function (res, status, xhr) {
						var organizationId = xhr.getResponseHeader("entityid");

						_ajaxRequest_Modal({
							type: "PATCH",
							url: `/_api/contacts(${userId})`,
							data: JSON.stringify({
								["parentcustomerid_account@odata.bind"]: `/accounts(${organizationId})`,
								["eyfrcc_organizationcontacttype"]: 643260000,
							}),
						});
					},
				},
				"Creating Organization..."
			);
		};

		var _updateOrganization = function (organizationId, payload, integrityInformationPayload = null) {
			_ajaxRequest_Modal(
				{
					type: "PATCH",
					url: `/_api/accounts(${organizationId})`,
					data: payload,
					success: async function (res, status, xhr) {
						_hideModalsAndReload();
					},
				},
				"Updating Organization..."
			);
		};

		var _createOrganizationInvitation = function (payload) {
			_ajaxRequest_Modal(
				{
					type: "POST",
					url: "/_api/eyfrcc_organizationinvitations",
					data: payload,
					success: function () {
						handleOrgMembersPage(0);
						hideProgressIndicator();
						$("#eyga-create-organization-invitation-modal").modal("hide");
					},
				},
				"Inviting User..."
			);
		};

		var _updateContactUserType = function (contactId, payload) {
			_ajaxRequest_Modal(
				{
					type: "PATCH",
					url: `/_api/contacts(${contactId})`,
					data: payload,
					success: function () {
						handleOrgMembersPage(0);
						hideProgressIndicator();
						$("#eyga-update-user-type-modal").modal("hide");
					},
				},
				"Updating User Type..."
			);
		};

		var _ajaxRequest_Modal = function (options, progressMessage) {
			showProgressIndicator(progressMessage);

			_safeAjax({
				type: options.type,
				url: options.url,
				contentType: "application/json",
				data: options.data,
				success: function (response, status, xhr) {
					if (options.success) {
						options.success(response, status, xhr);
						return;
					}
					_hideModalsAndReload();
				},
				error: function (request, status, error) {
					_handleModalError(request.responseJSON.error.innererror?.message || request.responseJSON.error.message);
					handleAjaxError(request, status, error);
					if (options.error) {
						options.error(request, status, error);
					}
				},
			});
		};

		var _handleModalError = function (message, html = null) {
			hideProgressIndicator();
			$(".modal-body-error-container").show();
			$(".modal-body-error-container .modal-body-description span").remove(); // Remove any previous html contained within modal-body-description

			if (html != null) {
				$(".modal-body-error-container .modal-body-description").text(null);
				$(".modal-body-error-container .modal-body-description").append(html);
				return;
			}

			$(".modal-body-error-container .modal-body-description").text(message);
		};

		var _hideModalsAndReload = function () {
			hideProgressIndicator();
			$(".modal").modal("hide");
			location.reload();
		};

		const PCFControlValues = {};

		/*
            Due to native behavior of PCF multiselect controls, they are initialized with the dirty class

            As a workaround, we will cache the value of the multiselect when the form loads in an object
            and use it as a comparison when the save draft functionality is called
        */
		const cachePcfControlValues = function () {
			const $pcfControls = $("[id*=PcfControl_]");
			$pcfControls.each(function () {
				const $control = $(this);

				const $multiSelectHidden = $control.parent().find("input[type=hidden]");
				if (!$multiSelectHidden.length) {
					return;
				}

				const fieldLogicalName = $multiSelectHidden.attr("id");
				const multiSelectValue = $multiSelectHidden.val();

				let values = null;
				if (multiSelectValue) {
					const multiSelections = JSON.parse(multiSelectValue);
					values = multiSelections.map((ms) => ms.Value.toString()).join();
				}

				PCFControlValues[fieldLogicalName] = values;
			});
		};

		const createSaveDraftButton = function (applicationConfiguration) {
			if (
				!applicationConfiguration ||
				!applicationConfiguration.Application ||
				window.location.pathname.contains("Create") ||
				(applicationConfiguration.Application.ParentTableUsage !== ApplicationTableUsages.AsAnApplicationTable &&
					applicationConfiguration.Application.ParentTableUsage !== ApplicationTableUsages.AsASecondaryReportTable)
			) {
				return;
			}

			if (localStorage.getItem("successfulSaveDraft") == "true") {
				openConfirmationModal("Successful Save Draft", "The save draft has succeeded.", "Ok", "Cancel", false, false, false);
				localStorage.removeItem("successfulSaveDraft");
			}

			const $saveDraftButton = $("<button/>", {
				text: "Save Draft",
				class: "btn btn-default btn-min-width-md",
				type: "button",
				id: "save-draft-btn",
				click: async function () {
					// Should be its own function
					FRCC.Portal.Utilities.showProgressIndicator("Saving...");
					const saveDraftResponse = await saveDraft(applicationConfiguration);
					FRCC.Portal.Utilities.hideProgressIndicator();

					switch (saveDraftResponse) {
						case SaveDraftResponseCodes.Success:
							localStorage.setItem("successfulSaveDraft", true);
							window.location.reload();
							break;
						case SaveDraftResponseCodes.Error:
							// show error modal
							openConfirmationModal(
								"Save Draft Error",
								"Unable to save draft. Please contact the system administrator.",
								"Ok",
								"Cancel",
								true,
								true,
								false
							);
							break;
						case SaveDraftResponseCodes.NoUnsavedChanges:
							// show warning modal
							openConfirmationModal("No Unsaved Changes", "There are no fields with unsaved changes.", "Ok", "Cancel", false, false, false);

							break;
					}
				},
			});

			$($saveDraftButton).insertBefore("#NextButton");
		};

		const saveDraft = async function (applicationConfiguration) {
			const payload = _getJsonUpdateForSaveDraft();
			if (Object.keys(payload).length === 0) {
				return SaveDraftResponseCodes.NoUnsavedChanges;
			}

			try {
				var currentRecordType = applicationConfiguration.Application.TableType;
				var currentRecordId = applicationConfiguration.Application.Id;
				var parentRecordType = $("#hdn-parentrecordtype").val();
				var parentRecordId = $("#hdn-parentrecordid").val();
				if (currentRecordType != parentRecordType && currentRecordId == "00000000-0000-0000-0000-000000000000") {
					const response = await FRCC.Portal.Utilities.asyncAppAjax({
						type: "GET",
						url: `/Services/GetWebFormSessions?applicationId=${parentRecordId}`,
						contentType: "application/json",
					});
					const webFormSession = JSON.parse(response);
					const currentWebFormStepId = webFormSession.CurrentWebFormStepId;

					// use current webform step to find right item in web form steps to get target logicalname
					const targetLookupLogicalName = webFormSession.WebFormSteps.find((ele) => ele.Id == currentWebFormStepId)?.TargetLookupLogicalName;

					//create item of current record type with a lookup targetLookupLogicalName to the parent application id
					const schemaName = schemaMappingConfiguration[currentRecordType].find((ele) => ele.FieldLogicalName == targetLookupLogicalName)?.SchemaName;
					payload[`${schemaName}_${parentRecordType}@odata.bind`] = `/${FRCC.Portal.Utilities.getEntitySetName(parentRecordType)}(${parentRecordId})`;
					const otherAppRecordId = await new Promise(function (resolve, reject) {
						_safeAjax({
							type: "POST",
							url: `/_api/${FRCC.Portal.Utilities.getEntitySetName(currentRecordType)}`,
							contentType: "application/json",
							data: JSON.stringify(payload),
							success: function (res, status, xhr) {
								var otherAppId = xhr.getResponseHeader("entityid");
								resolve(otherAppId);
							},
							error: function (request, status, error) {
								console.log("saveDraft failed");
								handleAjaxError(request, status, error);
								resolve(); // Return nothing if saveDRaft fails, but continue API call
							},
						});
					});
					if (!otherAppRecordId) {
						return SaveDraftResponseCodes.Error;
					}

					webFormSession.StepHistory.find((ele) => ele.ID == currentWebFormStepId).ReferenceEntity.ID = otherAppRecordId;
					var stringifiedStepHistory = JSON.stringify(webFormSession.StepHistory);
					await FRCC.Portal.Utilities.asyncAppAjax({
						type: "POST",
						url: `/_api/eyfrcc_updatewebformsessionrequests`,
						data: JSON.stringify({
							["eyfrcc_webformsessionid"]: webFormSession.Id,
							["eyfrcc_webformsessionstephistory"]: stringifiedStepHistory,
						}),
					});
				} else {
					await FRCC.Portal.Utilities.asyncAppAjax({
						type: "PATCH",
						url: `/_api/${FRCC.Portal.Utilities.getEntitySetName(applicationConfiguration.Application.TableType)}(${applicationConfiguration.Application.Id})`,
						contentType: "application/json",
						data: JSON.stringify(payload),
					});
				}
			} catch (error) {
				return SaveDraftResponseCodes.Error;
			}

			return SaveDraftResponseCodes.Success;
		};

		const _getJsonUpdateForSaveDraft = function () {
			const jsonUpdate = {};

			// Select only the .control elements that have at least one descendant with the .dirty class
			$(".control:has(.dirty)").each(function () {
				const $control = $(this);

				// Yes/No (Boolean Radio)
				const $booleanRadioSpan = $control.find("span.boolean-radio.dirty").first();
				if ($booleanRadioSpan.length) {
					const fieldLogicalName = $booleanRadioSpan.attr("id");
					const $checkedInput = $booleanRadioSpan.find("input:checked");
					if ($checkedInput.length) {
						jsonUpdate[fieldLogicalName] = $checkedInput.val() === "1";
					}
					return;
				}

				// Lookup
				if ($control.find(".modal-lookup").length && $control.find(".input-group").length) {
					const $inputGroup = $control.find(".input-group");
					const entityLogicalName = $inputGroup.find("[name$=_entityname]").val();

					const $hiddenFields = $inputGroup.find("input[type=hidden]:not([name$=_entityname])");
					const fieldLogicalName = $hiddenFields.attr("id");
					const entityId = $hiddenFields.filter(".dirty").val();

					if (!entityLogicalName || !entityId) {
						return;
					}

					var parentTableLogicalName = $("#hdn-recordtype").val();
					const schemaName = schemaMappingConfiguration[parentTableLogicalName].find((ele) => ele.FieldLogicalName == fieldLogicalName)?.SchemaName;
					if (schemaName) {
						jsonUpdate[`${schemaName}@odata.bind`] = `/${FRCC.Portal.Utilities.getEntitySetName(entityLogicalName)}(${entityId})`;
					}
					return;
				}

				// Multi-Select
				if ($control.find("[id*=PcfControl]").length) {
					const $multiSelectHidden = $control.find("input[type=hidden]");
					if (!$multiSelectHidden.length) {
						return;
					}

					const fieldLogicalName = $multiSelectHidden.attr("id");
					const multiSelectValue = $multiSelectHidden.val();

					let values = null;
					if (multiSelectValue) {
						const multiSelections = JSON.parse(multiSelectValue);
						values = multiSelections.map((ms) => ms.Value.toString()).join();
					}

					const cachedValues = PCFControlValues[fieldLogicalName];
					if (cachedValues !== values) {
						jsonUpdate[fieldLogicalName] = values;
					}

					return;
				}

				// Single Line Text Field
				const $textInput = $control.find("input[type=text].dirty, input[type=number].dirty").first();
				if ($textInput.length) {
					let fieldLogicalName = $textInput.attr("id");
					var $datepicker = $control.find("input[type=text].datetime");
					if ($datepicker.length) {
						fieldLogicalName = $datepicker.attr("id");
					}
					let value = $textInput.val();
					//int
					if ($textInput.hasClass("integer")) {
						value = parseInt(value);
					}
					if ($textInput.hasClass("decimal") || $textInput.hasClass("money")) {
						value = parseFloat(value);
					}

					jsonUpdate[fieldLogicalName] = value;
					return;
				}

				// Multi-Line Text Field
				const $textArea = $control.find("textarea.dirty").first();
				if ($textArea.length) {
					const fieldLogicalName = $textArea.attr("id");
					jsonUpdate[fieldLogicalName] = $textArea.val();
					return;
				}

				// Choices
				const $select = $control.find("select.dirty").first();
				if ($select.length) {
					const fieldLogicalName = $select.attr("id");
					const value = $select.val();

					jsonUpdate[fieldLogicalName] = value !== "" ? value : null; // Assign null if value is an empty string
					return;
				}
			});

			return jsonUpdate;
		};

		var setupPlainText = (config) => {
			if (!config?.length) {
				return;
			}

			config.forEach((action) => {
				var webResourceId = `WebResource_Plaintext_${action.ActionId}`;
				var control = $("#" + webResourceId);
				if (control.length > 0) {
					if (control[0].tagName.toLowerCase() == "iframe") {
						var uploadControlBody = $(control).contents().find("body").html();
						$(control)
							.parent()
							.append("<literal id='" + webResourceId + "' class='form-field-plaintext'>" + action.Message + "</literal>");
						$(control).remove();
					} else if (control[0].tagName.toLowerCase() == "literal") {
						$(control).html(action.Message);
					}
				}
			});
		};

		return {
			openAccordian: openAccordian,
			searchForError: searchForError,
			appAjax: appAjax,
			asyncAppAjax: asyncAppAjax,
			apiAjax: _safeAjax,
			showIEWarning: showIEWarning,
			formatDate: formatDate,
			getEYGAConfigurationSetting: getEYGAConfigurationSetting,
			getHeaders: getHeaders,
			handleError: handleError,
			handleAjaxError: handleAjaxError,
			callEygaApi: callEygaApi,
			saveSession: saveSession,
			getSession: getSession,
			handleTablePaging: handleTablePaging,
			downloadPortalPageDocument: downloadPortalPageDocument,
			handleRiskAssessmentOutcomes: handleRiskAssessmentOutcomes,
			ApiCall: ApiCall,
			EygaApiContext: EygaApiContext,
			EygaApiCall: EygaApiCall,
			Dictionary: Dictionary,
			showProgressIndicator: showProgressIndicator,
			hideProgressIndicator: hideProgressIndicator,
			openConfirmationModal: openConfirmationModal,
			openCancellationModal: openCancellationModal,
			openUpdateProfileModal: openUpdateProfileModal,
			openUpdateOrganizationModal: openUpdateOrganizationModal,
			openCreateOrganizationInvitationModal: openCreateOrganizationInvitationModal,
			openCreateProjectModal: openCreateProjectModal,
			openUpdateUserTypeModal: openUpdateUserTypeModal,
			viewMessage: viewMessage,
			showCreateMessageModal: showCreateMessageModal,
			openUpsertAppTableRecordModal: openUpsertAppTableRecordModal,
			getEntitySetName: getEntitySetName,
			cachePcfControlValues: cachePcfControlValues,
			createSaveDraftButton: createSaveDraftButton,
			saveDraft: saveDraft,
			setupPlainText: setupPlainText,
		};
	})();

	global.FRCC.Portal.Notification = (function () {
		var $processingMsgEl = $("#processingMsg"),
			_msg = "Processing...",
			_stack = 0,
			_endTimeout;

		var show = function (msg) {
			$processingMsgEl.text(msg || _msg);
			if (_stack === 0) {
				clearTimeout(_endTimeout);
				$processingMsgEl.show();
			}
			_stack++;
		};

		var hide = function () {
			_stack--;
			if (_stack <= 0) {
				_stack = 0;
				clearTimeout(_endTimeout);
				_endTimeout = setTimeout(function () {
					$processingMsgEl.hide();
				}, 500);
			}
		};

		return {
			show: show,
			hide: hide,
		};
	})();
})(this);
