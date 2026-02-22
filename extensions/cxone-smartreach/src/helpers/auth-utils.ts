/**
 * Authentication and Session Management Utilities
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

interface ISessionData {
	sessionId: string;
	timestamp: number;
}

const SESSION_CACHE_KEY = "smartreach_session_cache";
const SESSION_EXPIRY_MS = 7200000; // 2 hours in milliseconds
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout for API calls

// Sensitive field patterns to redact from logs
const SENSITIVE_FIELDS = [
	'password',
	'token',
	'accessToken',
	'sessionId',
	'LV-Access',
	'LV-Session',
	'account',
	'accountNumber',
	'paymentAmt',
	'agentPassword'
];

/**
 * Redact sensitive fields from an object for logging
 */
function redactSensitiveData(obj: any, maxLength: number = 500): string {
	if (!obj) return String(obj);

	// If input is a string, attempt to parse JSON; otherwise, just length-limit it
	let source: any = obj;
	if (typeof obj === 'string') {
		const trimmed = obj.trim();

		// Looks like JSON, try to parse so we can actually redact fields
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			try {
				source = JSON.parse(trimmed);
			} catch {
				// Not valid JSON, return a length-limited raw string without claiming redaction
				return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
			}
		} else {
			// Plain string: return a length-limited version without pretending to redact
			return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
		}
	}

	try {
		const redacted = JSON.parse(JSON.stringify(source));

		const redactRecursive = (item: any): any => {
			if (typeof item === 'object' && item !== null) {
				for (const key in item) {
					const lowerKey = key.toLowerCase();
					const isSensitive = SENSITIVE_FIELDS.some(field =>
						lowerKey.includes(field.toLowerCase())
					);

					if (isSensitive) {
						item[key] = "***REDACTED***";
					} else if (typeof item[key] === 'object') {
						redactRecursive(item[key]);
					}
				}
			}
			return item;
		};

		redactRecursive(redacted);
		const result = JSON.stringify(redacted);
		return result.length > maxLength ? result.substring(0, maxLength) + '...' : result;
	} catch {
		return '[Unable to parse for redaction]';
	}
}

/**
 * Helper to add timeout to fetch requests
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS, api?: any): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);
		if (api) {
			api.log("error", `Fetch error: ${error instanceof Error ? error.message : String(error)}`);
		}
		throw error;
	}
}

/**
 * Get cached session from context if still valid
 * Note: This function validates session age locally but does not verify the session is still
 * valid on the LiveVox server side. Cached tokens could be expired or revoked server-side.
 * Consider handling 401/403 responses in consuming code by clearing cache and re-authenticating.
 */
export function getCachedSession(api: any): string | null {
	try {
		const cachedData = api.context.getFullContext()?.[SESSION_CACHE_KEY] as ISessionData;
		if (!cachedData) {
			return null;
		}

		const now = Date.now();
		const age = now - cachedData.timestamp;

		// Check if session is still valid (within 2-hour window)
		if (age < SESSION_EXPIRY_MS) {
			return cachedData.sessionId;
		}

		return null;
	} catch (error) {
		api.log("warn", `Error retrieving cached session: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

/**
 * Cache session token in context
 */
export function cacheSession(api: any, sessionId: string): void {
	try {
		const sessionData: ISessionData = {
			sessionId,
			timestamp: Date.now(),
		};

		api.addToContext(SESSION_CACHE_KEY, sessionData, "simple");
	} catch (error) {
		api.log("warn", `Error caching session: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Login to LiveVox and get session ID
 */
export async function loginAndGetSession(
	api: any,
	apiBaseUrl: string,
	accessToken: string,
	clientName: string,
	userName: string,
	password: string
): Promise<string> {
	const endpoint = `${apiBaseUrl}/session/login`;

	try {
		api.log("info", `[LOGIN_START] About to log details`);
		api.log("info", `[LOGIN_START] apiBaseUrl type: ${typeof apiBaseUrl}, value: ${apiBaseUrl}`);
		api.log("info", `[LOGIN_START] endpoint: ${endpoint}`);

		const requestBody = {
			clientName,
			userName,
			password,
			agent: "true"
		};

		// Redact sensitive fields (e.g., password) before logging the request body
		const redactedRequestBodyForLog = {
			...requestBody,
			password: "***REDACTED***"
		};
		api.log("info", `[LOGIN_START] Body: ${JSON.stringify(redactedRequestBodyForLog)}`);

		const headers: Record<string, string> = {
			"LV-Access": accessToken,
			"Content-Type": "application/json",
			"Accept": "application/json"
		};

		api.log("info", `[LOGIN_START] Calling fetch now for: ${endpoint}`);

		const response = await fetchWithTimeout(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody)
		}, FETCH_TIMEOUT_MS, api);

		api.log("info", `[LOGIN_RESPONSE] Got response with status: ${response.status}`);

		if (!response.ok) {
			const errorText = await response.text();
			const errorDetails = errorText || "(empty response body)";

			api.log("info", `[LOGIN] Error response - Status: ${response.status}`);
			// Redact potentially sensitive error details
			api.log("info", `[LOGIN] Error body (redacted): ${redactSensitiveData(errorDetails, 200)}`);

			// Try to get all response headers
			const headersList: any = {};
			response.headers.forEach((value, key) => {
				headersList[key] = value;
			});
			// Redact sensitive headers
			api.log("info", `[LOGIN] Response headers (redacted): ${redactSensitiveData(headersList)}`);

			throw new Error(`Login API returned ${response.status}: ${errorDetails}`);
		}

		const data = await response.json();

		if (!data?.sessionId) {
			throw new Error("No sessionId in login response");
		}

		api.log("debug", `Successfully logged in as ${userName}, sessionId: ${data.sessionId.substring(0, 8)}...`);
		return data.sessionId;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const fullError = error instanceof Error ? error.stack : "";

		// Run connectivity check only if there's an error
		// Note: This diagnostic check may fail for network reasons unrelated to the login failure
		// and is logged at debug level to avoid confusion with the actual error
		api.log("debug", `[CONNECTIVITY_CHECK] Login failed, checking connectivity to AWS...`);
		try {
			const ipResponse = await fetchWithTimeout("https://checkip.amazonaws.com/", {
				method: "GET"
			}, 5000, api);
			const ipText = await ipResponse.text();
			const myIp = ipText.trim();
			api.log("debug", `[CONNECTIVITY_CHECK] Successfully reached checkip.amazonaws.com`);
			api.log("debug", `[CONNECTIVITY_CHECK] Extension IP: ${myIp}`);
		} catch (ipCheckError) {
			api.log("debug", `[CONNECTIVITY_CHECK] Could not determine IP: ${ipCheckError instanceof Error ? ipCheckError.message : String(ipCheckError)}`);
		}

		// Log more diagnostic info for network errors
		if (errorMessage.includes("fetch failed")) {
			api.log("error", `Network error during login to ${endpoint}: Check DNS resolution, firewall, SSL/TLS certificate, and network connectivity`);
		}

		// Log diagnostic info for 599 errors (server-side error)
		if (errorMessage.includes("599")) {
			api.log("error", `LiveVox returned 599 Server Error. This typically indicates:`);
			api.log("error", `  - Invalid authentication credentials (clientName, agentLoginId, or password)`);
			api.log("error", `  - Invalid or expired LV-Access token`);
			api.log("error", `  - Malformed request body or missing required fields`);
			api.log("error", `  - LiveVox API service issue`);
		}

		api.log("error", `LiveVox login failed: ${errorMessage}${fullError ? ` | Stack: ${fullError}` : ""}`);
		throw new Error(`Failed to authenticate with LiveVox: ${errorMessage}`);
	}
}

/**
 * Get or create session token with caching
 */
export async function getSessionToken(
	api: any,
	apiBaseUrl: string,
	accessToken: string,
	clientName: string,
	userName: string,
	password: string
): Promise<string> {
	// Try to get cached session first
	const cachedSession = getCachedSession(api);
	if (cachedSession) {
		api.log("debug", "Using cached session token");
		return cachedSession;
	}

	// No valid cached session, login and cache new one
	api.log("debug", "No valid cached session, logging in...");
	const sessionId = await loginAndGetSession(api, apiBaseUrl, accessToken, clientName, userName, password);
	cacheSession(api, sessionId);
	return sessionId;
}

/**
 * Make authenticated API call to LiveVox
 * Note: This function does not implement automatic token refresh on 401/403 errors.
 * If a cached token expires mid-conversation, subsequent API calls will fail.
 * Consider implementing retry logic with session refresh for production use.
 */
export async function makeAuthenticatedRequest(
	api: any,
	sessionId: string,
	endpoint: string,
	method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
	body?: any
): Promise<any> {
	try {
		const options: any = {
			method,
			headers: {
				"LV-Session": sessionId,
				"Content-Type": "application/json",
				"Accept": "application/json"
			}
		};

		if (body) {
			options.body = JSON.stringify(body);
		}

		const response = await fetchWithTimeout(endpoint, options, FETCH_TIMEOUT_MS, api);

		if (!response.ok) {
			const errorText = await response.text();
			// Note: 401/403 errors could indicate expired session - consider implementing
			// automatic retry with session refresh for improved reliability
			throw new Error(`LiveVox API returned ${response.status}: ${errorText}`);
		}

		// For 204 No Content responses
		if (response.status === 204) {
			return { success: true };
		}

		const data = await response.json();
		return data;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		api.log("error", `LiveVox API request failed: ${errorMessage}`);
		throw error;
	}
}
