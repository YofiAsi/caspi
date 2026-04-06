FROM node:22-slim AS ibs-builder

ARG IBS_REPO=https://github.com/YofiAsi/israeli-bank-scrapers.git
ARG IBS_REF=274519458653fdc7c52b013a01f3d617b3ffb170

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build/israeli-bank-scrapers

RUN git init \
    && git remote add origin ${IBS_REPO} \
    && git fetch --depth 1 origin ${IBS_REF} \
    && git checkout FETCH_HEAD

RUN npm ci
RUN npm run build:js && npm run build:types


FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY --from=ibs-builder /build/israeli-bank-scrapers ./vendor/israeli-bank-scrapers

COPY package.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev

COPY src/ src/

EXPOSE 3001

USER node

CMD ["node", "src/index.js"]
