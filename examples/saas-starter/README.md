# SaaS Starter Application

> High-velocity SaaS boilerplate with Next.js, Prisma, PostgreSQL, and Redis.

## Prerequisites
Before running the application, make sure you have:
* Node.js 20.x installed (check via `.nvmrc`).
* Docker Desktop or Docker Engine running locally.

## Installation
Clone the repository and install all dependencies:
```bash
npm install
```

## Environment Variables
Copy `.env.example` to `.env` and fill in your secrets:
```bash
cp .env.example .env
```
Ensure `JWT_SECRET` and `STRIPE_SECRET_KEY` are provided.

## Database & Services
Spin up the local containerized Postgres and Redis services:
```bash
docker compose up -d
```
Then run Prisma migrations to provision the schema:
```bash
npx prisma migrate dev
```
And seed initial demo accounts:
```bash
npm run seed
```

## Development
Start the development server with hot-reloading:
```bash
npm run dev
```
