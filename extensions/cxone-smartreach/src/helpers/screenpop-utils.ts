/**
 * Screen Pop Data Parsing Utilities
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

const SCREENPOP_TIMEOUT_MS = 10000; // 10 second timeout for screen pop requests

export interface IScreenPopRow {
	key: string;
	value: string;
}


export interface IScreenPopData {
	firstName?: string;
	lastName?: string;
	accountNumber?: string;
	phoneDialed?: string;
	callDirection?: string;
	classification?: string;
	callSkillName?: string;
	[key: string]: string | undefined;
}

/**
 * Parse screen pop response into structured data
 */
export function parseScreenPopData(screenPopRows: IScreenPopRow[]): IScreenPopData {
	const data: IScreenPopData = {};

	for (const row of screenPopRows) {
		// Normalize key: lowercase, remove spaces and underscores
		const normalizedKey = row.key.toLowerCase().replace(/[\s_]+/g, "");
		const value = row.value;

		// Map common fields to camelCase properties
		switch (normalizedKey) {
			case "firstname":
				data.firstName = value;
				break;
			case "lastname":
				data.lastName = value;
				break;
			case "accountnumber":
				data.accountNumber = value;
				break;
			case "phonedialed":
				data.phoneDialed = value;
				break;
			case "calldirection":
				data.callDirection = value;
				break;
			case "classification":
				data.classification = value;
				break;
			case "callskillname":
				data.callSkillName = value;
				break;
			default:
				// Store any additional fields with their original key
				data[row.key] = value;
		}
	}

	return data;
}

/**
 * Get screen pop details from LiveVox
 */
export async function getScreenPopDetails(
	api: any,
	apiBaseUrl: string,
	sessionId: string
): Promise<IScreenPopData> {
	const endpoint = `${apiBaseUrl}/callControl/agent/screenpop`;

	try {
		// Create an AbortController for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), SCREENPOP_TIMEOUT_MS);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				"LV-Session": sessionId,
				"Content-Type": "application/json",
				"Accept": "application/json"
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Screen pop API returned ${response.status}: ${errorText}`);
		}

		const data = await response.json();

		if (!data?.screenPopRow) {
			api.log("warn", "No screenPopRow in response");
			return {};
		}

		const parsedData = parseScreenPopData(data.screenPopRow);
		const parsedFieldKeys = Object.keys(parsedData);
		api.log("info", `Screen pop retrieved: ${parsedFieldKeys.length} fields`);
		api.log("debug", `Screen pop field keys: ${JSON.stringify(parsedFieldKeys)}`);
		api.log("debug", `Raw screen pop row count: ${Array.isArray(data.screenPopRow) ? data.screenPopRow.length : 0}`);
		return parsedData;
	} catch (error) {
		api.log("warn", `Failed to get screen pop: ${error instanceof Error ? error.message : String(error)}`);
		// Return empty data instead of throwing - call can continue without screen pop
		return {};
	}
}
