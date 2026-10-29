FROM node:20-alpine

WORKDIR /app

# The Prisma schema has to be in place before `npm ci`: its postinstall
# step runs `prisma generate`.
COPY package*.json prisma.config.js ./
COPY prisma ./prisma

RUN npm ci

COPY .  .

EXPOSE 5000

# Production (Render): apply any new database migrations, then start the
# server (package.json "start"). Local development overrides this with
# `npm run dev` in docker-compose.yml for auto-reload.
CMD ["npm", "start"]
