# Estágio de build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# A API é chamada pelo mesmo endereço do site (/api, encaminhado pelo nginx).
# VITE_API_URL não é mais usado no build de produção.
RUN npm run build

# Estágio de produção
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-seguranca.conf /etc/nginx/snippets/seguranca.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
