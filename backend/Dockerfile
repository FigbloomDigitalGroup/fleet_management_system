FROM node:20-alpine

WORKDIR /app

# The Prisma schema has to be in place before `npm ci`: its postinstall
# step runs `prisma generate`.
COPY package*.json prisma.config.js ./
COPY prisma ./prisma

RUN npm ci

COPY .  .

EXPOSE 5000

CMD ["npm", "run", "dev"]
