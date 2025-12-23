import { FormInstance } from "@types/session";

export const retrieveFormInstance = async (recordId: string, recordLogicalName: string): Promise<FormInstance> => {
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_forminstance">
                <attribute name="eyfrcc_forminstanceid" />
                <attribute name="eyfrcc_primaryrecordid" />
                <attribute name="eyfrcc_primaryrecordlogicalname" />
                <attribute name="eyfrcc_relatedrecords" />
                <attribute name="eyfrcc_versionid" />
				<filter type="and">
					<condition attribute="eyfrcc_primaryrecordid" operator="eq" value="${recordId}" />
					<condition attribute="eyfrcc_primaryrecordlogicalname" operator="eq" value="${recordLogicalName}" />
				</filter>
                <link-entity name="eyfrcc_version" from="eyfrcc_versionid" to="eyfrcc_versionid" alias="Version">
                    <attribute name="eyfrcc_regardingid" />
                    <attribute name="eyfrcc_formcontent" />
                </link-entity>
            </entity>
        </fetch>`;

	const response = await fetch(`/_api/eyfrcc_forminstances?fetchXml=${encodeURIComponent(fetchXml)}`, {
		method: "GET",
		headers: {
			Accept: "application/json",
			"OData-Version": "4.0",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to retrieve form instance: ${response.status}`);
	}

	const data = await response.json();
	if (data.value.length === 0) {
		throw new Error("No form instance found.");
	}

	return data.value[0] as FormInstance;
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

	const response = await fetch(`/_api/eyfrcc_versions?fetchXml=${encodeURIComponent(fetchXml)}`, {
		method: "GET",
		headers: {
			Accept: "application/json",
			"OData-Version": "4.0",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to retrieve form instance: ${response.status}`);
	}

	const data = await response.json();
	if (data.value.length === 0) {
		throw new Error("No form instance found.");
	}

	return data.value[0] as Version;
};
