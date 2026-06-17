# Minimal container image for the chatbot worker.
# Explicit Dockerfile so deploys don't fall back to buildpacks (which would
# auto-run the `build:context` script — a dev-only tool that needs the site
# repo present). The committed website-context.txt is all the worker needs.
FROM node:22-slim

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# App source (includes the committed website-context.txt).
COPY . .

ENV NODE_ENV=production
# Cloud Run sets $PORT; server.js falls back to 8080 otherwise.
EXPOSE 8080
CMD ["node", "server.js"]
