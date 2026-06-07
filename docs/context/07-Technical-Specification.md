Client/Admin Web: Next.js 15
Hosting: Vercel
Database: PostgreSQL
DB Provider: Supabase
ORM: Prisma 또는 Drizzle
File Storage: Supabase Storage (`beanmatch-image-storage`)
Auth: NextAuth/Auth.js
Image Delivery: `/api/photos/{photoId}` server proxy with Cloudflare Images legacy fallback
Jobs: Vercel Cron / Upstash QStash / Supabase scheduled jobs
Analytics/Logs: Sentry + PostHog
