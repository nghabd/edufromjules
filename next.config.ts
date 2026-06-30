import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function getAppHostname() {
	if (!process.env.NEXT_PUBLIC_APP_URL) return null;
	try {
		return new URL(process.env.NEXT_PUBLIC_APP_URL).hostname;
	} catch {
		return null;
	}
}

const appHostname = getAppHostname();

const nextConfig: NextConfig = {
	// Enable React strict mode for better error detection
	reactStrictMode: true,

	// Enable production source maps for error tracking (disable in development)
	productionBrowserSourceMaps: false,

	// Optimize images
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com", // Google OAuth
			},
			{
				protocol: "https",
				hostname: "*.r2.cloudflarestorage.com", // Cloudflare R2
			},
			{
				protocol: "https",
				hostname: "*.amazonaws.com", // AWS S3
			},
			...(appHostname
				? [
						{
							protocol: "https" as const,
							hostname: appHostname,
						},
						{
							protocol: "http" as const,
							hostname: appHostname,
						},
					]
				: []),
		],
		// Optimize image loading
		formats: ["image/avif", "image/webp"],
		unoptimized: process.env.STORAGE_PROVIDER === "local",
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
		minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
	},

	// Experimental features for performance
	experimental: {
		// Optimize package imports
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-avatar",
			"@radix-ui/react-dialog",
			"@radix-ui/react-dropdown-menu",
			"@radix-ui/react-progress",
			"@radix-ui/react-tabs",
		],
	},

	// Environment variables exposed to the browser (only NEXT_PUBLIC_*)
	env: {
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || "local",
	},

	// Compression
	compress: true,

	// Webpack configuration for production optimizations
	webpack: (config, { dev, isServer }) => {
		// Production optimizations
		if (!dev && !isServer) {
			config.optimization = {
				...config.optimization,
				splitChunks: {
					chunks: "all",
					cacheGroups: {
						default: false,
						vendors: false,
						// React and core libraries
						react: {
							name: "react",
							test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
							priority: 50,
							reuseExistingChunk: true,
							enforce: true,
						},
						// Separate next internals
						framework: {
							name: "framework",
							test: /[\\/]node_modules[\\/]next[\\/]/,
							priority: 40,
							reuseExistingChunk: true,
							enforce: true,
						},
						// Common libraries
						libs: {
							name: "libs",
							test: /[\\/]node_modules[\\/]/,
							priority: 10,
							reuseExistingChunk: true,
							minChunks: 2,
						},
					},
				},
				runtimeChunk: {
					name: "runtime",
				},
			};
		}

		// Handle file extensions
		config.resolve.extensions = [".ts", ".tsx", ".js", ".jsx"];

		return config;
	},

	// Performance optimizations
	onDemandEntries: {
		maxInactiveAge: 60 * 1000,
		pagesBufferLength: 5,
	},

	// Turbopack configuration
	turbopack: {
		root: projectRoot,
		resolveAlias: {
			"@": "./",
		},
	},

	// Security and performance headers
	async headers() {
		return [
			// Static files - cache aggressively
			{
				source: "/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			// Storage download endpoint - cache control
			{
				source: "/api/storage/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "private, max-age=3600",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
				],
			},
			// API routes - no caching
			{
				source: "/api/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store, must-revalidate",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
				],
			},
			// All routes - security headers
			{
				source: "/(.*)",
				headers: [
					// Security headers
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "X-Frame-Options",
						value: "SAMEORIGIN",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
				],
			},
		];
	},

	// Redirects for cleaner URLs
	// async redirects() {
	// 	return [
	// 		{
	// 			source: "/admin",
	// 			destination: "/admin/overview",
	// 			permanent: false,
	// 		},
	// 	];
	// },
};

export default nextConfig;
