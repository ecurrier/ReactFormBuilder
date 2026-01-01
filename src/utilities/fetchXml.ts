import { sanitizeGuid } from "./serialization";
import { resolvePrimaryIdAttribute } from "./metadata";

/**
 * FetchXML Utilities
 * Provides helper functions for constructing FetchXML queries
 */

/**
 * Builds a FetchXML query for retrieving child records related to a parent.
 * Used for TableEntry actions to load related records.
 *
 * @param childEntityName - Logical name of the child entity
 * @param referencingAttribute - Lookup field on child pointing to parent
 * @param parentId - ID of the parent record
 * @param columns - Columns to retrieve from child entity
 * @returns FetchXML query string
 *
 * @example
 * ```typescript
 * const fetchXml = buildFetchXmlForChildRecords(
 *   "eyfrcc_budgetitem",
 *   "eyfrcc_applicationid",
 *   "123e4567-e89b-12d3-a456-426614174000",
 *   ["eyfrcc_name", "eyfrcc_amount", "createdon"]
 * );
 * ```
 */
export const buildFetchXmlForChildRecords = (childEntityName: string, referencingAttribute: string, parentId: string, columns: string[]): string => {
	const attributeElements = columns.map((col) => `<attribute name="${col}" />`).join("");
	const normalizedParentId = sanitizeGuid(parentId);

	return `
		<fetch>
			<entity name="${childEntityName}">
				${attributeElements}
				<filter type="and">
					<condition attribute="${referencingAttribute}" operator="eq" value="${normalizedParentId}" />
				</filter>
			</entity>
		</fetch>`;
};

/**
 * Builds a FetchXML query with filter conditions.
 *
 * @param entityName - Logical name of the entity
 * @param columns - Columns to retrieve
 * @param filters - Filter conditions to apply
 * @param filterType - "and" or "or" logic for combining filters
 * @returns FetchXML query string
 *
 * @example
 * ```typescript
 * const fetchXml = buildFetchXmlWithFilter(
 *   "account",
 *   ["name", "accountnumber"],
 *   [
 *     { attribute: "statecode", operator: "eq", value: "0" },
 *     { attribute: "name", operator: "like", value: "%Contoso%" }
 *   ],
 *   "and"
 * );
 * ```
 */
export const buildFetchXmlWithFilter = (
	entityName: string,
	columns: string[],
	filters: Array<{ attribute: string; operator: string; value: string }>,
	filterType: "and" | "or" = "and"
): string => {
	const attributeElements = columns.map((col) => `<attribute name="${col}" />`).join("");
	const conditionElements = filters.map((f) => `<condition attribute="${f.attribute}" operator="${f.operator}" value="${f.value}" />`).join("");

	return `
		<fetch>
			<entity name="${entityName}">
				${attributeElements}
				<filter type="${filterType}">
					${conditionElements}
				</filter>
			</entity>
		</fetch>`;
};

/**
 * Adds a link-entity (join) to an existing FetchXML query.
 * Useful for retrieving related entity data in a single query.
 *
 * @param baseFetchXml - Existing FetchXML query
 * @param linkEntityName - Name of entity to join
 * @param from - Attribute on linked entity
 * @param to - Attribute on base entity
 * @param alias - Alias for linked entity
 * @param columns - Columns to retrieve from linked entity
 * @param linkType - "inner" or "outer" join
 * @returns Updated FetchXML query string
 *
 * @example
 * ```typescript
 * let fetchXml = buildFetchXmlForEntity("contact", ["fullname", "emailaddress1"]);
 * fetchXml = addLinkEntity(
 *   fetchXml,
 *   "account",
 *   "accountid",
 *   "parentcustomerid",
 *   "parentaccount",
 *   ["name", "accountnumber"],
 *   "outer"
 * );
 * ```
 */
export const addLinkEntity = (
	baseFetchXml: string,
	linkEntityName: string,
	from: string,
	to: string,
	alias: string,
	columns: string[],
	linkType: "inner" | "outer" = "inner"
): string => {
	const attributeElements = columns.map((col) => `<attribute name="${col}" />`).join("");
	const linkElement = `<link-entity name="${linkEntityName}" from="${from}" to="${to}" alias="${alias}" link-type="${linkType}">${attributeElements}</link-entity>`;

	// Insert link-entity before closing </entity> tag
	return baseFetchXml.replace("</entity>", `${linkElement}</entity>`);
};

/**
 * Builds a FetchXML query to retrieve a single record by ID.
 *
 * @param entityName - Logical name of the entity
 * @param recordId - GUID of the record
 * @param columns - Columns to retrieve
 * @returns FetchXML query string
 *
 * @example
 * ```typescript
 * const fetchXml = buildFetchXmlForRecord(
 *   "account",
 *   "123e4567-e89b-12d3-a456-426614174000",
 *   ["name", "accountnumber", "emailaddress1"]
 * );
 * ```
 */
export const buildFetchXmlForRecord = (entityName: string, recordId: string, columns: string[]): string => {
	const attributeElements = columns.map((col) => `<attribute name="${col}" />`).join("");
	const normalizedRecordId = sanitizeGuid(recordId);
	const primaryIdAttribute = resolvePrimaryIdAttribute(entityName);

	return `
		<fetch top="1">
			<entity name="${entityName}">
				${attributeElements}
				<filter type="and">
					<condition attribute="${primaryIdAttribute}" operator="eq" value="${normalizedRecordId}" />
				</filter>
			</entity>
		</fetch>`;
};
