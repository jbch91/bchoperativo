FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build -- --configuration development

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
