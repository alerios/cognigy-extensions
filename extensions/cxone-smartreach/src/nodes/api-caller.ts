/**
 * SmartReach API Caller Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const smartReachAPICaller = createNodeDescriptor({
	type: "smartReachAPICaller",
	defaultLabel: "SmartReach API Caller",
	summary: "Make generic authenticated calls to LiveVox SmartReach APIs",
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
			key: "method",
			label: "HTTP Method",
			type: "select",
			defaultValue: "GET",
			params: {
				options: [
					{ label: "GET", value: "GET" },
					{ label: "POST", value: "POST" },
					{ label: "PUT", value: "PUT" },
					{ label: "DELETE", value: "DELETE" },
					{ label: "PATCH", value: "PATCH" }
				],
				required: true
			}
		},
		{
			key: "endpoint",
			label: "API Endpoint",
			type: "cognigyText",
			params: {
				required: true
			},
			description: "Full endpoint path (e.g., /callControl/agent/status)"
		},
		{
			key: "headers",
			label: "Additional Headers (JSON)",
			type: "json",
			defaultValue: "{}",
			description: "Additional headers to include (LV-Session is added automatically)"
		},
		{
			key: "body",
			label: "Request Body (JSON)",
			type: "json",
			defaultValue: "{}",
			description: "Request body for POST/PUT/PATCH requests"
		},
		{
			key: "contextKey",
			label: "SmartReach Context Key",
			type: "cognigyText",
			defaultValue: "smartreach",
			description: "Where to find the SmartReach session token"
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
			defaultValue: "smartreach_api_result",
			params: {
				required: true
			}
		}
	],
	sections: [
		{
			key: "request",
			label: "Request Configuration",
			defaultCollapsed: false,
			fields: ["method", "endpoint", "headers", "body"]
		},
		{
			key: "storage",
			label: "Storage Options",
			defaultCollapsed: true,
			fields: ["contextKey", "storeLocation", "storeKey"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "request" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: "#0077C8"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const { connection, method, endpoint, headers, body, contextKey, storeLocation, storeKey } = config as any;

		try {
			// Get session token from context
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			// Build full URL
			const fullEndpoint = endpoint.startsWith("http")
				? endpoint
				: `${connection.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

			api.log("info", `Making ${method} request to: ${fullEndpoint}`);

			// Parse additional headers
			let additionalHeaders = {};
			try {
				if (headers && headers !== "{}") {
					additionalHeaders = JSON.parse(headers);
				}
			} catch (error) {
				api.log("warn", `Failed to parse headers: ${error.message}`);
			}

			// Parse body for POST/PUT/PATCH
			let requestBody = null;
			if (["POST", "PUT", "PATCH"].includes(method)) {
				try {
					if (body && body !== "{}") {
						requestBody = JSON.parse(body);
					}
				} catch (error) {
					api.log("warn", `Failed to parse body: ${error.message}`);
				}
			}

			// Make request
			const fetchOptions: any = {
				method,
				headers: {
					"LV-Session": lvSessionToken,
					"Content-Type": "application/json",
					"Accept": "application/json",
					...additionalHeaders
				}
			};

			if (requestBody) {
				fetchOptions.body = JSON.stringify(requestBody);
				api.log("info", `[API_CALLER] Request body: ${JSON.stringify(requestBody)}`);
			}

			api.log("info", `[API_CALLER] Making ${method} request to: ${fullEndpoint}`);

			const response = await fetch(fullEndpoint, fetchOptions);

			api.log("info", `[API_CALLER] Response status: ${response.status}`);

			if (!response.ok) {
				const errorText = await response.text();
				api.log("error", `[API_CALLER] Error response: ${errorText}`);
				throw new Error(`API returned ${response.status}: ${errorText}`);
			}

			// For 204 No Content responses
			let data: any = { success: true };
			if (response.status !== 204) {
				data = await response.json();
				api.log("info", `[API_CALLER] Response data (first 200 chars): ${JSON.stringify(data).substring(0, 200)}`);
			}

			api.log("info", `[API_CALLER] API call successful, storing in ${storeLocation}.${storeKey}`);

			// Store result
			if (storeLocation === "context") {
				(context as any)[storeKey] = data;
			} else {
				(input as any)[storeKey] = data;
			}

		} catch (error) {
			api.log("error", `API call failed: ${error.message}`);
			throw error;
		}
	}
});
