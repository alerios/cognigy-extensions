/**
 * SmartReach API Caller Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";

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
			defaultValue: {},
			description: "Additional headers to include (LV-Session is added automatically). Provide as JSON object."
		},
		{
			key: "body",
			label: "Request Body (JSON)",
			type: "json",
			defaultValue: {},
			description: "Request body for POST/PUT/PATCH requests. Provide as JSON object."
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
			fields: ["storeLocation", "storeKey"]
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
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const { connection, method, endpoint, headers, body, storeLocation, storeKey } = config as any;
		const contextKey = "smartreach";

		try {
			// Get session token from context
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			// Validate and build full URL
			const rawEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
			if (!rawEndpoint) {
				throw new Error("Endpoint is required and must be a non-empty string.");
			}

			let fullEndpoint: string;

			// Disallow protocol-relative URLs and validate absolute URLs
			const isAbsoluteHttpUrl =
				rawEndpoint.startsWith("http://") || rawEndpoint.startsWith("https://");
			const isProtocolRelativeUrl = rawEndpoint.startsWith("//");

			if (isProtocolRelativeUrl) {
				throw new Error("Protocol-relative endpoints (starting with '//') are not allowed.");
			}

			if (isAbsoluteHttpUrl) {
				const apiBaseUrl = new URL(connection.apiBaseUrl);
				const endpointUrl = new URL(rawEndpoint);

				// Ensure the absolute endpoint does not change the origin
				if (endpointUrl.origin !== apiBaseUrl.origin) {
					throw new Error("Absolute endpoints must use the same origin as the configured base URL.");
				}

				if (endpointUrl.pathname.includes("..")) {
					throw new Error("Endpoint path must not contain '..' segments.");
				}

				fullEndpoint = rawEndpoint;
			} else {
				// Treat as relative path
				let normalizedPath = rawEndpoint;
				if (!normalizedPath.startsWith("/")) {
					normalizedPath = `/${normalizedPath}`;
				}

				if (normalizedPath.includes("..")) {
					throw new Error("Endpoint path must not contain '..' segments.");
				}

				fullEndpoint = `${connection.apiBaseUrl}${normalizedPath}`;
			}
			api.log("info", `Making ${method} request to: ${fullEndpoint}`);

			// Parse additional headers
			let additionalHeaders = {};
			let headersParseError: Error | null = null;
			try {
				if (headers) {
					if (typeof headers === "string") {
						if (headers !== "{}") {
							additionalHeaders = JSON.parse(headers);
						}
					} else if (typeof headers === "object") {
						// Already a parsed JSON object; use as-is
						additionalHeaders = headers;
					} else {
						api.log("warn", `Unexpected headers type (${typeof headers}); expected string or object.`);
					}
				}
			} catch (error: any) {
				api.log("warn", `Failed to parse headers: ${error?.message || String(error)}`);
				headersParseError = error instanceof Error ? error : new Error(error?.message || String(error));
			}

			// Parse body for POST/PUT/PATCH
			let requestBody = null;
			let bodyParseError: Error | null = null;
			if (["POST", "PUT", "PATCH"].includes(method)) {
				try {
					if (body && body !== "{}") {
						if (typeof body === "string") {
							requestBody = JSON.parse(body);
						} else if (typeof body === "object") {
							// Already a parsed JSON object; use as-is
							requestBody = body;
						} else {
							api.log("warn", `Unexpected body type (${typeof body}); expected string or object.`);
						}
					}
				} catch (error: any) {
					api.log("warn", `Failed to parse body: ${error?.message || String(error)}`);
					bodyParseError = error instanceof Error ? error : new Error(error?.message || String(error));
				}
			}

			// If JSON parsing failed for headers or body, store error in context and abort
			if (headersParseError) {
				const headersMessage = `SmartReach API Caller JSON parse error - headers: ${headersParseError.message}`;

				// Store detailed error information in context for downstream nodes / users
				(context as any)[contextKey] = {
					...((context as any)?.[contextKey] || {}),
					lastError: headersMessage
				};

				throw new Error(headersMessage);
			}

			if (bodyParseError) {
				const bodyMessage = `SmartReach API Caller JSON parse error - body: ${bodyParseError.message}`;

				// Store detailed error information in context for downstream nodes / users
				(context as any)[contextKey] = {
					...((context as any)?.[contextKey] || {}),
					lastError: bodyMessage
				};

				throw new Error(bodyMessage);
			}
			const fetchOptions: any = {
				method,
				headers: {
					...(additionalHeaders || {}),
					"LV-Session": lvSessionToken,
					"Content-Type": "application/json",
					"Accept": "application/json"
				}
			};

			if (requestBody) {
				fetchOptions.body = JSON.stringify(requestBody);
				// Note: Request body may contain sensitive data - log only structure, not contents
				api.log("debug", `[API_CALLER] Request body includes ${Object.keys(requestBody).length} fields`);
			}

			api.log("info", `[API_CALLER] Making ${method} request to: ${fullEndpoint}`);

			const response = await fetch(fullEndpoint, fetchOptions);

			api.log("info", `[API_CALLER] Response status: ${response.status}`);

			if (!response.ok) {
				const errorText = await response.text();
				// Note: Error response may contain sensitive data - logging only status code
				api.log("error", `[API_CALLER] Error response (status ${response.status})`);
				throw new Error(`API returned ${response.status}: ${errorText}`);
			}

			// For 204 No Content responses
			let data: any = { success: true };
			if (response.status !== 204) {
				data = await response.json();
				// Log success without exposing response data which may contain PII
				api.log("info", `[API_CALLER] Response received successfully`);
			}

			api.log("info", `[API_CALLER] API call successful, storing in ${storeLocation}.${storeKey}`);

			// Store result
			if (storeLocation === "context") {
				(context as any)[storeKey] = data;
			} else {
				(input as any)[storeKey] = data;
			}

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessAPICaller");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			api.log("error", `API call failed: ${errorMessage}`);

			// Route to error child
			const onErrorChild = childConfigs.find(child => child.type === "onErrorAPICaller");
			if (onErrorChild) {
				api.setNextNode(onErrorChild.id);
			} else {
				// If no error child, re-throw
				throw error;
			}
		}
	}
});

export const onSuccess = createNodeDescriptor({
	type: "onSuccessAPICaller",
	parentType: "smartReachAPICaller",
	defaultLabel: "On Success",
	constraints: {
		editable: false,
		deletable: false,
		creatable: false,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	},
	appearance: {
		color: "#61d188",
		textColor: "white",
		variant: "mini"
	}
});

export const onError = createNodeDescriptor({
	type: "onErrorAPICaller",
	parentType: "smartReachAPICaller",
	defaultLabel: "On Error",
	constraints: {
		editable: false,
		deletable: false,
		creatable: false,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	},
	appearance: {
		color: "#cf142b",
		textColor: "white",
		variant: "mini"
	}
});
