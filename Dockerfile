# Stage 1: Build frontend
FROM node:20-alpine AS build

WORKDIR /app

# Upgrade npm
RUN npm install -g npm@11.7.0

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code and .env
COPY . .
COPY .env .env

# Build Vite app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 3000

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
