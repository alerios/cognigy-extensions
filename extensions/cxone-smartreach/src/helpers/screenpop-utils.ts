/**
 * Screen Pop Data Parsing Utilities
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

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
		const key = row.key.toLowerCase().replace(/\s+/g, "");
		const value = row.value;

		// Map common fields to camelCase properties
		switch (key) {
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
	baseUrl: string,
	sessionId: string
): Promise<IScreenPopData> {
	const endpoint = `${baseUrl}/callControl/agent/screenpop`;

	try {
		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				"LV-Session": sessionId,
				"Content-Type": "application/json",
				"Accept": "application/json"
			}
		});

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
		api.log("info", `Screen pop retrieved: ${Object.keys(parsedData).length} fields`);
		api.log("info", `Screen pop data: ${JSON.stringify(parsedData)}`);
		api.log("info", `Raw screen pop rows: ${JSON.stringify(data.screenPopRow)}`);
		return parsedData;
	} catch (error) {
		api.log("warn", `Failed to get screen pop: ${error.message}`);
		// Return empty data instead of throwing - call can continue without screen pop
		return {};
	}
}
