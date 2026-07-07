# Pin this tag to your @playwright/test version: https://playwright.dev/docs/docker
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Matches playwright.config.js CI behavior (retries, workers)
ENV CI=true

CMD ["npx", "playwright", "test"]
