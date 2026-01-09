# Stage 1: Build the Vite app
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Upgrade npm to latest stable
RUN npm install -g npm@11.7.0

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Pass env vars as build args
ARG VITE_GEMINI_API_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# Create a .env file dynamically for Vite
RUN echo "VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY" >> .env && \
    echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" >> .env && \
    echo "VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY" >> .env && \
    echo "VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID" >> .env

# Build the app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built app from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 3000
EXPOSE 3000

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]


