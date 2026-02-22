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
			key: "resultCanBeArray",
			label: "Result Can Be Array",
			type: "select",
			defaultValue: "false",
			params: {
				required: true,
				options: [
					{ label: "true", value: "true" },
					{ label: "false", value: "false" }
				]
			}
		},
		{
			key: "orderList",
			label: "Order List",
			type: "cognigyText",
			defaultValue: "-1",
			params: {
				required: true
			},
			description: "Disposition/order code (e.g., -1)"
		},
		{
			key: "accountNumber",
			label: "Account Number",
			type: "cognigyText",
			defaultValue: "{{context.smartreach.screenPop.accountNumber}}"
		},
		{
			key: "customVariables",
			label: "Custom Variables (JSON)",
			type: "cognigyText",
			defaultValue: "{}",
			description: "Additional JSON object with custom variables to include in the request body"
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
			key: "required",
			label: "Required Fields",
			defaultCollapsed: false,
			fields: ["ani", "resultCanBeArray", "orderList"]
		},
		{
			key: "optional",
			label: "Optional Fields",
			defaultCollapsed: false,
			fields: [
				"accountNumber",
				"customVariables"
			]
		}
	],
	form: [
		{ type: "section", key: "connection" },
		{ type: "section", key: "required" },
		{ type: "section", key: "optional" }
	],
	appearance: {
		color: "#0077C8"
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api, context } = cognigy;
		const {
			docDbEndpoint,
			docDbToken,
			ani,
			resultCanBeArray,
			orderList,
			accountNumber,
			customVariables
		} = config as any;

		try {
			let customVars = {};
			try {
				if (customVariables && typeof customVariables === "string") {
					customVars = JSON.parse(customVariables);
				} else if (customVariables && typeof customVariables === "object") {
					customVars = customVariables;
				}
			} catch (parseError) {
				api.log("warn", `[DOCDB] Failed to parse custom variables: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
			}

			const body = {
				...customVars,
				ANI: ani,
				resultCanBeArray: resultCanBeArray,
				orderList: orderList,
				account: accountNumber,
			};

			// Log only operation type and order, not the full request with ANI/account details
			api.log("info", `[DOCDB] Sending conversation details to DocDb (orderList=${orderList})`);

			const controller = new AbortController();
			const DOCDB_REQUEST_TIMEOUT_MS = 10000; // 10 seconds timeout to avoid hanging the flow
			const timeoutId = setTimeout(() => {
				api.log("error", "[DOCDB] DocDb request timed out, aborting fetch");
				controller.abort();
			}, DOCDB_REQUEST_TIMEOUT_MS);

			let response: Response;
			try {
				response = await fetch(docDbEndpoint, {
					method: "POST",
					headers: {
						"GET-TOKEN": docDbToken,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body),
					signal: controller.signal
				});
				clearTimeout(timeoutId);
			} catch (fetchError) {
				clearTimeout(timeoutId);
				api.log("error", `[DOCDB] Fetch request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
				throw fetchError;
			}

			api.log("info", `[DOCDB] Response status: ${response.status}`);

			if (!response.ok) {
				const errorText = await response.text();
				api.log("error", `[DOCDB] Error response: ${errorText}`);
				throw new Error(`DocDb API returned ${response.status}: ${errorText}`);
			}

			api.log("info", "[DOCDB] Conversation details sent to DocDb successfully");

			// Store success result in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				docdb: {
					success: true,
					timestamp: new Date().toISOString()
				}
			};

			// Route to success child
			const onSuccessChild = childConfigs.find(child => child.type === "onSuccessDocDb");
			if (onSuccessChild) {
				api.setNextNode(onSuccessChild.id);
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			api.log("error", `Failed to send to DocDb: ${errorMessage}`);

			// Store error in nested structure, preserving existing context
			(context as any).smartreach = {
				...(context as any).smartreach,
				docdb: {
					success: false,
					error: errorMessage,
					timestamp: new Date().toISOString()
				}
			};

			// Route to error child (DocDb reporting is non-critical, so we route instead of throwing)
			const onErrorChild = childConfigs.find(child => child.type === "onErrorDocDb");
			if (onErrorChild) {
				api.setNextNode(onErrorChild.id);
			}
		}
	}
});

export const onSuccess = createNodeDescriptor({
	type: "onSuccessDocDb",
	parentType: "docDbReporter",
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
	type: "onErrorDocDb",
	parentType: "docDbReporter",
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
