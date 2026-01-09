# Stage 1: Build frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install -g npm@11.7.0
RUN npm install

COPY . .

ARG VITE_GEMINI_API_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
ARG VITE_SUPABASE_PROJECT_ID

RUN echo "VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY" >> .env && \
    echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" >> .env && \
    echo "VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY" >> .env && \
    echo "VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID" >> .env

RUN npm run build

# Stage 2: Serve static with Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]



