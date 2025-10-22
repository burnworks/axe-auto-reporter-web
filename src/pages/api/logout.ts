import type { APIRoute } from "astro";
import { clearSession, isAuthenticationEnabled } from "../../server/auth";

export const prerender = false;

const safeRedirectTarget = (value: string | null | undefined): string => {
	if (!value) return "/login";
	if (value.startsWith("//")) return "/login";
	if (value.startsWith("/")) {
		return value;
	}
	return "/login";
};

const handle = async ({ request, cookies }: Parameters<APIRoute>[0]): Promise<Response> => {
	if (!isAuthenticationEnabled()) {
		return new Response(null, { status: 204 });
	}

	clearSession(cookies, request);

	const url = new URL(request.url);
	const redirectTarget = safeRedirectTarget(url.searchParams.get("redirect"));

	return new Response(null, {
		status: 303,
		headers: {
			Location: redirectTarget,
		},
	});
};

export const POST: APIRoute = handle;
export const GET: APIRoute = handle;
