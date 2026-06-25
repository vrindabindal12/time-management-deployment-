# Atlas: Professional Services Timesheet & Project Management System

Atlas is a comprehensive, multi-tenant timesheet tracking, expense logging, and invoicing platform built for professional services, consultancies, and agency environments. It bridges the gap between daily employee logging and monthly client invoicing by automating rate calculation, project code formatting, and billing summaries.

The system is constructed as a decoupled architecture featuring a robust **Flask (Python)** REST API backend and a responsive **Next.js (React/TypeScript/Tailwind CSS)** frontend.

---

## Architecture & System Design

Atlas uses a multi-tenant database model. All core business objects (employees, clients, projects, services, work entries, and expenses) are bound to a specific **Organization** to ensure total data segregation.

```
                  ┌─────────────────────────────────────────┐
                  │              User Browser               │
                  │         (Next.js Single Page App)       │
                  └────────────────────┬────────────────────┘
                                       │
                                       │ HTTPS (JSON / REST API)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │            Flask Web Server             │
                  │    - JWT Authentication & RBAC guards   │
                  │    - Rate Limiting & Validation         │
                  └────────────────────┬────────────────────┘
                                       │
                                       │ SQLAlchemy ORM
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │            Relational DB                │
                  │      (SQLite / PostgreSQL Schema)       │
                  └─────────────────────────────────────────┘
```

### Core Relational Models

1. **Organization**: The top-level tenant. All data belongs to an organization.
2. **Employee**: User accounts with designations, hierarchy rules (Reporting Manager), and a historical sequence of billing rates.
3. **Client**: Corporate clients defined with geographic region codes (e.g., US, IN, DE) for financial tracking.
4. **Project**: Linked to a Client and assigned a contract structure (Time & Materials, Fixed Fee, Retainer, or Admin). Projects contain services and standard project-level rate tables.
5. **WorkEntry (Punch)**: The individual time records containing dates, description text, actual hours logged, invoiceable adjustments, and reviewed payment states.
6. **Expense**: Record of project-specific business expenditures (Travel, Food, etc.) integrated directly into the billing lifecycle.

---

## Deep-Dive: Key Workflows & Business Logic

### 1. Automated Project Code Conventions
To maintain consistent financial tracking across geographical teams, project codes are automatically formatted upon creation according to client and service characteristics:
* Format: `{Organization Code}-{Geography Code}-{Service Line Short Code}-{Sequence}`
* Example: `BKP-US-STR-001` (BKP Organization, United States Geography, Strategy Service Line, Project #1).

### 2. Historical Promotion Rate Resolution
Atlas tracks compensation and client billable rates dynamically over time. When an employee logs a timesheet entry, their payable rate is resolved based on a historical timeline of promotions recorded on their profile:
* **Base Tier:** Initial hourly rate applied from the employee's `start_date`.
* **Promotional Tiers:** Supports up to 5 promotions, each defined with a date (`promotion_X_date`), hourly rate (`promotion_X_rate`), and title change.
* **Resolution Algorithm:** When payables reports are compiled, the system looks up the date of the work entry (`work_date`) and matches it against the active promotional timeline bracket, resolving the exact historical rate the employee earned on that specific day.

### 3. The 14-Day Lock Boundary
To prevent retroactive editing of financial records after billing cycles start:
* Employees can only log or edit hours for the **past 14 days** or **today**.
* Dates older than 14 days or in the future are automatically set to read-only/disabled on the grid inputs.
* This policy is strictly validated on the frontend UI and enforced at the database layer in the Flask REST API.

### 4. Secure Password Reset Flow
To protect user accounts and prevent credential exploitation:
* **Token Hashing:** Password reset requests generate a cryptographically secure random token using `secrets.token_urlsafe(32)`. The database only stores a SHA-256 hash of this token to prevent database leak vulnerabilities.
* **Expiration:** Reset links contain the raw token, which expires in 30 minutes.
* **Brute Force Defense:** The endpoint is rate-limited using a dual key configuration (remote IP address and lowercase email address).
* **Information Leak Prevention:** The API returns a generic success message regardless of whether the email address exists in the system.

### 5. Automated Welcome Email & Unified Access (Role Merging)
To simplify onboarding while maintaining strict security:
* **Account Setup:** When an Admin or Employee account is created, the system automatically commits the profile transaction and sends a welcome email containing a 30-minute expiring secure setup link.
* **Email Uniqueness:** Uniqueness is enforced at the database level using a unique index on the lowercased email field.
* **Role Merging:** Instead of creating duplicate user records for different roles, the system detects if the email already exists and merges the roles (e.g. upgrading an Employee to a combined `both` role status) and suppresses sending duplicate welcome emails.
* **Resend Facility:** Authorized administrators can invalidate previous credentials and resend setup invites with fresh setup tokens.

---

## User Roles & Capabilities

### Superadmin
* Handles global configuration.
* Manages multi-tenant organizations, edits branding/logos, and provisions new organization accounts.

### Admin (Management & Operations)
* **Onboarding & HR:** Creates employee accounts, updates active designations, and programs promotional hourly base rate timelines.
* **Client & Portfolio Management:** Creates clients, configures projects, associates service lines, and sets project-specific hourly billing sheets.
* **Billing Reports:** Generates Client Invoice Reports with customizable discounts, reviews worked hours, and exports professional PDF invoices or Excel summaries.
* **Payables Review:** Reviews the Employee Payables Report, overrides individual work rates, processes payment approvals (paid ticks), and applies general non-billable rates for internal work.

### Employee (Timesheet Logging)
* Logs daily project hours on a simple, responsive **weekly timesheet grid**.
* Auto-fills lines based on active projects and tasks carried over from the previous week.
* Logs project-related business expenses (Travel, Food, Lodging, etc.) via the **Expenses Grid**.
* Manages personal profile details and sets/resets login passwords.

---

## Local Development Setup

### Quick Start
To set up and run both the Flask backend API and Next.js dev server concurrently:

**On Windows:**
```bash
# Executing the automated batch script
.\start.bat
```

**On Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

### Manual Installation
If you prefer running the servers in separate terminals:

1. **Backend API:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   ```
2. **Frontend client:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Refer to the **[SETUP.md](SETUP.md)** document for full details on local environment variables and setup verification.

---

## Production Deployment Checklist

Before moving the stack to production, ensure the following settings are updated:

### Backend (Flask API)
* [ ] **CORS Settings:** Restrict origins in `FRONTEND_URL` environment variables to your custom domains.
* [ ] **Secret Key:** Set a strong cryptographic random seed for `SECRET_KEY` (never leave empty or default).
* [ ] **Database Engine:** Transition from SQLite to PostgreSQL (e.g. Supabase, AWS RDS, Neon) and configure proper connection pooling settings.
* [ ] **Mail Server:** Enter authentic SMTP relay credentials for welcome and password reset emails.

### Frontend (Next.js client)
* [ ] **API Endpoint URL:** Update `NEXT_PUBLIC_API_URL` to point to the live backend service domain.
* [ ] **Build Optimization:** Run `npm run build` to build static pages and verify TypeScript compilation before shipping.

For platform-specific setup instructions (Heroku, Railway, Vercel, VPS Docker), read the **[DEPLOYMENT.md](DEPLOYMENT.md)** and **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** logs.
