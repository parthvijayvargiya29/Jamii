# Restaurant Inventory Management System

## Overview
A full-stack web application for managing inventory, recipes, and cleaning tasks across multiple restaurants. The system aims to streamline restaurant operations by providing robust inventory tracking, recipe management, and cleaning schedule oversight. It features JWT-based authentication and role-based authorization to ensure secure and appropriate access levels for different staff roles.

## User Preferences
I prefer simple language and clear explanations. I want iterative development with regular updates. Ask before making major architectural changes or deleting existing code. Do not make changes to the `shared/schema.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The frontend is built with React, utilizing Wouter for routing, TanStack Query for data fetching, and Tailwind CSS for styling. Shadcn UI provides a suite of accessible and customizable UI components, ensuring a consistent and modern look and feel. The application includes a dashboard with analytics charts for admins and managers, low stock alerts, and intuitive forms for managing inventory, recipes, and cleaning tasks.

### Technical Implementations
The backend is a Node.js and Express application, using Drizzle ORM for database interactions and Zod for schema validation. Authentication is handled via JWT, with separate access and refresh tokens, and bcryptjs for password hashing. Role-based authorization (`admin`, `manager`, `staff`) is strictly enforced, along with restaurant isolation to ensure users only access data relevant to their assigned restaurant. Key features include:
- **Inventory Management**: Create, read, update, delete inventory items, track quantities, and log changes.
- **Recipe Management**: Define recipes with ingredients linked to inventory items.
- **Cleaning Task Management**: Station-based cleaning tasks with day scheduling, active/inactive status, and completion logging.
- **Shift Planning**: Calendar-based shift management with Day/Week/Month views, staff availability tracking, and shift assignment capabilities for admins and managers. Availability supports both recurring weekly schedules and specific date overrides.
- **Search Functionality**: Fast, case-insensitive search for inventory items with restaurant isolation.
- **Analytics**: Usage trends, deliveries over time, net movement, and summary statistics with filtering capabilities.
- **Security**: Comprehensive security hardening with role-based restrictions on mutations and enforcement of restaurant isolation on all routes.

### Feature Specifications
- **Multi-Restaurant Support**: Designed to manage inventory and operations for multiple distinct restaurant entities.
- **User Roles**: `admin` (full control), `manager` (manage inventory, recipes, cleaning; cannot delete logs), `staff` (read-only access).
- **Inventory Logging**: Detailed logging of inventory changes (deliveries, end-of-day counts, adjustments) with historical data.
- **Low Stock Alerts**: System identifies and flags inventory items below a defined threshold.
- **Comprehensive Data Seeding**: Automatic seeding of demo restaurants, users, inventory, recipes, and cleaning data for development and testing.

### System Design Choices
- **Modular Structure**: Clear separation of concerns between frontend (client), backend (server), and shared code.
- **Database Schema**: A relational database schema with tables for `Restaurant`, `User`, `InventoryItem`, `InventoryLog`, `Recipe`, `CleaningTask`, and `CleaningLog`, including appropriate foreign key relationships and indexes for efficient querying. CleaningTask schema: id, restaurant_id, day (text), is_active (boolean), station (text), task (text), created_at. Recipes are shared across all restaurants (no restaurant_id).
- **Environment Configuration**: Flexible environment variables for database type, connection strings, and JWT secrets.

## External Dependencies

- **React**: Frontend UI library.
- **Wouter**: Client-side routing.
- **TanStack Query**: Data fetching and caching for the frontend.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn UI**: React component library.
- **Vite**: Frontend build tool.
- **Node.js**: Backend runtime environment.
- **Express**: Web application framework for Node.js.
- **Drizzle ORM**: TypeScript ORM for database interaction.
- **Zod**: Schema validation library.
- **jsonwebtoken (JWT)**: For token-based authentication.
- **bcryptjs**: For password hashing.
- **SQLite**: Development database (via `better-sqlite3`).
- **PostgreSQL**: Production database (via `pg`).