# Production deploy checklist

1. Copy `.env.example` → `.env`; set strong JWT secrets, Stripe live/test keys, `COOKIE_SECURE=true`
2. DNS: storefront on Cloudflare Pages; `api.` and `admin.` to VPS
3. `docker compose -f docker/docker-compose.prod.yml up -d --build`
4. Run migrations: `docker compose exec api npx prisma migrate deploy`
5. Seed owner once: `docker compose exec api npx prisma db seed`
6. Configure Stripe webhook → `https://api.example.com/payments/webhook`
7. Set `S3_*` to R2 credentials; set `SENTRY_DSN`
8. Smoke: admin login → publish product → storefront add to cart → checkout → webhook → fulfill
9. Confirm backup cron installed
10. Lighthouse pass on homepage (perf/SEO/a11y)
