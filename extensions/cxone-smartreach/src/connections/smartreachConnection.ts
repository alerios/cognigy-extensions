/**
 * SmartReach Connection Schema
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { IConnectionSchema } from "@cognigy/extension-tools";

export const smartreachConnection: IConnectionSchema = {
	type: "smartreach",
	label: "SmartReach (LiveVox) Connection",
	fields: [
		{ fieldName: "accessToken" }, // Sensitive: API access token
		{ fieldName: "clientName" },
		{ fieldName: "agentPassword" }, // Sensitive: Agent password
		{ fieldName: "apiBaseUrl" },
	]
};
