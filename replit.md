# Restaurant Inventory Management System

## Project Overview
A full-stack web application for managing inventory, recipes, and cleaning tasks across two restaurants. Built with React frontend and Node.js + Express backend, featuring JWT-based authentication and role-based authorization.

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
│   ├── models/              # Data model interfaces
│   │   ├── user.model.ts
│   │   ├── restaurant.model.ts
│   │   ├── inventory.model.ts
│   │   ├── recipe.model.ts
│   │   ├── cleaning.model.ts
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
│   ├── storage.ts           # Storage interface (in-memory)
│   ├── static.ts            # Static file serving
│   └── vite.ts              # Vite dev server integration
│
├── shared/                    # Shared code (frontend + backend)
│   └── schema.ts            # Database schemas & TypeScript types
│
└── script/                    # Build scripts
    └── build.ts
```

## Database Schema

### Tables & Relationships

#### Restaurant
| Column     | Type      | Constraints              |
|------------|-----------|--------------------------|
| id         | varchar   | PRIMARY KEY, UUID        |
| name       | text      | NOT NULL                 |
| created_at | timestamp | DEFAULT NOW()            |

#### User
| Column        | Type      | Constraints                           |
|---------------|-----------|---------------------------------------|
| id            | varchar   | PRIMARY KEY, UUID                     |
| name          | text      | NOT NULL                              |
| email         | text      | NOT NULL, UNIQUE                      |
| password_hash | text      | NOT NULL                              |
| role          | text      | NOT NULL, DEFAULT 'staff'             |
| restaurant_id | varchar   | FOREIGN KEY → restaurants.id          |
| created_at    | timestamp | DEFAULT NOW()                         |

**Roles:** `admin` | `manager` | `staff`

#### InventoryItem
| Column              | Type         | Constraints                           |
|---------------------|--------------|---------------------------------------|
| id                  | varchar      | PRIMARY KEY, UUID                     |
| restaurant_id       | varchar      | NOT NULL, FOREIGN KEY → restaurants.id|
| name                | text         | NOT NULL                              |
| category            | text         | NOT NULL                              |
| unit                | text         | NOT NULL                              |
| quantity            | decimal(10,2)| NOT NULL, DEFAULT 0                   |
| low_stock_threshold | decimal(10,2)| NOT NULL, DEFAULT 0                   |
| created_at          | timestamp    | DEFAULT NOW()                         |
| updated_at          | timestamp    | DEFAULT NOW()                         |

#### InventoryLog
| Column           | Type         | Constraints                                |
|------------------|--------------|-------------------------------------------|
| id               | varchar      | PRIMARY KEY, UUID                          |
| inventory_item_id| varchar      | NOT NULL, FOREIGN KEY → inventory_items.id |
| restaurant_id    | varchar      | NOT NULL, FOREIGN KEY → restaurants.id     |
| change_type      | text         | NOT NULL                                   |
| quantity_changed | decimal(10,2)| NOT NULL                                   |
| final_quantity   | decimal(10,2)| NOT NULL                                   |
| created_at       | timestamp    | DEFAULT NOW()                              |
| created_by       | varchar      | FOREIGN KEY → users.id                     |
| notes            | text         | NULLABLE                                   |

**Change Types:** `Delivery` | `EndOfDayCount` | `Adjustment`

#### Recipe
| Column        | Type      | Constraints                           |
|---------------|-----------|---------------------------------------|
| id            | varchar   | PRIMARY KEY, UUID                     |
| restaurant_id | varchar   | NOT NULL, FOREIGN KEY → restaurants.id|
| name          | text      | NOT NULL                              |
| ingredients   | json      | NOT NULL, DEFAULT []                  |
| instructions  | text      | NULLABLE                              |
| created_at    | timestamp | DEFAULT NOW()                         |
| updated_at    | timestamp | DEFAULT NOW()                         |

**Ingredients JSON Structure:**
```json
[
  {
    "inventoryItemId": "uuid",
    "name": "string",
    "quantity": 0,
    "unit": "string"
  }
]
```

#### CleaningTask
| Column        | Type      | Constraints                           |
|---------------|-----------|---------------------------------------|
| id            | varchar   | PRIMARY KEY, UUID                     |
| restaurant_id | varchar   | NOT NULL, FOREIGN KEY → restaurants.id|
| name          | text      | NOT NULL                              |
| frequency     | text      | NOT NULL                              |
| created_at    | timestamp | DEFAULT NOW()                         |

#### CleaningLog
| Column           | Type      | Constraints                               |
|------------------|-----------|-------------------------------------------|
| id               | varchar   | PRIMARY KEY, UUID                         |
| cleaning_task_id | varchar   | NOT NULL, FOREIGN KEY → cleaning_tasks.id |
| completed_by     | varchar   | NOT NULL, FOREIGN KEY → users.id          |
| completed_at     | timestamp | DEFAULT NOW()                             |
| notes            | text      | NULLABLE                                  |

### Indexes
- `users_email_idx` - on users(email)
- `users_restaurant_idx` - on users(restaurant_id)
- `users_role_idx` - on users(role)
- `inventory_restaurant_idx` - on inventory_items(restaurant_id)
- `inventory_category_idx` - on inventory_items(category)
- `inventory_name_idx` - on inventory_items(name)
- `inventory_logs_item_idx` - on inventory_logs(inventory_item_id)
- `inventory_logs_restaurant_idx` - on inventory_logs(restaurant_id)
- `inventory_logs_created_at_idx` - on inventory_logs(created_at)
- `inventory_logs_change_type_idx` - on inventory_logs(change_type)
- `recipes_restaurant_idx` - on recipes(restaurant_id)
- `recipes_name_idx` - on recipes(name)
- `cleaning_tasks_restaurant_idx` - on cleaning_tasks(restaurant_id)
- `cleaning_tasks_frequency_idx` - on cleaning_tasks(frequency)
- `cleaning_logs_task_idx` - on cleaning_logs(cleaning_task_id)
- `cleaning_logs_completed_by_idx` - on cleaning_logs(completed_by)
- `cleaning_logs_completed_at_idx` - on cleaning_logs(completed_at)

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
- Added complete database schema with 7 tables
- Implemented relationships between restaurants, users, inventory, recipes, and cleaning tasks
- Added indexes for query optimization
- Created in-memory storage with CRUD operations for all entities
- Two restaurants are seeded on startup ("Restaurant A" and "Restaurant B")
- Implemented secure JWT authentication with token type differentiation (access/refresh)
- Added role-based authorization (admin, manager, staff) with restaurant isolation
- Created inventory search endpoint (`GET /api/inventory/search?q=query`) with:
  - Fast, case-insensitive search
  - Restaurant isolation (users only see their restaurant's items)
  - Configurable result limit
- Added InventorySearchBox component with autocomplete using cmdk
- Added auth token management in queryClient (setAuthToken, getAuthToken, clearAuthToken)
