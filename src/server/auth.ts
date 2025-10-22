import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const AUTH_COOKIE_NAME = "aar_session";
const FOUR_HOURS_IN_SECONDS = 4 * 60 * 60;
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

type SessionPayload = {
	sub: string;
	exp: number;
};

const toBoolean = (value: string | boolean | undefined | null): boolean => {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		return value.trim().toLowerCase() === "true";
	}
	return false;
};

const getAdminUsername = (): string => import.meta.env.ADMIN_USERNAME ?? "";
const getAdminPassword = (): string => import.meta.env.ADMIN_PASSWORD ?? "";

const resolveSessionSecret = (): string => {
	const explicit = import.meta.env.AUTH_SESSION_SECRET;
	if (explicit && explicit.length >= 32) {
		return explicit;
	}

	const fallbackSource = `${getAdminUsername()}|${getAdminPassword()}`;
	return createHash("sha256").update(fallbackSource || "axe-auto-reporter").digest("hex");
};

const SESSION_SECRET = resolveSessionSecret();

const encodePayload = (payload: SessionPayload): string =>
	Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");

const signPayload = (encodedPayload: string): string =>
	createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");

const buildToken = (payload: SessionPayload): string => {
	const encoded = encodePayload(payload);
	const signature = signPayload(encoded);
	return `${encoded}.${signature}`;
};

const parseToken = (token: string | undefined | null): SessionPayload | null => {
	if (!token) return null;
	const [encoded, signature] = token.split(".");
	if (!encoded || !signature) return null;

	const expectedSignature = signPayload(encoded);
	const provided = Buffer.from(signature, "base64url");
	const expected = Buffer.from(expectedSignature, "base64url");

	if (provided.length !== expected.length) {
		return null;
	}

	if (!timingSafeEqual(provided, expected)) {
		return null;
	}

	try {
		const raw = Buffer.from(encoded, "base64url").toString("utf-8");
		const payload = JSON.parse(raw) as SessionPayload;
		if (!payload || typeof payload.sub !== "string" || typeof payload.exp !== "number") {
			return null;
		}
		if (payload.exp * 1000 < Date.now()) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
};

export const isAuthenticationEnabled = (): boolean => toBoolean(import.meta.env.USER_AUTHENTICATION);

export const verifyCredentials = (username: string | null, password: string | null): boolean => {
	const adminUsername = getAdminUsername();
	const adminPassword = getAdminPassword();

	if (!adminUsername || !adminPassword) {
		return false;
	}

	if (!username || !password) {
		return false;
	}

	const usernameBuffer = Buffer.from(username);
	const expectedUsernameBuffer = Buffer.from(adminUsername);

	const passwordBuffer = Buffer.from(password);
	const expectedPasswordBuffer = Buffer.from(adminPassword);

	if (usernameBuffer.length !== expectedUsernameBuffer.length || passwordBuffer.length !== expectedPasswordBuffer.length) {
		return false;
	}

	try {
		const usernameMatches = timingSafeEqual(usernameBuffer, expectedUsernameBuffer);
		const passwordMatches = timingSafeEqual(passwordBuffer, expectedPasswordBuffer);
		return usernameMatches && passwordMatches;
	} catch {
		return false;
	}
};

type CookieTarget = {
	set: (name: string, value: string, options: Record<string, unknown>) => void;
	delete: (name: string, options?: Record<string, unknown>) => void;
	get: (name: string) => { value: string } | undefined;
};

const resolveExpiry = (rememberMe: boolean): number => {
	const maxAge = rememberMe ? THIRTY_DAYS_IN_SECONDS : FOUR_HOURS_IN_SECONDS;
	return Math.floor(Date.now() / 1000) + maxAge;
};

const isSecureRequest = (request: Request): boolean => {
	try {
		const url = new URL(request.url);
		return url.protocol === "https:";
	} catch {
		return false;
	}
};

export const createSession = (cookies: CookieTarget, username: string, rememberMe: boolean, request: Request): void => {
	const exp = resolveExpiry(rememberMe);
	const payload: SessionPayload = { sub: username, exp };
	const token = buildToken(payload);

	const secure = isSecureRequest(request) || import.meta.env.PROD;

	cookies.set(AUTH_COOKIE_NAME, token, {
		path: "/",
		httpOnly: true,
		secure,
		sameSite: "lax",
		expires: new Date(exp * 1000),
	});
};

export const readSession = (cookies: CookieTarget): SessionPayload | null => {
	const stored = cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
	return parseToken(stored);
};

export const clearSession = (cookies: CookieTarget, request: Request): void => {
	const secure = isSecureRequest(request) || import.meta.env.PROD;
	cookies.delete(AUTH_COOKIE_NAME, {
		path: "/",
		httpOnly: true,
		secure,
		sameSite: "lax",
	});
};

export { AUTH_COOKIE_NAME };
