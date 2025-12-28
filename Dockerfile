FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /usr/src/app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install

COPY server.js .

EXPOSE 1234

USER pptruser

CMD ["node", "server.js"]