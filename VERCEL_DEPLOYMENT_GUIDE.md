# Vercel Deployment Guide

## Overview
This guide will help you deploy your Next.js application to Vercel with proper CORS and CSP configuration.

## Prerequisites
- Vercel account
- PostgreSQL database (e.g., Neon, Supabase, or Railway)
- Domain (optional, Vercel provides a free subdomain)

## Changes Made for Vercel Deployment

### 1. CSP Configuration (Fixed inline script blocking)
- **File**: `proxy.ts`
- **Change**: Updated CSP to use nonce-based approach in production, allowing dynamic scripts while blocking unsafe inline scripts
- **Development**: Allows `unsafe-inline` and `unsafe-eval` for hot reload
- **Production**: Uses nonce-based CSP with `'unsafe-dynamic'` for Next.js

### 2. CORS Configuration (Fixed CORS errors)
- **File**: `lib/env.ts`
- **Change**: Updated `allowedOrigins` to default to the app URL in production if `ALLOWED_ORIGINS` is not set
- **Development**: Defaults to wildcard `*` for local development
- **Production**: Uses the app URL from `NEXT_PUBLIC_APP_URL` or `ALLOWED_ORIGINS`

### 3. Security Headers
- **File**: `proxy.ts`
- **Change**: Added security headers in the middleware:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

### 4. Removed Hardcoded CSP from API Routes
- **File**: `lib/security.ts`
- **Change**: Removed hardcoded CSP from `SECURITY_HEADERS` since it's now handled by proxy.ts middleware

### 5. Vercel Configuration
- **File**: `vercel.json` (new)
- **Purpose**: Configures build settings, environment variables, and headers for Vercel deployment

### 6. Environment Variables Template
- **File**: `.env.example` (new)
- **Purpose**: Provides a template for all required environment variables

## Deployment Steps

### Step 1: Prepare Your Environment Variables

1. Copy `.env.example` to `.env.local` (for local testing) or configure in Vercel dashboard
2. Set the following required variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database"
DATABASE_DIRECT_URL="postgresql://user:password@host:port/database"

# NextAuth
NEXTAUTH_SECRET="generate-a-random-32-char-string"
NEXTAUTH_URL="https://your-app.vercel.app"

# Application
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
ALLOWED_ORIGINS="https://your-app.vercel.app"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 2: Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

#### Option B: Using Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Import the project in Vercel dashboard
3. Configure environment variables in Vercel dashboard
4. Deploy

### Step 3: Configure Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

**Required Variables:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `DATABASE_DIRECT_URL` - Direct connection for Prisma migrations
- `NEXTAUTH_SECRET` - Random 32+ character string
- `NEXTAUTH_URL` - Your Vercel domain (e.g., `https://your-app.vercel.app`)
- `NEXT_PUBLIC_APP_URL` - Same as NEXTAUTH_URL
- `ALLOWED_ORIGINS` - Your Vercel domain (comma-separated if multiple)

**Optional Variables:**
- `STORAGE_PROVIDER` - `local`, `r2`, or `s3` (default: `local`)
- `REDIS_URL` - Redis connection for session storage (recommended for production)
- `GOOGLE_CLIENT_ID` - For Google OAuth
- `GOOGLE_CLIENT_SECRET` - For Google OAuth
- Cloudflare R2 or AWS S3 credentials if using those storage providers

### Step 4: Database Setup

If using a managed PostgreSQL service:

1. Create a database (Neon, Supabase, Railway, etc.)
2. Get the connection string
3. Set `DATABASE_URL` and `DATABASE_DIRECT_URL` in Vercel
4. Run Prisma migrations (Vercel will run this automatically if configured)

### Step 5: Custom Domain (Optional)

1. Go to Vercel project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, and `ALLOWED_ORIGINS`

## Verification

After deployment, verify:

1. **CSP Headers**: Open DevTools → Network → Reload → Check response headers for `Content-Security-Policy`
2. **CORS**: Test API calls from the frontend
3. **Authentication**: Test login/register flows
4. **Protected Routes**: Verify role-based access control works

## Troubleshooting

### CSP Errors
If you see CSP errors in the console:
- Check that the nonce is being generated in `proxy.ts`
- Verify the CSP header includes `'nonce-xxxxx'` for scripts
- In development, ensure `NODE_ENV=development`

### CORS Errors
If you see CORS errors:
- Verify `ALLOWED_ORIGINS` includes your domain
- Check that the origin matches exactly (including protocol)
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly

### Build Errors
If the build fails:
- Ensure all environment variables are set
- Check that `DATABASE_URL` is valid
- Verify Prisma schema is correct

### Database Connection Issues
If the app can't connect to the database:
- Verify `DATABASE_URL` is correct
- Check that your database allows connections from Vercel's IP ranges
- Ensure SSL is enabled in the connection string

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use strong secrets** - Generate random strings for `NEXTAUTH_SECRET`
3. **Enable SSL** - Always use HTTPS in production
4. **Limit origins** - Only add trusted domains to `ALLOWED_ORIGINS`
5. **Monitor logs** - Check Vercel logs for security issues
6. **Keep dependencies updated** - Run `npm audit` regularly

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Database connection verified
- [ ] `NEXTAUTH_SECRET` is a strong random string
- [ ] `ALLOWED_ORIGINS` is set to your production domain(s)
- [ ] SSL/HTTPS is enabled
- [ ] Custom domain configured (if applicable)
- [ ] Authentication flow tested
- [ ] Protected routes tested
- [ ] File upload tested (if using S3/R2)
- [ ] Redis configured (if using session storage)
- [ ] Build succeeds without errors
- [ ] CSP headers verified in DevTools
- [ ] CORS verified for API calls

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables in Vercel dashboard
3. Test locally with `npm run build && npm start`
4. Review CSP and CORS headers in browser DevTools
