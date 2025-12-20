# React + Node.js + Express Web Application

## Project Overview
A full-stack web application with React frontend and Node.js + Express backend, featuring JWT-based authentication and role-based authorization.

## Project Structure

```
├── client/                    # Frontend (React)
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   └── ui/          # Shadcn UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility libraries
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main app component
│   │   ├── index.css        # Global styles
│   │   └── main.tsx         # Entry point
│   └── index.html           # HTML template
│
├── server/                    # Backend (Node.js + Express)
│   ├── config/              # Configuration files
│   │   ├── database.ts      # Database config (SQLite/PostgreSQL)
│   │   ├── jwt.ts           # JWT configuration
│   │   └── index.ts         # Config exports
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   └── index.ts
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.ts    # JWT authentication
│   │   ├── validation.middleware.ts
│   │   └── index.ts
│   ├── models/              # Data models
│   │   ├── user.model.ts
│   │   └── index.ts
│   ├── routes/              # API route definitions
│   │   ├── auth.routes.ts   # /api/auth/*
│   │   ├── user.routes.ts   # /api/users/*
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── jwt.utils.ts     # JWT helpers
│   │   ├── password.utils.ts # Password hashing
│   │   └── index.ts
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # Route registration
│   ├── storage.ts           # Storage interface
│   ├── static.ts            # Static file serving
│   └── vite.ts              # Vite dev server integration
│
├── shared/                    # Shared code (frontend + backend)
│   └── schema.ts            # Database schemas & TypeScript types
│
└── script/                    # Build scripts
    └── build.ts
```

## Technology Stack

### Frontend
- **React** - UI library
- **Wouter** - Lightweight routing
- **TanStack Query** - Data fetching & caching
- **Tailwind CSS** - Utility-first styling
- **Shadcn UI** - Component library
- **Vite** - Build tool

### Backend
- **Node.js + Express** - Server framework
- **Drizzle ORM** - Database toolkit
- **Zod** - Schema validation
- **JWT (jsonwebtoken)** - Token-based authentication
- **bcryptjs** - Password hashing

### Database
- **SQLite** - Development database (via better-sqlite3)
- **PostgreSQL** - Production database (via pg)

## Authentication & Authorization

### JWT-Based Authentication
- Access tokens for API authentication
- Refresh tokens for session extension
- Token stored client-side (localStorage/cookie)

### Role-Based Authorization
Available roles:
- `admin` - Full system access
- `moderator` - Limited administrative access
- `user` - Standard user access

## API Routes

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user
- `POST /refresh` - Refresh access token

### Users (`/api/users`)
- `GET /` - Get all users (admin only)
- `GET /:id` - Get user by ID
- `PATCH /:id` - Update user
- `DELETE /:id` - Delete user
- `PATCH /:id/role` - Update user role (admin only)

### Health Check
- `GET /api/health` - Server health status

## Environment Variables

```env
# Database
DATABASE_TYPE=sqlite|postgresql
SQLITE_DB_PATH=./data/app.db
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=my-app

# Session
SESSION_SECRET=your-session-secret
```

## Development

### Running the Application
```bash
npm run dev
```

### Database Switching
Set `DATABASE_TYPE` environment variable:
- `sqlite` - Use SQLite (default for development)
- `postgresql` - Use PostgreSQL (production)

## Recent Changes
- Initial project scaffolding created
- Organized backend with routes, controllers, middleware, models structure
- Added JWT authentication utilities
- Added role-based authorization middleware
- Configured database abstraction for SQLite/PostgreSQL switching
