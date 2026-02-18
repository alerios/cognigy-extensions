/**
 * End Call Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const endCall = createNodeDescriptor({
	type: "endCall",
	defaultLabel: "End Call",
	summary: "End the current call and optionally save term code",
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
			key: "saveTermCodeFirst",
			label: "Save Term Code Before Ending",
			type: "toggle",
			defaultValue: false,
			description: "Save a term code before ending the call"
		},
		{
			key: "termCodeId",
			label: "Term Code ID",
			type: "cognigyText",
			defaultValue: "",
			condition: {
				key: "saveTermCodeFirst",
				value: true
			},
			description: "Term code to save before ending call"
		},
		{
			key: "contextKey",
			label: "SmartReach Context Key",
			type: "cognigyText",
			defaultValue: "smartreach",
			description: "Where to find the SmartReach session data"
		}
	],
	sections: [
		{
			key: "termcode",
			label: "Term Code Options",
			defaultCollapsed: false,
			fields: ["saveTermCodeFirst", "termCodeId"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "termcode" },
		{ type: "field", key: "contextKey" }
	],
	appearance: {
		color: "#cf142b"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api, context } = cognigy;
		const { connection, saveTermCodeFirst, termCodeId, contextKey } = config as any;

		try {
			// Get context data
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			// Save term code first if requested
			if (saveTermCodeFirst && termCodeId) {
				api.log("info", `[END_CALL] Saving term code ${termCodeId} before ending call`);

				const termCodeBody = {
					callTransactionId: smartreachContext.transactionId,
					callSessionId: smartreachContext.sessionId,
					termCodeId,
					moveAgentToNotReady: false
				};

				api.log("info", `[END_CALL] Term code body: ${JSON.stringify(termCodeBody)}`);

				const termCodeEndpoint = `${connection.baseUrl}/callControl/agent/call/termCode`;
				await makeAuthenticatedRequest(api, lvSessionToken, termCodeEndpoint, "PUT", termCodeBody);

				api.log("info", "[END_CALL] Term code saved successfully");
			}

			// End the call
			api.log("info", `[END_CALL] Ending call - TransactionId: ${smartreachContext.transactionId}, SessionId: ${smartreachContext.sessionId}`);

			const endCallEndpoint = `${connection.baseUrl}/callControl/agent/call/end`;
			await makeAuthenticatedRequest(api, lvSessionToken, endCallEndpoint, "POST");

			api.log("info", "[END_CALL] Call ended successfully");

			(context as any).smartreach_call_ended = {
				success: true,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			api.log("error", `Failed to end call: ${error.message}`);
			throw error;
		}
	}
});
