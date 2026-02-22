/**
 * Read Contact Node
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAuthenticatedRequest } from "../helpers/auth-utils";

export const readContact = createNodeDescriptor({
	type: "readContact",
	defaultLabel: "Read Contact",
	summary: "Retrieve contact details from SmartReach",
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
			key: "account",
			label: "Account Number",
			type: "cognigyText",
			params: {
				required: true
			},
			description: "The account of the contact to read"
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
			defaultValue: "smartreach_contact",
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
		{ type: "field", key: "account" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: "#0077C8"
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const { connection, account, storeLocation, storeKey } = config as any;
		const contextKey = "smartreach";

		try {
			// Get session token from context
			const smartreachContext = (context as any)?.[contextKey];

			if (!smartreachContext?.lvSessionToken) {
				throw new Error(`Session token not found in context at '${contextKey}'. Run Init Context node first.`);
			}

			const lvSessionToken = smartreachContext.lvSessionToken;

			api.log("info", `[READ_CONTACT] Retrieving contact for account: ${account}`);

			// Make API call
			const endpoint = `${connection.apiBaseUrl}/contact/contacts/${encodeURIComponent(account)}`;
			const response = await makeAuthenticatedRequest(
				api,
				lvSessionToken,
				endpoint,
				"GET",
			);

			// Log success without logging the full contact response (contains PII)
			if (response?.readContactDetails) {
				const contactData = response.readContactDetails;
				const phoneCount = contactData.phone?.length || 0;
				api.log("info", `[READ_CONTACT] Contact retrieved successfully (${phoneCount} phone numbers)`);
			} else {
				api.log("info", `[READ_CONTACT] Contact retrieved successfully`);
			}

			// Store result in user-specified location
			if (storeLocation === "context") {
				(context as any)[storeKey] = response;
			} else {
				(input as any)[storeKey] = response;
			}

			// Store success result in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				contact: {
					success: true,
					account,
					timestamp: new Date().toISOString()
				}
			};

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessReadContact");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			api.log("error", `Failed to read contact: ${errorMessage}`);

			// Store error in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				contact: {
					success: false,
					error: errorMessage,
					timestamp: new Date().toISOString()
				}
			};

			// Route to error child
			const onErrorChild = childConfigs.find(child => child.type === "onErrorReadContact");
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
	type: "onSuccessReadContact",
	parentType: "readContact",
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
	type: "onErrorReadContact",
	parentType: "readContact",
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
