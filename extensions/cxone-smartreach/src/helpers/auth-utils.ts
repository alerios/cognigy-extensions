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
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"LV-Access": accessToken,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				clientName,
				userName,
				password,
				agent: true
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Login API returned ${response.status}: ${errorText}`);
		}

		const data = await response.json();

		if (!data?.sessionId) {
			throw new Error("No sessionId in login response");
		}

		api.log("debug", `Successfully logged in as ${userName}, sessionId: ${data.sessionId.substring(0, 8)}...`);
		return data.sessionId;
	} catch (error) {
		api.log("error", `LiveVox login failed: ${error.message}`);
		throw new Error(`Failed to authenticate with LiveVox: ${error.message}`);
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

		const response = await fetch(endpoint, options);

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
		api.log("error", `LiveVox API request failed: ${error.message}`);
		throw error;
	}
}
