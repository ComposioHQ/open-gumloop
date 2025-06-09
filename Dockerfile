# 1. Base image
FROM node:24-alpine AS base

# 2. Set working directory
WORKDIR /app

# 3. Install dependencies
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# Install dependencies
RUN npm install

# 4. Copy application code
COPY . .

# 5. Build the application
RUN npm run build

# 6. Expose port and set start command
EXPOSE 3000
CMD ["npm", "start"]
