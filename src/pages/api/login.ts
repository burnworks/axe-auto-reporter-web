import type { APIRoute } from "astro";
import { createSession, isAuthenticationEnabled, verifyCredentials } from "../../server/auth";

export const prerender = false;

const buildRedirectResponse = (location: string, status: number = 303): Response =>
	new Response(null, {
		status,
		headers: {
			Location: location,
		},
	});

const safeRedirectTarget = (value: string | null | undefined): string => {
	if (!value) return "/";
	if (value.startsWith("//")) return "/";
	if (value.startsWith("/")) {
		return value;
	}
	return "/";
};

const parseRequestBody = async (request: Request): Promise<{ username: string | null; password: string | null; rememberMe: boolean }> => {
	const contentType = request.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		try {
			const json = (await request.json()) as Record<string, unknown>;
			return {
				username: typeof json.username === "string" ? json.username : null,
				password: typeof json.password === "string" ? json.password : null,
				rememberMe: Boolean(json.rememberMe),
			};
		} catch {
			return { username: null, password: null, rememberMe: false };
		}
	}

	const formData = await request.formData();
	return {
		username: typeof formData.get("username") === "string" ? (formData.get("username") as string) : null,
		password: typeof formData.get("password") === "string" ? (formData.get("password") as string) : null,
		rememberMe: formData.get("remember-me") === "on" || formData.get("remember-me") === "true",
	};
};

export const POST: APIRoute = async (context) => {
	const { request, cookies } = context;

	if (!isAuthenticationEnabled()) {
		return new Response(JSON.stringify({ ok: false, error: "Authentication is disabled." }), {
			status: 403,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	const url = new URL(request.url);
	const redirectParam = url.searchParams.get("redirect");
	const { username, password, rememberMe } = await parseRequestBody(request);
	const redirectTarget = safeRedirectTarget(redirectParam);

	if (!verifyCredentials(username, password)) {
		const failureTarget = redirectParam ? `/login?error=invalid&redirect=${encodeURIComponent(redirectParam)}` : "/login?error=invalid";
		return buildRedirectResponse(failureTarget, 303);
	}

	createSession(cookies, username!, rememberMe, request);

	return buildRedirectResponse(redirectTarget, 303);
};
