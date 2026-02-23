FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p /dist-out && \
    if [ -d dist/bchoperativo/browser ]; then \
      cp -r dist/bchoperativo/browser/* /dist-out/; \
    else \
      cp -r dist/bchoperativo/* /dist-out/; \
    fi

FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /dist-out /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
