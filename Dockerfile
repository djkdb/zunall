# Zunall AI Career OS — production image
# 사용: docker build -t zunall . && docker run -p 3000:3000 -v zunall-data:/app/data zunall
FROM node:22-slim AS base

# ── 의존성 설치 (better-sqlite3 네이티브 빌드 대비 python/make 포함) ──
FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 빌드 ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 런타임 ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV AI_PROVIDER=mock

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

# SQLite DB + 업로드 파일 저장 위치 (볼륨 마운트 권장)
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000
CMD ["npm", "run", "start"]
