/**
 * CXone SmartReach Extension for Cognigy.AI
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import { createExtension } from "@cognigy/extension-tools";
import { smartreachConnection } from "./connections/smartreachConnection";
import { initSmartReachContext, onSuccess as initOnSuccess, onError as initOnError } from "./nodes/init-context";
import { saveTermCode, onSuccess as saveOnSuccess, onError as saveOnError } from "./nodes/save-termcode";
import { getTermCodes, onSuccess as getTermcodesOnSuccess, onError as getTermcodesOnError } from "./nodes/get-termcodes";
import { docDbReporter, onSuccess as docDbOnSuccess, onError as docDbOnError } from "./nodes/docdb-reporter";
import { smartReachAPICaller, onSuccess as apiCallerOnSuccess, onError as apiCallerOnError } from "./nodes/api-caller";
import { transferCall, onSuccess as transferOnSuccess, onError as transferOnError } from "./nodes/transfer-call";
import { readContact, onSuccess as readContactOnSuccess, onError as readContactOnError } from "./nodes/read-contact";

export default createExtension({
	nodes: [
		initSmartReachContext,
		initOnSuccess,
		initOnError,
		saveTermCode,
		saveOnSuccess,
		saveOnError,
		getTermCodes,
		getTermcodesOnSuccess,
		getTermcodesOnError,
		docDbReporter,
		docDbOnSuccess,
		docDbOnError,
		smartReachAPICaller,
		apiCallerOnSuccess,
		apiCallerOnError,
		transferCall,
		transferOnSuccess,
		transferOnError,
		readContact,
		readContactOnSuccess,
		readContactOnError
	],
	connections: [
		smartreachConnection
	],
	options: {
		label: "CXone SmartReach"
	}
});
