/**
 * Authentication and Session Management Utilities
 * Author: Alejandro Rios <alejandro.rios@nice.com>
 */

import * as crypto from "crypto";

interface ISessionData {
	sessionId: string;
	timestamp: number;
	encryptedToken: string;
}

const SESSION_CACHE_KEY = "smartreach_session_cache";
const SESSION_EXPIRY_MS = 7200000; // 2 hours in milliseconds
const ENCRYPTION_KEY = "cognigy-smartreach-session-key-32b"; // Should be 32 bytes for AES-256
const IV_LENGTH = 16;
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout for API calls

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
 * Encrypt session token for secure storage
 */
function encryptToken(token: string): string {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
	let encrypted = cipher.update(token, "utf8", "hex");
	encrypted += cipher.final("hex");
	return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt stored session token
 */
function decryptToken(encryptedData: string): string {
	const parts = encryptedData.split(":");
	const iv = Buffer.from(parts[0], "hex");
	const encryptedText = parts[1];
	const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
	let decrypted = decipher.update(encryptedText, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}

/**
 * Get cached session from context if still valid
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
			return decryptToken(cachedData.encryptedToken);
		}

		return null;
	} catch (error) {
		api.log("warn", `Error retrieving cached session: ${error.message}`);
		return null;
	}
}

/**
 * Cache session token in context
 */
export function cacheSession(api: any, sessionId: string): void {
	try {
		const encryptedToken = encryptToken(sessionId);
		const sessionData: ISessionData = {
			sessionId: sessionId.substring(0, 8) + "...", // Store partial ID for reference
			timestamp: Date.now(),
			encryptedToken
		};

		api.addToContext(SESSION_CACHE_KEY, sessionData, "simple");
	} catch (error) {
		api.log("warn", `Error caching session: ${error.message}`);
	}
}

/**
 * Login to LiveVox and get session ID
 */
export async function loginAndGetSession(
	api: any,
	baseUrl: string,
	accessToken: string,
	clientName: string,
	userName: string,
	password: string
): Promise<string> {
	const endpoint = `${baseUrl}/session/login`;

	try {
		api.log("info", `[CONNECTIVITY_CHECK] Checking connectivity to AWS...`);

		try {
			const ipResponse = await fetchWithTimeout("https://checkip.amazonaws.com/", {
				method: "GET"
			}, 5000, api);
			const ipText = await ipResponse.text();
			const myIp = ipText.trim();
			api.log("info", `[CONNECTIVITY_CHECK] Successfully reached checkip.amazonaws.com`);
			api.log("info", `[CONNECTIVITY_CHECK] Extension IP: ${myIp}`);
		} catch (ipCheckError) {
			api.log("warn", `[CONNECTIVITY_CHECK] Could not determine IP: ${ipCheckError instanceof Error ? ipCheckError.message : String(ipCheckError)}`);
		}

		api.log("info", `[LOGIN_START] About to log details`);
		api.log("info", `[LOGIN_START] baseUrl type: ${typeof baseUrl}, value: ${baseUrl}`);
		api.log("info", `[LOGIN_START] endpoint: ${endpoint}`);

		const requestBody = {
			clientName,
			userName,
			password,
			agent: "true"
		};

		const requestBodyJson = JSON.stringify(requestBody);
		api.log("info", `[LOGIN_START] Body: ${requestBodyJson}`);

		const headers: Record<string, string> = {
			"LV-Access": accessToken,
			"Content-Type": "application/json",
			"Accept": "application/json"
		};

		api.log("info", `[LOGIN_START] Calling fetch now for: ${endpoint}`);

		const response = await fetchWithTimeout(endpoint, {
			method: "POST",
			headers,
			body: requestBodyJson
		}, FETCH_TIMEOUT_MS, api);

		api.log("info", `[LOGIN_RESPONSE] Got response with status: ${response.status}`);

		if (!response.ok) {
			const errorText = await response.text();
			const errorDetails = errorText || "(empty response body)";

			api.log("info", `[LOGIN] Error response - Status: ${response.status}`);
			api.log("info", `[LOGIN] Error body: ${errorDetails}`);

			// Try to get all response headers
			const headersList: any = {};
			response.headers.forEach((value, key) => {
				headersList[key] = value;
			});
			api.log("info", `[LOGIN] Response headers: ${JSON.stringify(headersList)}`);

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
	baseUrl: string,
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
	const sessionId = await loginAndGetSession(api, baseUrl, accessToken, clientName, userName, password);
	cacheSession(api, sessionId);
	return sessionId;
}

/**
 * Make authenticated API call to LiveVox
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
