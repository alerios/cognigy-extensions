/**
 * Save Term Code Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const saveTermCode = createNodeDescriptor({
	type: "saveTermCode",
	defaultLabel: "Save Term Code",
	summary: "Save disposition/term code for the current call",
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
			key: "useContextData",
			label: "Use Context Data",
			type: "toggle",
			defaultValue: true,
			description: "Use call data from SmartReach context (set by Init Context node)"
		},
		{
			key: "contextKey",
			label: "Context Key",
			type: "cognigyText",
			defaultValue: "smartreach",
			condition: {
				key: "useContextData",
				value: true
			}
		},
		{
			key: "termCodeId",
			label: "Term Code ID",
			type: "cognigyText",
			params: {
				required: true
			},
			description: "The term code ID for this disposition (get from Get Term Codes node)"
		},
		{
			key: "phoneDialed",
			label: "Phone Dialed",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.screenPop.phoneDialed}}",
			description: "Customer phone number"
		},
		{
			key: "moveAgentToNotReady",
			label: "Move Agent to Not Ready",
			type: "toggle",
			defaultValue: false,
			description: "Set agent to 'Not Ready' state after saving term code"
		},
		{
			key: "account",
			label: "Account Number",
			type: "cognigyText",
			defaultValue: "",
			description: "Customer account number (optional)"
		},
		{
			key: "paymentAmt",
			label: "Payment Amount",
			type: "cognigyText",
			defaultValue: "",
			description: "Payment amount if applicable (optional)"
		},
		{
			key: "agentEnteredAccount",
			label: "Agent Entered Account",
			type: "cognigyText",
			defaultValue: "",
			description: "Account entered by agent during call (optional)"
		}
	],
	sections: [
		{
			key: "context",
			label: "Context Settings",
			defaultCollapsed: false,
			fields: ["useContextData", "contextKey"]
		},
		{
			key: "required",
			label: "Required Fields",
			defaultCollapsed: false,
			fields: ["termCodeId", "phoneDialed"]
		},
		{
			key: "optional",
			label: "Optional Fields",
			defaultCollapsed: true,
			fields: ["moveAgentToNotReady", "account", "paymentAmt", "agentEnteredAccount"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "context" },
		{ type: "section", key: "required" },
		{ type: "section", key: "optional" }
	],
	appearance: {
		color: "#0077C8"
	},
	dependencies: {
		children: [
			"onSuccessSave",
			"onErrorSave"
		]
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input, context } = cognigy;
		const {
			connection,
			termCodeId,
			phoneDialed,
			account,
			moveAgentToNotReady,
			paymentAmt,
			agentEnteredAccount,
			useContextData,
			contextKey
		} = config as any;

		try {
			let callTransactionId = "";
			let callSessionId = "";
			let lvSessionToken = "";

			if (useContextData) {
				// Get data from context
				const smartreachContext = (context as any)?.[contextKey];

				if (!smartreachContext || !smartreachContext.initialized) {
					throw new Error(`SmartReach context not found at key '${contextKey}'. Run Init Context node first.`);
				}

				callTransactionId = smartreachContext.transactionId;
				callSessionId = smartreachContext.sessionId;
				lvSessionToken = smartreachContext.lvSessionToken;

				if (!callTransactionId || !callSessionId) {
					throw new Error("Transaction ID or Session ID missing from context");
				}
			} else {
				// Try to get from SIP headers if not using context
				const sipHeaders = (input?.data as any)?.payload?.sip?.headers || {};
				callTransactionId = sipHeaders['lv-transaction-id'] || sipHeaders['x-transaction-id'] || "";
				callSessionId = sipHeaders['session-id'] || sipHeaders['Session-ID'] || "";

				if (!callTransactionId || !callSessionId) {
					throw new Error("Transaction ID or Session ID not found in SIP headers");
				}

				// Need to authenticate if not using context
				throw new Error("Authentication required - please enable 'Use Context Data' or run Init Context node first");
			}

			// Build request body
			const body: any = {
				callTransactionId,
				callSessionId,
				termCodeId,
				moveAgentToNotReady
			};

			// Add optional fields if provided
			if (phoneDialed) body.phoneDialed = phoneDialed;
			if (account) body.account = account;
			if (paymentAmt) body.paymentAmt = paymentAmt;
			if (agentEnteredAccount) body.agentEnteredAccount = agentEnteredAccount;

			api.log("info", `[SAVE_TERMCODE] Saving term code ${termCodeId} for transaction ${callTransactionId}`);
			api.log("info", `[SAVE_TERMCODE] Request body: ${JSON.stringify(body)}`);

			// Make API call
			const endpoint = `${connection.baseUrl}/callControl/agent/call/termCode`;
			await makeAuthenticatedRequest(api, lvSessionToken, endpoint, "PUT", body);

			api.log("info", `[SAVE_TERMCODE] Term code ${termCodeId} saved successfully`);

			// Store success result
			(context as any).smartreach_termcode_saved = {
				success: true,
				termCodeId,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			api.log("error", `Failed to save term code: ${error.message}`);

			// Store error
			(context as any).smartreach_termcode_error = {
				success: false,
				error: error.message,
				timestamp: new Date().toISOString()
			};

			throw error;
		}
	}
});

export const onSuccess = createNodeDescriptor({
	type: "onSuccessSave",
	parentType: "saveTermCode",
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
	type: "onErrorSave",
	parentType: "saveTermCode",
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
