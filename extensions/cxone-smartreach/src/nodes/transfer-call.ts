/**
 * Transfer Call Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const transferCall = createNodeDescriptor({
	type: "transferCall",
	defaultLabel: "Transfer Call",
	summary: "Transfer the current call to a supervisor or another number",
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
			key: "supervisorNumber",
			label: "Supervisor Number",
			type: "cognigyText",
			defaultValue: "",
			description: "Phone number to transfer the call to"
		},
		{
			key: "putCallOnHold",
			label: "Put Call On Hold",
			type: "toggle",
			defaultValue: true,
			description: "Put the call on hold during transfer"
		},
		{
			key: "secureTransfer",
			label: "Secure Transfer",
			type: "toggle",
			defaultValue: false,
			description: "Enable secure transfer mode"
		}
	],
	sections: [
		{
			key: "transferOptions",
			label: "Transfer Options",
			defaultCollapsed: false,
			fields: ["supervisorNumber", "putCallOnHold", "secureTransfer"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "transferOptions" }
	],
	appearance: {
		color: "#cf142b"
	},
	dependencies: {
		children: [
			"onSuccessTransfer",
			"onErrorTransfer"
		]
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, context } = cognigy;
		const { connection, supervisorNumber, putCallOnHold, secureTransfer } = config as any;
		const contextKey = "smartreach";

		try {
			// Get context data
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			// Build transfer request
			api.log("info", `[TRANSFER_CALL] Transferring call to ${supervisorNumber}`);

			const transferBody = {
				supervisorNumber,
				putCallOnHold: putCallOnHold.toString(),
				secureTransfer: secureTransfer.toString()
			};

			api.log("info", `[TRANSFER_CALL] Transfer body: ${JSON.stringify(transferBody)}`);

			const transferEndpoint = `${connection.baseUrl}/callControl/agent/conference/manual`;
			await makeAuthenticatedRequest(api, lvSessionToken, transferEndpoint, "POST", transferBody);

			api.log("info", "[TRANSFER_CALL] Call transferred successfully");

			(context as any).smartreach_call_transferred = {
				success: true,
				supervisorNumber,
				timestamp: new Date().toISOString()
			};

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessTransfer");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			api.log("error", `Failed to transfer call: ${error.message}`);

			// Route to error child
			const onErrorChild = childConfigs.find(child => child.type === "onErrorTransfer");
			if (onErrorChild) {
				api.setNextNode(onErrorChild.id);
			}
		}
	}
});

export const onSuccess = createNodeDescriptor({
	type: "onSuccessTransfer",
	parentType: "transferCall",
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
	type: "onErrorTransfer",
	parentType: "transferCall",
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
