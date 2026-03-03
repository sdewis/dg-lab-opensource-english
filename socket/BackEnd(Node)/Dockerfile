FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY websocketNode.js ./

EXPOSE 9999

CMD ["node", "websocketNode.js"]