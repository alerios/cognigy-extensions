/**
 * CXone SmartReach Extension for Cognigy.AI
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createExtension } from "@cognigy/extension-tools";
import { smartreachConnection } from "./connections/smartreachConnection";
import { initSmartReachContext, onSuccess as initOnSuccess, onError as initOnError } from "./nodes/init-context";
import { saveTermCode, onSuccess as saveOnSuccess, onError as saveOnError } from "./nodes/save-termcode";
import { getTermCodes } from "./nodes/get-termcodes";
import { docDbReporter } from "./nodes/docdb-reporter";
import { smartReachAPICaller } from "./nodes/api-caller";
import { endCall } from "./nodes/end-call";

export default createExtension({
	nodes: [
		initSmartReachContext,
		initOnSuccess,
		initOnError,
		saveTermCode,
		saveOnSuccess,
		saveOnError,
		getTermCodes,
		docDbReporter,
		smartReachAPICaller,
		endCall
	],
	connections: [
		smartreachConnection
	],
	options: {
		label: "CXone SmartReach"
	}
});
