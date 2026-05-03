# Build + serve the BitShard demo dApp as a tiny static site.
# Build context must be this repository root (the demo-dapp project root).
#
# Build:
#   docker build -f Dockerfile -t bitshard/demo-dapp:latest .
#
# The connector is consumed from npm as @bitshard.io/bitshard-wagmi-connector.

FROM node:22-alpine AS builder
WORKDIR /workspace

ARG VITE_BITSHARD_APP_URL=http://localhost:3000
ENV VITE_BITSHARD_APP_URL=$VITE_BITSHARD_APP_URL

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /workspace/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 5174;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf \
    && sed -i 's/listen\s*80;/listen 5174;/' /etc/nginx/conf.d/default.conf
EXPOSE 5174
CMD ["nginx", "-g", "daemon off;"]
