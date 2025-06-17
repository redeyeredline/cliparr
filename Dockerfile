FROM node:20.17.0-slim

WORKDIR /app

# Install specific npm version
RUN npm install -g npm@11.4.2

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8484

CMD ["npm", "start"] 