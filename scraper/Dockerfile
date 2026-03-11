FROM node:22-slim AS fork-builder

RUN apt-get update && apt-get install -y git ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/YofiAsi/israeli-bank-scrapers.git /fork

WORKDIR /fork

RUN npm ci && npm run build:js && npm run build:types


FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY --from=fork-builder /fork/lib ./fork/lib
COPY --from=fork-builder /fork/package.json ./fork/package.json

COPY package.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev

COPY src/ src/

EXPOSE 3001

USER node

CMD ["node", "src/index.js"]
