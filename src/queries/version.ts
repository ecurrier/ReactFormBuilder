import { FormInstance } from "@types/session";
import { createRecord, retrieveMultipleRecords } from "@api";
import type { EntityReference } from "../types/Entity";

/**
 * Retrieves formInstance for a specific version
 */
export const retrieveFormInstance = async (recordId: string, recordLogicalName: string, versionId: string): Promise<FormInstance | null> => {
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_forminstance">
                <attribute name="eyfrcc_forminstanceid" />
                <attribute name="eyfrcc_primaryrecordid" />
                <attribute name="eyfrcc_primaryrecordlogicalname" />
                <attribute name="eyfrcc_secondaryrecords" />
                <filter type="and">
                    <condition attribute="eyfrcc_primaryrecordid" operator="eq" value="${recordId}" />
                    <condition attribute="eyfrcc_primaryrecordlogicalname" operator="eq" value="${recordLogicalName}" />
                    <condition attribute="eyfrcc_versionid" operator="eq" value="${versionId}" />
                </filter>
                <link-entity name="eyfrcc_version" from="eyfrcc_versionid" to="eyfrcc_versionid" alias="Version">
                    <attribute name="eyfrcc_versionid" />
                    <attribute name="eyfrcc_regardingid" />
                    <attribute name="eyfrcc_formcontent" />
                </link-entity>
            </entity>
        </fetch>`;

	const rawResponse = await retrieveMultipleRecords("eyfrcc_forminstance", fetchXml);
	if (!rawResponse || rawResponse.results.length === 0) {
		return null;
	}

	const rawFormInstance = rawResponse.results[0];
	const formInstance: FormInstance = {
		Id: rawFormInstance.eyfrcc_forminstanceid,
		Version: {
			Id: rawFormInstance["Version.eyfrcc_versionid"],
			FormId: rawFormInstance["Version.eyfrcc_regardingid"],
			FormContent: rawFormInstance["Version.eyfrcc_formcontent"],
		},
		PrimaryRecordId: rawFormInstance.eyfrcc_primaryrecordid,
		PrimaryRecordLogicalName: rawFormInstance.eyfrcc_primaryrecordlogicalname,
		SecondaryRecords: JSON.parse(rawFormInstance.eyfrcc_secondaryrecords || "[]"),
		UserFormSessions: [],
	};

	return formInstance;
};

/**
 * Retrieves the latest active version for a form
 */
export const retrieveLatestFormVersion = async (formId: string): Promise<Version | null> => {
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_version">
                <attribute name="eyfrcc_formcontent" />
                <attribute name="eyfrcc_regardingid" />
                <attribute name="eyfrcc_versionid" />
                <attribute name="createdon" />
                <filter type="and">
                    <condition attribute="eyfrcc_regardingid" operator="eq" value="${formId}" />
                    <condition attribute="statecode" operator="eq" value="0" />
                </filter>
                <order attribute="createdon" descending="true" />
            </entity>
        </fetch>`;

	const rawResponse = await retrieveMultipleRecords("eyfrcc_versions", fetchXml);
	if (!rawResponse || rawResponse.results.length === 0) {
		return null;
	}

	const rawVersion = rawResponse.results[0];
	const version: Version = {
		Id: rawVersion.eyfrcc_versionid,
		FormId: rawVersion["_eyfrcc_regardingid_value"],
		FormContent: rawVersion.eyfrcc_formcontent,
	};

	return version;
};

/**
 * Retrieves formInstance for latest version, or creates one if needed
 */
export const retrieveOrCreateFormInstanceForLatestVersion = async (recordId: string, recordLogicalName: string): Promise<FormInstance | null> => {
	// Step 1: Get latest active version
	/*
		to do this, first retrieve most recent form instance for this record (regardless of version)
		then get the latest form id associated with that form instance
		then we do another query to retrieve the latest active version for that form id

		do not use formId
		if nothing found, return null
	*/

	const latestVersion = await retrieveLatestFormVersion(formId);
	if (!latestVersion) {
		throw new Error("No active version found for this form");
	}

	// Step 2: Check if formInstance exists for latest version
	let formInstance = await retrieveFormInstance(recordId, recordLogicalName, latestVersion.Id);

	// Step 3: If exists, return it
	if (formInstance) {
		return formInstance;
	}

	// Step 4: FormInstance doesn't exist - check if old version exists
	const oldFormInstanceFetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_forminstance">
                <attribute name="eyfrcc_forminstanceid" />
                <attribute name="eyfrcc_secondaryrecords" />
                <filter type="and">
                    <condition attribute="eyfrcc_primaryrecordid" operator="eq" value="${recordId}" />
                    <condition attribute="eyfrcc_primaryrecordlogicalname" operator="eq" value="${recordLogicalName}" />
                </filter>
                <order attribute="createdon" descending="true" />
            </entity>
        </fetch>`;

	const oldFormInstanceResponse = await retrieveMultipleRecords("eyfrcc_forminstance", oldFormInstanceFetchXml);
	const oldSecondaryRecords = oldFormInstanceResponse?.results?.[0]?.eyfrcc_secondaryrecords
		? JSON.parse(oldFormInstanceResponse.results[0].eyfrcc_secondaryrecords)
		: [];

	// Step 5: Create new formInstance for latest version
	const newFormInstanceId = await createFormInstance({
		versionId: latestVersion.Id,
		primaryRecordId: recordId,
		primaryRecordLogicalName: recordLogicalName,
		secondaryRecords: oldSecondaryRecords, // Copy from old version
	});

	if (!newFormInstanceId) {
		throw new Error("Failed to create formInstance");
	}

	// Step 6: Retrieve newly created formInstance
	formInstance = await retrieveFormInstance(recordId, recordLogicalName, latestVersion.Id);
	return formInstance;
};

export const retrieveFormVersion = async (versionId: string): Promise<Version> => {
	const fetchXml = `
        <fetch top="1">
			<entity name="eyfrcc_version">
				<attribute name="eyfrcc_formcontent" />
				<attribute name="eyfrcc_regardingid" />
				<attribute name="eyfrcc_versionid" />
				<filter type="and">
					<condition attribute="eyfrcc_versionid" operator="eq" value="${versionId}" />
					<condition attribute="statecode" operator="eq" value="0" />
				</filter>
			</entity>
		</fetch>`;

	const rawResponse = await retrieveMultipleRecords("eyfrcc_versions", fetchXml);
	if (!rawResponse || rawResponse.results.length === 0) {
		return null;
	}

	const rawVersion = rawResponse.results[0];
	const version: Version = {
		Id: rawVersion.eyfrcc_versionid,
		FormId: rawVersion["_eyfrcc_regardingid_value"],
		FormContent: rawVersion.eyfrcc_formcontent,
	};

	return version;
};

export const retrieveUserFormSessions = async (formInstanceId: string): Promise<UserFormSession[]> => {
	const fetchXml = `
		<fetch>
			<entity name="eyfrcc_userformsession">
				<attribute name="eyfrcc_userformsessionid" />
				<attribute name="eyfrcc_forminstanceid" />
				<attribute name="eyfrcc_contactid" />
				<attribute name="eyfrcc_organizationid" />
				<attribute name="eyfrcc_lastactive" />
				<filter type="and">
					<condition attribute="eyfrcc_forminstanceid" operator="eq" value="${formInstanceId}" />
				</filter>
			</entity>
		</fetch>`;

	const rawResponse = await retrieveMultipleRecords("eyfrcc_userformsession", fetchXml);
	if (!rawResponse || rawResponse.results.length === 0) {
		return [];
	}

	const userFormSessions: UserFormSession[] = rawResponse.results.map((rawSession) => ({
		Id: rawSession.eyfrcc_userformsessionid,
		FormInstanceId: rawSession["_eyfrcc_forminstanceid_value"],
		ContactId: rawSession["_eyfrcc_contactid_value"],
		OrganizationId: rawSession["_eyfrcc_organizationid_value"],
		LastActive: new Date(rawSession.eyfrcc_lastactive),
		Events: [], // TO-DO: Load this later... dont see a point in loading it now
	}));

	return userFormSessions;
};

export const createFormInstance = async ({
	versionId,
	primaryRecordId,
	primaryRecordLogicalName,
	secondaryRecords,
}: {
	versionId: string;
	primaryRecordId: string;
	primaryRecordLogicalName: string;
	secondaryRecords: Array<{ LogicalName: string; Id: string }>;
}): Promise<string | null> => {
	const versionLookup: EntityReference = { id: versionId, logicalName: "eyfrcc_version" };

	return await createRecord("eyfrcc_forminstance", {
		eyfrcc_VersionId: versionLookup,
		eyfrcc_primaryrecordid: primaryRecordId,
		eyfrcc_primaryrecordlogicalname: primaryRecordLogicalName,
		eyfrcc_secondaryrecords: JSON.stringify(secondaryRecords ?? []),
	});
};

export const createUserFormSession = async ({
	formInstanceId,
	contactId,
	lastActive,
}: {
	formInstanceId: string;
	contactId: string;
	lastActive: Date;
}): Promise<string | null> => {
	const formInstanceLookup: EntityReference = { id: formInstanceId, logicalName: "eyfrcc_forminstance" };
	const contactLookup: EntityReference = { id: contactId, logicalName: "contact" };

	return await createRecord("eyfrcc_userformsession", {
		eyfrcc_FormInstanceId: formInstanceLookup,
		eyfrcc_ContactId: contactLookup,
		eyfrcc_lastactive: lastActive,
	});
};
