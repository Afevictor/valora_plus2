# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and upgrade npm
COPY package.json package-lock.json* ./
RUN npm install -g npm@11.7.0
RUN npm install

# Copy source code and env
COPY . .
COPY .env .env

# Build the Vite app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
