# Atlas: Timesheet and Project Management System

A professional timesheet, expense, and invoicing management platform built with a **Flask (Python)** backend and **Next.js (React/TypeScript/Tailwind CSS)** frontend. 

---

## Key Features

### 🏢 Multi-Tenant & Organization Structure
* Support for multiple **Organizations** with custom names and logos.
* Data isolation across organizations for employees, clients, projects, and billing records.

### 👥 Comprehensive Employee Profiles
* Track employee details: **Designation**, **Reporting Manager**, **Start Date**, and **Hourly Base Rates**.
* **Promotion History:** Record promotion dates, rates, and designation changes (supports up to 5 promotion levels) with automated rate progression.

### 📂 Client & Project Management
* **Clients:** Track clients with unique codes and geographical regions (e.g., US, IN, DE, NL).
* **Projects:** Configure projects with contract types (`Time & Materials`, `Fixed Fee`, `Retainer`, or `Admin`).
* **Service Lines:** Associate projects with specific services.
* **Auto-generated Project Codes:** Codes are automatically generated from the client code, geography, and service lines (e.g., `BKP-US-STR-001`).
* **Soft Delete & Archiving:** Safely archive and restore clients, projects, or services with reasons logged.

### 📅 Weekly Grid Timesheet
* Log daily working hours for the week across active projects and tasks using a spreadsheet-like grid.
* Locked periods (auto-locks entries older than 14 days or in the future).
* Interactive totals and auto-saving on blur.

### 💸 Expense Tracking
* Log weekly expenses (Travel, Food, Accommodation, Others) against specific projects.
* Integrated flow to automatically include expenses in client invoicing.

### 📊 Billing & Payables Reporting
* **Client Invoicing Reports:**
  * Generate summaries of work hours and expenses for specific clients.
  * Adjust hours, apply project-level discounts, and calculate gross invoice values.
  * Export invoices directly to **PDF** or **Excel** sheets.
* **Employee Payables Reports:**
  * Track payable rates based on active promotional tiers at the time of work.
  * Payables review and checkoff workflow.
  * Manual rate overrides and custom non-billable base rates.

### 🔒 Access Control & Security
* Roles: `employee`, `admin`, `both` (users who can switch between panels), and `superadmin`.
* Front-end route guards and secure JSON Web Token (JWT) API authorization.
* Automated welcome emails with set-password links, and secure password resets.

---

## Tech Stack

### Backend
* **Flask 3.0** web framework.
* **SQLAlchemy ORM** (configured for SQLite locally and PostgreSQL in production).
* **Flask-Migrate** for database version schema control.
* **ReportLab** (for PDF invoice generation) and **openpyxl** (for Excel sheet reports).
* **Flask-Mail** for background email notifications.
* **Flask-Limiter** for rate limiting.

### Frontend
* **Next.js 14** (App Router).
* **React 18** with TypeScript.
* **Tailwind CSS** with a custom Glassmorphic design system.
* **Axios** client with automated token storage and 401 redirect interceptors.

---

## Project Structure

```
timeManagement/
├── backend/
│   ├── app.py              # Main Flask application (routes, models, logic)
│   ├── requirements.txt    # Python packages
│   └── migrations/         # DB schema migrations
├── frontend/
│   ├── app/                # Next.js pages and layouts
│   │   ├── admin/          # Admin Dashboard (Clients, Projects, Reports)
│   │   ├── dashboard/      # Employee Timesheet Grid
│   │   └── expenses/       # Employee Expense Grid
│   ├── components/         # Reusable UI components (Header, Clock, etc.)
│   ├── lib/
│   │   └── api.ts          # Axios API endpoints & types
│   ├── package.json        # Node dependencies
│   └── tsconfig.json       # TypeScript config
├── docker-compose.yml      # Docker container stack configuration
└── README.md
```

---

## Setup & Running Locally

Please refer to the **[SETUP.md](SETUP.md)** file for a step-by-step setup guide and quick start commands.

## Deploying to Production

Please refer to **[DEPLOYMENT.md](DEPLOYMENT.md)** and **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** for platforms like Vercel, Railway, Heroku, or VPS with Docker.
