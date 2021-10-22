FROM node:16
WORKDIR /app
RUN npm i -g typescript
COPY tsconfig.json ./
COPY package*.json ./
RUN npm i
COPY ./src ./src
RUN tsc -b .
ENTRYPOINT [ "node", "./dist/index.js" ]