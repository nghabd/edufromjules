import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAvatarUrl } from "@/lib/avatar";
import { validateEmail } from "@/lib/validation";

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
							// SECURITY: NEVER fetch 'image' here to avoid large base64 strings in auth flow
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

					return {
						id: user.id,
						email: user.email,
						name: user.name ?? user.email,
						role: user.role,
						image: null, // Always null here, handled via avatar proxy
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
	cookies: {
		sessionToken: {
			name: `s`,
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
			},
		},
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
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.role = user.role || "PHARMACIST";
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
			}

			if (trigger === "update" && session?.user) {
				token.name = session.user.name ?? token.name;
			}

			// AGGRESSIVE 494 FIX: Strictly whitelist allowed fields in the token to prevent header bloat.
			// NextAuth sometimes adds 'image' or 'picture' automatically from providers.
			const allowedFields = ["id", "email", "name", "role", "iat", "exp", "jti"];
			Object.keys(token).forEach((key) => {
				if (!allowedFields.includes(key)) {
					delete token[key];
				}
			});

			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.role = token.role as string;
				session.user.id = token.id as string;
				session.user.email = token.email as string;
				session.user.name = token.name as string;
				// Dynamically build the avatar URL to keep the token small
				session.user.image = `/api/users/${token.id}/avatar`;
			}
			return session;
		},
	},
	pages: {
		signIn: "/login",
		error: "/login",
	},
	// SECURITY: Ensure secret is set
	secret: process.env.NEXTAUTH_SECRET,
	// JWT settings
	jwt: {
		maxAge: 7 * 24 * 60 * 60, // 7 days
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
