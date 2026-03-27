FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8086

CMD ["npm", "start"]
