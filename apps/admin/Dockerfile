FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate
WORKDIR /app
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --filter @online-store/admin... || pnpm install --filter @online-store/admin...
COPY apps/admin ./apps/admin
RUN pnpm --filter @online-store/shared-types build && \
    pnpm --filter @online-store/api-client build && \
    pnpm --filter @online-store/admin build

FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
