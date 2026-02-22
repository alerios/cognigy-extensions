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
			params: {
				required: false
			},
			description: "Customer phone number (optional)"
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
		const { api, context } = cognigy;
		const {
			connection,
			termCodeId,
			phoneDialed,
			account,
			moveAgentToNotReady,
			paymentAmt,
			agentEnteredAccount
		} = config as any;
		const contextKey = "smartreach";

		try {
			// Get data from context
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext || !smartreachContext.initialized) {
				throw new Error(`SmartReach context not found at key '${contextKey}'. Run Init Context node first.`);
			}

			const callTransactionId = smartreachContext.transactionId;
			const callSessionId = smartreachContext.sessionId;
			const lvSessionToken = smartreachContext.lvSessionToken;

			if (!callTransactionId || !callSessionId) {
				throw new Error("Transaction ID or Session ID missing from context");
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

			// Log operation without exposing PII
			api.log("info", `[SAVE_TERMCODE] Saving term code ${termCodeId} for transaction ${callTransactionId}`);
			api.log("debug", `[SAVE_TERMCODE] Request includes ${Object.keys(body).length} fields`);

			// Make API call
		const endpoint = `${connection.apiBaseUrl}/callControl/agent/call/termCode`;
			await makeAuthenticatedRequest(
				api,
				lvSessionToken,
				endpoint,
				"PUT",
				body
			);


			api.log("info", `[SAVE_TERMCODE] Term code ${termCodeId} saved successfully`);

			// Store success result in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				termcode: {
					success: true,
					termCodeId,
					timestamp: new Date().toISOString()
				}
			};

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessSave");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			api.log("error", `Failed to save term code: ${errorMessage}`);

			// Store error in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				termcode: {
					success: false,
					error: errorMessage,
					timestamp: new Date().toISOString()
				}
			};

			// Route to error child
			const onErrorChild = childConfigs.find(child => child.type === "onErrorSave");
			if (onErrorChild) {
				api.setNextNode(onErrorChild.id);
			}
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
