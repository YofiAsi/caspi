FROM node:22-slim AS fork-builder

ARG IBS_REPO=https://github.com/YofiAsi/israeli-bank-scrapers.git
ARG IBS_REF=dd10f8da31bff61ac858f11d4c0575cdd7629cf2

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /fork

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
    git \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev
COPY --from=fork-builder /fork/lib ./node_modules/israeli-bank-scrapers/lib

COPY src/ src/

EXPOSE 3001

USER node

CMD ["node", "src/index.js"]
