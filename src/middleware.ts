import type { MiddlewareHandler } from "astro";
import { isAuthenticationEnabled, readSession } from "./server/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);
const PUBLIC_PREFIXES = ["/_astro/", "/_image/", "/img/", "/fonts/", "/favicon", "/robots.txt", "/manifest", "/.well-known/"];
const PUBLIC_EXTENSIONS = new Set([
	".css",
	".js",
	".mjs",
	".cjs",
	".map",
	".ico",
	".png",
	".jpg",
	".jpeg",
	".svg",
	".webp",
	".woff",
	".woff2",
	".ttf",
	".otf",
]);

const isStaticAsset = (pathname: string): boolean => {
	if (PUBLIC_PATHS.has(pathname)) {
		return true;
	}

	for (const prefix of PUBLIC_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return true;
		}
	}

	const lastDot = pathname.lastIndexOf(".");
	if (lastDot === -1) {
		return false;
	}

	const extension = pathname.slice(lastDot).toLowerCase();
	return PUBLIC_EXTENSIONS.has(extension);
};

const buildRedirectTarget = (url: URL): string => {
	const pathWithQuery = `${url.pathname}${url.search}`;
	return `/login?redirect=${encodeURIComponent(pathWithQuery)}`;
};

export const onRequest: MiddlewareHandler = async (context, next) => {
	if (!isAuthenticationEnabled()) {
		return next();
	}

	const { url, request, cookies } = context;

	if (request.method.toUpperCase() === "OPTIONS") {
		return next();
	}

	if (isStaticAsset(url.pathname)) {
		return next();
	}

	const session = readSession(cookies);

	if (url.pathname === "/login") {
		if (session) {
			return context.redirect("/");
		}
		return next();
	}

	if (session) {
		context.locals.user = { username: session.sub };
		return next();
	}

	if (url.pathname.startsWith("/api/")) {
		return new Response(
			JSON.stringify({ ok: false, error: "Authentication required." }),
			{
				status: 401,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}

	return context.redirect(buildRedirectTarget(url));
};
