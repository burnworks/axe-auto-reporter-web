/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly USER_AUTHENTICATION?: string;
	readonly ADMIN_USERNAME?: string;
	readonly ADMIN_PASSWORD?: string;
	readonly AUTH_SESSION_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
