import { describe, expect, it, vi, beforeEach } from "vitest";
import { enforceTrustedOrigin, getClientIp } from "../lib/request-security";

describe("request-security", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
	});

	it("allows same allowed origin for mutating requests", () => {
		vi.stubEnv("ALLOWED_ORIGINS", "https://app.example.com");
		const req = new Request("https://app.example.com/api/register", {
			method: "POST",
			headers: {
				origin: "https://app.example.com",
			},
		});

		expect(enforceTrustedOrigin(req)).toBeNull();
	});

	it("blocks cross-origin mutating requests", async () => {
		vi.stubEnv("ALLOWED_ORIGINS", "https://app.example.com");
		const req = new Request("https://app.example.com/api/register", {
			method: "POST",
			headers: {
				origin: "https://evil.example.com",
			},
		});

		const response = enforceTrustedOrigin(req);
		expect(response?.status).toBe(403);
	});

	it("falls back to the request origin when no origin env is configured", () => {
		const req = new Request("https://app.example.com/api/register", {
			method: "POST",
			headers: {
				origin: "https://app.example.com",
			},
		});

		expect(enforceTrustedOrigin(req)).toBeNull();
	});

	it("extracts first forwarded ip", () => {
		const req = new Request("https://app.example.com/api/register", {
			headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
		});
		expect(getClientIp(req)).toBe("1.2.3.4");
	});
});
