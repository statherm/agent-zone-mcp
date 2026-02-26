FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files and README
COPY dist ./dist
COPY README.md ./

# Run the server
CMD ["node", "dist/index.js"]
