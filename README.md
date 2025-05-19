# Seer Application

A full-stack web application built with React, TypeScript, Tailwind CSS, Prisma, and Express.

## Project Structure

- `frontend/` - React application with Vite and Tailwind CSS
- `backend/` - Express API with Prisma ORM

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup the database:
   ```bash
   npx prisma migrate dev --name init
   ```

4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on http://localhost:5000.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend application will run on http://localhost:5173.

## Technologies Used

- **Frontend**:
  - React with TypeScript
  - Vite (for faster development)
  - Tailwind CSS (for styling)

- **Backend**:
  - Express (Node.js framework)
  - Prisma (ORM for database access)
  - SQLite (development database)

## Development

- Frontend code is in the `frontend/src` directory
- Backend code is in the `backend/src` directory
- Database schema is defined in `backend/prisma/schema.prisma` 