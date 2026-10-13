FROM node:20-alpine
WORKDIR /app
COPY package.json server.js README.md ./
COPY public ./public
ENV NODE_ENV=production
ENV DATA_DIR=/var/data
VOLUME ["/var/data"]
EXPOSE 3000
CMD ["node", "server.js"]
