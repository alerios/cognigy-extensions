/**
 * DocDB Reporter Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";

export const docDbReporter = createNodeDescriptor({
	type: "docDbReporter",
	defaultLabel: "DocDb Reporter",
	summary: "Send conversation details to LiveVox DocDb API",
	fields: [
		{
			key: "useContextData",
			label: "Use Context Data",
			type: "toggle",
			defaultValue: true,
			description: "Auto-populate fields from SmartReach context"
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
			key: "docDbEndpoint",
			label: "DocDb Endpoint URL",
			type: "cognigyText",
			defaultValue: "https://wrapper-prd.livevox.tools/reports/aiva2/",
			params: {
				required: true
			}
		},
		{
			key: "docDbToken",
			label: "DocDb Token",
			type: "cognigyText",
			params: {
				required: true
			},
			description: "GET-TOKEN value for DocDb API"
		},
		{
			key: "ani",
			label: "ANI (Customer Phone)",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.screenPop.phoneDialed}}",
			params: {
				required: true
			}
		},
		{
			key: "dnis",
			label: "DNIS",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.dnis}}",
			params: {
				required: true
			}
		},
		{
			key: "transactionId",
			label: "Transaction ID",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.transactionId}}",
			description: "Leave empty to use -1 (fulfillmentCounter)"
		},
		{
			key: "callerAuthenticated",
			label: "Caller Authenticated",
			type: "select",
			defaultValue: "False",
			params: {
				options: [
					{ label: "True", value: "True" },
					{ label: "False", value: "False" }
				]
			}
		},
		{
			key: "accountNumber",
			label: "Account Number",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.screenPop.accountNumber}}"
		},
		{
			key: "language",
			label: "Language",
			type: "cognigyText",
			defaultValue: "English"
		},
		{
			key: "intentCat1",
			label: "Intent Category 1",
			type: "cognigyText",
			defaultValue: ""
		},
		{
			key: "intentCat2",
			label: "Intent Category 2",
			type: "cognigyText",
			defaultValue: ""
		},
		{
			key: "escalationReason",
			label: "Escalation Reason",
			type: "cognigyText",
			defaultValue: ""
		},
		{
			key: "terminationId",
			label: "Termination ID",
			type: "cognigyText",
			defaultValue: ""
		},
		{
			key: "conversationId",
			label: "Conversation ID",
			type: "cognigyText",
			defaultValue: "{{context.sessionId}}"
		},
		{
			key: "paymentMade",
			label: "Payment Made",
			type: "select",
			defaultValue: "False",
			params: {
				options: [
					{ label: "True", value: "True" },
					{ label: "False", value: "False" }
				]
			}
		},
		{
			key: "disclosureProvided",
			label: "Disclosure Provided",
			type: "select",
			defaultValue: "True",
			params: {
				options: [
					{ label: "True", value: "True" },
					{ label: "False", value: "False" }
				]
			}
		},
		{
			key: "listOfIntents",
			label: "List of Intents",
			type: "cognigyText",
			defaultValue: ""
		},
		{
			key: "pendingStatus",
			label: "Pending Status",
			type: "cognigyText",
			defaultValue: "P"
		}
	],
	sections: [
		{
			key: "connection",
			label: "DocDb Connection",
			defaultCollapsed: false,
			fields: ["docDbEndpoint", "docDbToken"]
		},
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
			fields: ["ani", "dnis", "transactionId"]
		},
		{
			key: "details",
			label: "Call Details",
			defaultCollapsed: true,
			fields: [
				"callerAuthenticated",
				"accountNumber",
				"language",
				"intentCat1",
				"intentCat2",
				"escalationReason",
				"terminationId",
				"conversationId",
				"paymentMade",
				"disclosureProvided",
				"listOfIntents",
				"pendingStatus"
			]
		}
	],
	form: [
		{ type: "section", key: "connection" },
		{ type: "section", key: "context" },
		{ type: "section", key: "required" },
		{ type: "section", key: "details" }
	],
	appearance: {
		color: "#0077C8"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api, context } = cognigy;
		const {
			docDbEndpoint,
			docDbToken,
			ani,
			dnis,
			transactionId,
			callerAuthenticated,
			accountNumber,
			language,
			intentCat1,
			intentCat2,
			escalationReason,
			terminationId,
			conversationId,
			paymentMade,
			disclosureProvided,
			listOfIntents,
			pendingStatus
		} = config as any;

		try {
			const body = {
				ANI: ani,
				DNIS: dnis,
				transactionID: transactionId || "-1",
				fulfillmentCounter: -1,
				CallerAuthenticated: callerAuthenticated,
				AccountNumber: accountNumber,
				Language: language,
				IntentCat1: intentCat1,
				IntentCat2: intentCat2,
				EscalationReason: escalationReason,
				TerminationId: terminationId,
				ConversationID: conversationId,
				PaymentMade: paymentMade,
				DisclosureProvided: disclosureProvided,
				ListOfIntents: listOfIntents,
				PendingStatus: pendingStatus
			};

			api.log("info", `Sending conversation details to DocDb for ANI: ${ani}`);

			const response = await fetch(docDbEndpoint, {
				method: "POST",
				headers: {
					"GET-TOKEN": docDbToken,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`DocDb API returned ${response.status}: ${errorText}`);
			}

			api.log("info", "Conversation details sent to DocDb successfully");

			(context as any).smartreach_docdb_sent = {
				success: true,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			api.log("error", `Failed to send to DocDb: ${error.message}`);

			(context as any).smartreach_docdb_error = {
				success: false,
				error: error.message,
				timestamp: new Date().toISOString()
			};

			throw error;
		}
	}
});
