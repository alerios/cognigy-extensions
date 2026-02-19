/**
 * Initialize SmartReach Context Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { getSessionToken } from "../helpers/auth-utils";
import { getScreenPopDetails, IScreenPopData } from "../helpers/screenpop-utils";

export const initSmartReachContext = createNodeDescriptor({
	type: "initSmartReachContext",
	defaultLabel: "Init SmartReach Context",
	summary: "Initialize SmartReach call context from SIP headers and retrieve screen pop data",
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
			key: "contextKey",
			label: "Context Key",
			type: "cognigyText",
			defaultValue: "smartreach",
			params: {
				required: true
			}
		},
		{
			key: "fallbackAgentLoginId",
			label: "Fallback Agent Login ID",
			type: "cognigyText",
			defaultValue: "AIVA1",
			description: "Agent login ID to use if SIP header is not available"
		}
	],
	sections: [
		{
			key: "storage",
			label: "Storage Options",
			defaultCollapsed: true,
			fields: ["storeLocation", "contextKey"]
		},
		{
			key: "advanced",
			label: "Advanced",
			defaultCollapsed: true,
			fields: ["fallbackAgentLoginId"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "storage" },
		{ type: "section", key: "advanced" }
	],
	appearance: {
		color: "#0077C8"
	},
	dependencies: {
		children: [
			"onSuccessInit",
			"onErrorInit"
		]
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input, context } = cognigy;
		const { connection, storeLocation, contextKey, fallbackAgentLoginId } = config as any;

		try {
			// Parse SIP headers from input - headers are in payload.sip.headers
			const sipHeaders = (input?.data as any)?.payload?.sip?.headers || {};

			// Extract call information from SIP headers (lowercase format from LiveVox)
			const agentLoginId = sipHeaders['lv-agent-login-id'] || sipHeaders['x-agent-login-id'] || fallbackAgentLoginId;
			const transactionId = sipHeaders['lv-transaction-id'] || sipHeaders['x-transaction-id'] || "";
			const sessionId = sipHeaders['session-id'] || sipHeaders['Session-ID'] || "";

			// Extract DNIS (Dialed Number Information Service) from SIP headers
			// Try direct DNIS header first, then fallback to 'to' or 'uri' headers
			let dnis = sipHeaders['DNIS'] || sipHeaders['dnis'] || "";

			if (!dnis) {
				// Extract from 'to' header (format: <sip:+18990005353@...>)
				const toHeader = sipHeaders['to'] || sipHeaders['To'] || "";
				const toMatch = toHeader.match(/sip:([^\@]+)/);
				if (toMatch && toMatch[1]) {
					dnis = toMatch[1];
				}
			}

			if (!dnis) {
				// Extract from 'uri' header (format: sip:+18990005353@sip-dev-vg.cognigy.ai)
				const uriHeader = sipHeaders['uri'] || sipHeaders['Uri'] || "";
				const uriMatch = uriHeader.match(/sip:([^\@]+)/);
				if (uriMatch && uriMatch[1]) {
					dnis = uriMatch[1];
				}
			}

			// Extract ANI (Automatic Number Identification) from 'from' header
			let ani = "";
			const fromHeader = sipHeaders['from'] || sipHeaders['From'] || "";
			const fromMatch = fromHeader.match(/sip:([^\@]+)/);
			if (fromMatch && fromMatch[1]) {
				ani = fromMatch[1];
			}

			api.log("info", `Initializing SmartReach context - Agent: ${agentLoginId}, TransactionId: ${transactionId}, SessionId: ${sessionId}, DNIS: ${dnis}, ANI: ${ani}`);

			// Authenticate and get session token
			const lvSessionToken = await getSessionToken(
				api,
				connection.baseUrl,
				connection.accessToken,
				connection.clientName,
				agentLoginId,
				connection.agentPassword
			);

			// Get screen pop data
			let screenPop: IScreenPopData = {};
			try {
				screenPop = await getScreenPopDetails(api, connection.baseUrl, lvSessionToken);
			} catch (error) {
				api.log("warn", `Screen pop failed but continuing: ${error.message}`);
			}

			// Build SmartReach context object
			const smartreachContext = {
				agentLoginId,
				transactionId,
				sessionId,
				dnis,
				ani,
				lvSessionToken,
				screenPop,
				initialized: true,
				timestamp: new Date().toISOString()
			};

			// Store in specified location
			if (storeLocation === "context") {
				(context as any)[contextKey] = smartreachContext;
			} else {
				(input as any)[contextKey] = smartreachContext;
			}

			api.log("info", "SmartReach context initialized successfully");

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessInit");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			api.log("error", `Failed to initialize SmartReach context: ${error.message}`);

			// Store error information
			const errorData = {
				error: error.message,
				initialized: false,
				timestamp: new Date().toISOString()
			};

			if (storeLocation === "context") {
				(context as any)[contextKey] = errorData;
			} else {
				(input as any)[contextKey] = errorData;
			}

			// Route to error child
			const onErrorChild = childConfigs.find(child => child.type === "onErrorInit");
			if (onErrorChild) {
				api.setNextNode(onErrorChild.id);
			}
		}
	}
});

export const onSuccess = createNodeDescriptor({
	type: "onSuccessInit",
	parentType: "initSmartReachContext",
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
	type: "onErrorInit",
	parentType: "initSmartReachContext",
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
