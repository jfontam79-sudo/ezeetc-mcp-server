FROM node:20-slim

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source code
COPY src/ ./src/

# Cloud Run sets PORT automatically
EXPOSE 8080

CMD ["node", "src/index.js"]
