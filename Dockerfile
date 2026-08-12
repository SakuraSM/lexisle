ARG NODE_VERSION=20.20.1
FROM node:${NODE_VERSION}-alpine AS build

ARG VITE_POCKETBASE_URL=https://pocket.nings.top
WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY web/ ./
ENV VITE_POCKETBASE_URL=${VITE_POCKETBASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/healthz || exit 1
