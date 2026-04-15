FROM node:20-alpine AS base

WORKDIR /app

# Copy package files (if they exist for deps like vitest)
# This app uses ESM imports via CDN, so package.json may be minimal or absent
COPY package*.json ./
RUN if [ -f package.json ]; then npm ci --omit=dev; fi

# Copy all source files
COPY . .

# Expose port 8080 (nginx will serve on this)
EXPOSE 8080

# Production stage: serve static files with nginx
FROM nginx:1.25-alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy app files from base stage
COPY --from=base /app /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run as non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
USER nginx

CMD ["nginx", "-g", "daemon off;"]