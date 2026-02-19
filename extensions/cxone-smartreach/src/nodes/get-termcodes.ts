/**
 * Get Term Codes Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const getTermCodes = createNodeDescriptor({
	type: "getTermCodes",
	defaultLabel: "Get Term Codes",
	summary: "Retrieve available term codes for a service",
	fields: [
		{
			key: "connection",
			label: "SmartReach Connection",
			type: "connection",
			params: {
				connectionType: "smartreach",
				required: true
			}
		},
		{
			key: "serviceId",
			label: "Service ID",
			type: "cognigyText",
			params: {
				required: true
			},
			description: "The service ID to get term codes for"
		},
		{
			key: "storeLocation",
			label: "Where to store the result",
			type: "select",
			defaultValue: "context",
			params: {
				options: [
					{
						label: "Input",
						value: "input"
					},
					{
						label: "Context",
						value: "context"
					}
				],
				required: true
			}
		},
		{
			key: "storeKey",
			label: "Store Key",
			type: "cognigyText",
			defaultValue: "smartreach_termcodes",
			params: {
				required: true
			}
		}
	],
	sections: [
		{
			key: "storage",
			label: "Storage Options",
			defaultCollapsed: true,
			fields: ["storeLocation", "storeKey"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "serviceId" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: "#0077C8"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const { connection, serviceId, storeLocation, storeKey } = config as any;
		const contextKey = "smartreach";

		try {
			// Get session token from context
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			api.log("info", `[GET_TERMCODES] Retrieving term codes for service: ${serviceId}`);

			// Make API call
			const endpoint = `${connection.baseUrl}/callControl/agent/termCode?serviceId=${serviceId}`;
			const response = await makeAuthenticatedRequest(api, lvSessionToken, endpoint, "GET");

			const termCodeCount = response?.length || 0;
			api.log("info", `[GET_TERMCODES] Retrieved ${termCodeCount} term codes`);
			if (termCodeCount > 0) {
				api.log("info", `[GET_TERMCODES] Term codes (first 300 chars): ${JSON.stringify(response).substring(0, 300)}`);
			}

			// Store result
			if (storeLocation === "context") {
				(context as any)[storeKey] = response;
			} else {
				(input as any)[storeKey] = response;
			}

		} catch (error) {
			api.log("error", `Failed to get term codes: ${error.message}`);
			throw error;
		}
	}
});
