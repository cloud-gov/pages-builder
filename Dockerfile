FROM node:20

WORKDIR /app

COPY package.json yarn.lock ./
