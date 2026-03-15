# Incident Management AI - Web App

A React frontend for the Incident Management AI system.

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** React Router v6
- **State Management:** Zustand
- **Server State:** TanStack React Query
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest + React Testing Library

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/                 # Router and main app setup
├── features/           # Feature-based organization
│   ├── auth/          # Authentication
│   ├── incidents/     # Incident management
│   ├── responder/     # Issue responder features
│   └── admin/         # Admin features
├── shared/             # Shared components and utilities
│   ├── components/    # Reusable UI components
│   ├── lib/          # Utilities and configurations
│   └── hooks/        # Shared hooks
└── types/             # TypeScript type definitions
```