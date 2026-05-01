# Collaborative Team Hub
[Video Tutorial](https://drive.google.com/file/d/1-eMZBPUtkTan80XjhKZCJSBhU1zpzicB/view?usp=sharing) \\
[Live](https://fredo-cloud-frontend.vercel.app/)\\
A simple JavaScript-only full-stack implementation of the FredoCloud intern assignment. The repository is split into two deployable apps:

- `frontend` - Next.js App Router, Tailwind CSS, Zustand, Recharts, Socket.io client
- `backend` - Node.js, Express REST API, Prisma/PostgreSQL, JWT httpOnly cookies, Socket.io, Cloudinary upload support

The PDF asks for Railway deployment, but this version is prepared for separate Vercel projects because that was the requested final target.

## Implemented Scope

- Email/password register, login, logout and refresh-token cookies
- Protected dashboard loaded from `/api/auth/me`
- Profile name and avatar upload, with Cloudinary used when credentials are present
- Workspace create/switch, member invite and Admin/Member roles
- Goals, milestones and progress updates
- Announcements with pinning, reactions and comments
- Action items with assignee, priority, due date, parent goal, Kanban/list toggle
- Socket.io events for local real-time updates and online members
- `@mention` detection that creates in-app notifications
- Analytics cards, Recharts goal progress chart and CSV export

## Advanced Features Chosen

1. Optimistic UI - action-item status changes update immediately in the frontend and roll back if the API request fails.
2. Audit log - workspace changes are stored in an immutable audit timeline, filterable in the dashboard and included in CSV export.

## Requirements

- Node.js 18+
- PostgreSQL database
- Cloudinary account for production avatar uploads

## Local Setup

Install all workspace dependencies from the repo root:

```bash
npm install
```

Create backend environment variables:

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env` with a real `DATABASE_URL` and strong JWT secrets.

Create frontend environment variables:

```bash
cp frontend/.env.example frontend/.env.local
```

Run Prisma migrations and seed demo data:

```bash
npm run prisma:migrate -w backend
npm run seed -w backend
```

Start both apps:

```bash
npm run dev
```

Frontend: `http://localhost:3000`

Backend health check: `http://localhost:4000/api/health`

Demo login after seeding:

```text
demo@fredocloud.test
Password123!
```

## Run Apps Separately

Backend only:

```bash
npm run dev -w backend
```

Frontend only:

```bash
npm run dev -w frontend
```

## Environment Variables

Backend:

```text
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=4000
```

Frontend:

```text
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

## Vercel Deployment

Create two Vercel projects from the same GitHub repository.

Frontend project:

- Root Directory: `frontend`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Environment variables:
  - `NEXT_PUBLIC_API_URL=https://your-backend.vercel.app`
  - `NEXT_PUBLIC_SOCKET_URL=https://your-backend.vercel.app`

Backend project:

- Root Directory: `backend`
- Build Command: `npm run build`
- Output Directory: leave empty
- Environment variables:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `CLIENT_URL=https://your-frontend.vercel.app`
  - Cloudinary variables if avatar uploads should persist as hosted images

Before production deployment, run migrations against the production database:

```bash
npm run prisma:deploy -w backend
```

## Important Note About Socket.io on Vercel

The backend includes `src/server.js` for a normal long-running Node server with Socket.io. The Vercel serverless entry is `api/index.js`, which serves the REST API. Persistent Socket.io WebSocket connections are best run on a long-running Node host, so local development supports real-time presence/events fully, while Vercel serverless should be treated as the REST deployment target.

## Known Limitations

- Invitation email delivery is not included; invited users are created with a temporary password of `ChangeMe123!`.
- Rich text is stored as plain text/HTML-like content and rendered safely as text in the dashboard.
- The app keeps the UI intentionally compact and does not include bonus features beyond the two selected advanced features.
