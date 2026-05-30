FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["node", "server.js"]
