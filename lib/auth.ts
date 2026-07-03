import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAvatarUrl } from "@/lib/avatar";
import { validateEmail } from "@/lib/validation";

const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

type AuthUser = {
	id: string;
	email: string;
	name: string;
	role: string;
	image?: string | null;
};

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma),
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
			// SECURITY: Disable dangerous email account linking
			allowDangerousEmailAccountLinking: false,
			// Only allow specific domains if needed
			authorization: {
				params: {
					access_type: "offline",
					prompt: "consent",
				},
			},
		}),
		CredentialsProvider({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				// Validate inputs
				if (!credentials?.email || !credentials?.password) {
					throw new Error("Missing email or password");
				}

				try {
					// Validate email format
					const email = validateEmail(credentials.email);

					// Find user with specific role check
					const user = await prisma.user.findUnique({
						where: { email },
						select: {
							id: true,
							email: true,
							password: true,
							name: true,
							role: true,
							image: true,
							emailVerified: true,
						},
					});

					// User not found or no password set
					if (!user || !user.password) {
						throw new Error("Invalid credentials");
					}

					// Verify password
					const isValid = await bcrypt.compare(
						credentials.password,
						user.password,
					);
					if (!isValid) {
						throw new Error("Invalid credentials");
					}

					// Check if email is verified (optional: implement email verification)
					// if (!user.emailVerified) {
					//   throw new Error("Please verify your email");
					// }

					return {
						id: user.id,
						email: user.email,
						name: user.name ?? user.email,
						role: user.role,
						image: user.image,
					} satisfies AuthUser;
				} catch (error) {
					console.error(
						"[AUTH_ERROR]",
						error instanceof Error ? error.message : "Unknown error",
					);
					return null;
				}
			},
		}),
	],
	session: {
		strategy: "jwt",
		maxAge: 7 * 24 * 60 * 60, // 7 days
		updateAge: 24 * 60 * 60, // Update every 24 hours
	},
	callbacks: {
		async signIn({ user, account }) {
			// Only allow Google OAuth from specific domains (optional)
			if (account?.provider === "google") {
				// You can add domain restrictions here if needed
				void user;
				// Optional: whitelist specific domains
				// const allowedDomains = ["pharmacompany.com"];
				// if (!allowedDomains.includes(domain ?? "")) return false;
			}

			return true;
		},
		async jwt({ token, user }) {
			// Keep JWT payload minimal to avoid oversized session cookies.
			if (user) {
				token.sub = user.id;
				token.role = user.role || "PHARMACIST";
			}
			return token;
		},
		async session({ session, token }) {
			const userId = token.sub;
			if (!userId || !session.user) {
				return session;
			}

			const dbUser = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					role: true,
					email: true,
					name: true,
					image: true,
				},
			});

			if (!dbUser) {
				return session;
			}

			session.user.id = dbUser.id;
			session.user.role = dbUser.role;
			session.user.email = dbUser.email;
			session.user.name = dbUser.name ?? dbUser.email;
			session.user.image = getAvatarUrl(dbUser.id, dbUser.image);
			return session;
		},
		async redirect({ url, baseUrl }) {
			if (url.startsWith("/")) {
				return `${baseUrl}${url}`;
			}
			if (url.startsWith(baseUrl)) {
				return url;
			}
			return baseUrl;
		},
	},
	pages: {
		signIn: "/login",
		error: "/login",
	},
	// SECURITY: Ensure secret is set
	secret: process.env.NEXTAUTH_SECRET,
	jwt: {
		maxAge: 7 * 24 * 60 * 60, // 7 days
	},
	cookies: {
		sessionToken: {
			name: `${cookiePrefix}next-auth.session-token`,
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: useSecureCookies,
			},
		},
		callbackUrl: {
			name: `${cookiePrefix}next-auth.callback-url`,
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: useSecureCookies,
			},
		},
		csrfToken: {
			name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: useSecureCookies,
			},
		},
	},
	// Event logging for security auditing
	events: {
		async signIn({ user }) {
			console.log(`[AUTH] User signed in: ${user?.id ?? "unknown"}`);
		},
		async signOut() {
			console.log(`[AUTH] User signed out`);
		},
	},
};
