import { http, delay, HttpResponse } from "msw";
import {
	getMockDelay,
	maybeErrorResponse,
	getRecords,
	extractIdFromFetchXml,
	extractIdFromUrl,
	odataCollection,
	insertRecord,
	updateRecord,
} from "../devtools/handlerUtils";
import { getStore } from "../devtools/mockStore";

export const handlers = [
	// ─── GET: Subrecipients ───────────────────────────────────────────────
	http.get("/_api/eyfrcc_subrecipients", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const url = new URL(request.url);
		const fetchXml = url.searchParams.get("fetchXml");

		console.log("[MSW] Subrecipients request:", { fetchXml });

		const filterId = fetchXml ? extractIdFromFetchXml(fetchXml, "eyfrcc_subrecipientid") : null;
		const records = filterId ? getRecords("eyfrcc_subrecipients", filterId) : getRecords("eyfrcc_subrecipients");

		return HttpResponse.json(odataCollection(records));
	}),

	// ─── PATCH: Accounts ──────────────────────────────────────────────────
	http.patch("*/_api/accounts*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		return HttpResponse.json({ success: true });
	}),

	// ─── GET: EYGA Configurations ─────────────────────────────────────────
	http.get("*/_api/eyfrcc_eygaconfigurations*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_eygaconfigurations");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: API Tokens ──────────────────────────────────────────────────
	http.get("*/_api/eyfrcc_apitokens*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_apitokens");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Versions ────────────────────────────────────────────────────
	// Returns OData-wrapped version record with form content JSON
	http.get("*/_api/eyfrcc_versions*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_versions");
		return HttpResponse.json({
			"@odata.context":
				"https://eyga-fedcore2.crm.dynamics.com/api/data/v9.2/$metadata#eyfrcc_versions(eyfrcc_formcontent,_eyfrcc_regardingid_value,eyfrcc_RegardingId_eyfrcc_form,eyfrcc_versionid,eyfrcc_RegardingId_eyfrcc_form())",
			value: records,
		});
	}),

	// ─── GET: Form Instances ──────────────────────────────────────────────
	// Complex nested response structure with Version containing formcontent
	http.get("*/_api/eyfrcc_forminstances*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_forminstances");
		return HttpResponse.json({
			"@odata.context":
				"https://eyga-fedcore2.powerappsportals.com/_api/$metadata#eyfrcc_forminstances(eyfrcc_forminstanceid,eyfrcc_primaryrecordid,eyfrcc_primaryrecordlogicalname,eyfrcc_secondaryrecords)",
			"@Microsoft.Dynamics.CRM.totalrecordcount": -1,
			"@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded": false,
			"@Microsoft.Dynamics.CRM.globalmetadataversion": "51503950",
			"@Version.OData.Community.Display.V1.CurrentEntityField": "eyfrcc_versionid",
			value: records,
		});
	}),

	// ─── GET: User Form Sessions ──────────────────────────────────────────
	http.get("*/_api/eyfrcc_userformsessions*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_userformsessions");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Projects ────────────────────────────────────────────────────
	http.get("*/_api/eyfrcc_projects*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) {
			return errorResp;
		}

		await delay(getMockDelay());

		const url = new URL(request.url);
		const fetchXml = url.searchParams.get("fetchXml");

		const projectId = fetchXml ? extractIdFromFetchXml(fetchXml, "eyfrcc_projectid") : null;
		const records = projectId ? getRecords("eyfrcc_projects", projectId) : getRecords("eyfrcc_projects");

		return HttpResponse.json(odataCollection(records));
	}),

	// ─── POST: Projects ────────────────────────────────────────────────────
	http.post("*/_api/eyfrcc_projects*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		const id = insertRecord("eyfrcc_projects", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── GET: Expenditures ────────────────────────────────────────────────
	http.get("*/_api/eyfrcc_expenditures*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_expenditures");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Indirect Cost Rate Lines ────────────────────────────────────
	http.get("*/_api/eyfrcc_indirectcostratelineses*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_indirectcostratelineses");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Child Application Tests ─────────────────────────────────────
	http.get("*/_api/eyfrcc_childapplicationtests*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_childapplicationtests");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Standard Form 424s ──────────────────────────────────────────
	http.get("*/_api/eyfrcc_standardform424s*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_standardform424s");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Standard Form 424As ─────────────────────────────────────────
	http.get("*/_api/eyfrcc_standardform424as*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_standardform424as");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── GET: Standard Form 425s ──────────────────────────────────────────
	http.get("*/_api/eyfrcc_standardform425s*", async () => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const records = getRecords("eyfrcc_standardform425s");
		return HttpResponse.json(odataCollection(records));
	}),

	// ─── POST: Child Application Tests ────────────────────────────────────
	http.post("*/_api/eyfrcc_childapplicationtests*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Child Application Test POST request:", { body });
		const id = insertRecord("eyfrcc_childapplicationtests", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── PATCH: Child Application Tests ───────────────────────────────────
	http.patch("*/_api/eyfrcc_childapplicationtests*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const url = new URL(request.url);
		const recordId = extractIdFromUrl(url.pathname);
		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Child Application Test PATCH request:", { recordId, body });
		if (recordId) updateRecord("eyfrcc_childapplicationtests", recordId, body);

		return HttpResponse.json({}, { status: 204 });
	}),

	// ─── POST: Standard Form 424s ─────────────────────────────────────────
	http.post("*/_api/eyfrcc_standardform424s*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Standard Form 424 POST request:", { body });
		const id = insertRecord("eyfrcc_standardform424s", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── POST: Standard Form 425s ─────────────────────────────────────────
	http.post("*/_api/eyfrcc_standardform425s*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Standard Form 425 POST request:", { body });
		const id = insertRecord("eyfrcc_standardform425s", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── POST: Subrecipients ──────────────────────────────────────────────
	http.post("*/_api/eyfrcc_subrecipients*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Subrecipients POST request:", { body });
		const id = insertRecord("eyfrcc_subrecipients", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── POST: Expenditures ───────────────────────────────────────────────
	http.post("*/_api/eyfrcc_expenditures*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Expenditures POST request:", { body });
		const id = insertRecord("eyfrcc_expenditures", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── POST: Form Instances ─────────────────────────────────────────────
	http.post("*/_api/eyfrcc_forminstances*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Form Instances POST request:", { body });
		const id = insertRecord("eyfrcc_forminstances", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── POST: Document Search By Tags ────────────────────────────────────
	http.post("*https://americorps-fed-core-2.azure-api.net/document/v1/searchbytags*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		console.log("[MSW] Documents Search By Tags POST request:", { request });

		const requestBody = (await request.json()) as { Id: string; Folder: string; Status?: string };
		const template = getStore().data.externalApis?.["document-search"] as Record<string, any> | undefined;

		// Build response from store template, substituting dynamic request-body values
		const doc = {
			name: template?.name ?? "ErrorDetails (34).txt",
			fullName: (template?.fullName ?? "Activity Proposal/{Id}/{Folder}/ErrorDetails (34).txt")
				.replace("{Id}", requestBody.Id)
				.replace("{Folder}", requestBody.Folder),
			uri: (template?.uri ?? "").replace("{Id}", requestBody.Id).replace("{Folder}", requestBody.Folder),
			tags: {
				...(template?.tags ?? {}),
				Folder: requestBody.Folder,
				Id: requestBody.Id,
				Status: requestBody.Status,
			},
			uploadDate: template?.uploadDate ?? "01/02/2026",
		};

		return HttpResponse.json([doc], { status: 200 });
	}),

	// ─── POST: Document Upload ────────────────────────────────────────────
	http.post("*https://americorps-fed-core-2.azure-api.net/document/v1/upload*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		console.log("[MSW] Documents Upload POST request:", { request });

		return HttpResponse.json({}, { status: 200 });
	}),

	// ─── POST: Address Validate ───────────────────────────────────────────
	http.post("*https://americorps-fed-core-2.azure-api.net/address/v1/validate*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		console.log("[MSW] Address Validate POST request:", { request });

		const addressResponse = getStore().data.externalApis?.["address-validate"] ?? {
			ValidationLevel: "Valid",
			Message: "",
			Address: null,
		};

		return HttpResponse.json(addressResponse, { status: 200 });
	}),

	// ─── PATCH: Form Instances ────────────────────────────────────────────
	http.patch("*/_api/eyfrcc_forminstances*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const url = new URL(request.url);
		const recordId = extractIdFromUrl(url.pathname);
		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] Form Instances PATCH request:", { recordId, body });
		if (recordId) updateRecord("eyfrcc_forminstances", recordId, body);

		return HttpResponse.json({}, { status: 204 });
	}),

	// ─── POST: User Form Sessions ─────────────────────────────────────────
	http.post("*/_api/eyfrcc_userformsessions*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] User Form Sessions POST request:", { body });
		const id = insertRecord("eyfrcc_userformsessions", body);

		const response = HttpResponse.json({}, { status: 204 });
		response.headers.set("entityid", id);
		return response;
	}),

	// ─── PATCH: User Form Sessions ────────────────────────────────────────
	http.patch("*/_api/eyfrcc_userformsessions*", async ({ request }) => {
		const errorResp = maybeErrorResponse();
		if (errorResp) return errorResp;

		await delay(getMockDelay());

		const url = new URL(request.url);
		const recordId = extractIdFromUrl(url.pathname);
		const body = (await request.json()) as Record<string, any>;
		console.log("[MSW] User Form Sessions PATCH request:", { recordId, body });
		if (recordId) updateRecord("eyfrcc_userformsessions", recordId, body);

		return HttpResponse.json({}, { status: 204 });
	}),
];
