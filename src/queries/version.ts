import { FormInstance } from "@types/session";

export const retrieveFormInstance = async (): Promise<FormInstance> => {
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_forminstance">
                <attribute name="eyfrcc_forminstanceid" />
                <attribute name="eyfrcc_primaryrecordid" />
                <attribute name="eyfrcc_primaryrecordlogicalname" />
                <attribute name="eyfrcc_relatedrecords" />
                <attribute name="eyfrcc_versionid" />
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
