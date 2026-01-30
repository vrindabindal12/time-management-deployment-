# System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                      (http://localhost:3000)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    NEXT.JS FRONTEND                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Pages:                                                   │   │
│  │  • Home (/)           - Punch In/Out Interface           │   │
│  │  • History (/history) - Employee Time Records            │   │
│  │  • Report (/report)   - All Employees Summary            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Client (lib/api.ts)                                 │   │
│  │  • Employee Management                                    │   │
│  │  • Punch In/Out Operations                               │   │
│  │  • Status & Reports                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ REST API Calls
                            │ (axios)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     FLASK BACKEND API                            │
│                   (http://localhost:5000/api)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Endpoints:                                           │   │
│  │  GET  /employees              - List all employees       │   │
│  │  POST /employees              - Create employee          │   │
│  │  POST /punch-in               - Record punch in          │   │
│  │  POST /punch-out              - Record punch out         │   │
│  │  GET  /employee/:id/status    - Get current status       │   │
│  │  GET  /employee/:id/punches   - Get punch history        │   │
│  │  GET  /report                 - Get all employees report │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Business Logic:                                          │   │
│  │  • Validate punch operations                             │   │
│  │  • Calculate work hours                                   │   │
│  │  • Prevent duplicate punch-ins                           │   │
│  │  • Generate reports                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ORM Layer (SQLAlchemy)                                   │   │
│  │  • Employee Model                                         │   │
│  │  • Punch Model                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ SQL Queries
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   SQLITE DATABASE                                │
│                   (timetracking.db)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tables:                                                  │   │
│  │  ┌────────────────┐         ┌────────────────┐          │   │
│  │  │   Employee     │         │     Punch      │          │   │
│  │  ├────────────────┤         ├────────────────┤          │   │
│  │  │ id (PK)        │◄────┐   │ id (PK)        │          │   │
│  │  │ name           │     └───│ employee_id(FK)│          │   │
│  │  │ email (unique) │         │ punch_in       │          │   │
│  │  └────────────────┘         │ punch_out      │          │   │
│  │                              │ total_hours    │          │   │
│  │                              └────────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

Punch In Flow:
1. User selects employee and clicks "Punch In"
2. Frontend calls POST /api/punch-in with employee_id
3. Backend validates employee exists and not already punched in
4. Backend creates new Punch record with current timestamp
5. Backend returns success response
6. Frontend updates UI to show "Punched In" status

Punch Out Flow:
1. User clicks "Punch Out"
2. Frontend calls POST /api/punch-out with employee_id
3. Backend finds active punch record (no punch_out)
4. Backend sets punch_out to current timestamp
5. Backend calculates total_hours (punch_out - punch_in)
6. Backend saves and returns updated record
7. Frontend updates UI to show "Punched Out" status and hours

View History Flow:
1. User navigates to History page
2. Frontend calls GET /api/employee/:id/punches
3. Backend queries all punch records for employee
4. Backend calculates total hours worked
5. Backend returns employee info, punch list, and total
6. Frontend displays data in table format

Generate Report Flow:
1. User navigates to Report page
2. Frontend calls GET /api/report
3. Backend queries all employees and their punches
4. Backend aggregates total hours and days per employee
5. Backend returns summary data
6. Frontend displays statistics and employee table


┌─────────────────────────────────────────────────────────────────┐
│                   TECHNOLOGY STACK                               │
└─────────────────────────────────────────────────────────────────┘

Frontend:
├── React 18 (UI Components)
├── Next.js 14 (Framework, App Router)
├── TypeScript (Type Safety)
├── Tailwind CSS (Styling)
└── Axios (HTTP Client)

Backend:
├── Flask 3.0 (Web Framework)
├── SQLAlchemy (ORM)
├── Flask-CORS (Cross-Origin Resource Sharing)
└── SQLite (Database)

Development Tools:
├── npm (Frontend Package Manager)
├── pip (Backend Package Manager)
└── Virtual Environment (Python Isolation)
```
