# Quick Setup Guide

## Prerequisites

Make sure you have the following installed:
- Python 3.10 or higher
- Node.js 18 or higher
- npm (comes with Node.js)

---

## Quick Start

### Option 1: Using Start Scripts (Recommended)

**On Windows:**
Double-click or run:
```bash
start.bat
```

**On Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```
*These scripts will create python virtual environments, install dependencies for both folders, and start the development servers.*

---

### Option 2: Manual Setup

**Terminal 1 - Backend (Flask API):**
```bash
cd backend
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies & run
pip install -r requirements.txt
python app.py
```

**Terminal 2 - Frontend (Next.js):**
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### 1. Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
SECRET_KEY=generate-a-long-random-string-here
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=securetempadminpassword
```
*(Optionally configure `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` for automated email notifications).*

### 2. Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## First Steps & Workflows

### 1. Initial Admin Configuration
1. Open the UI at **http://localhost:3000** (you will be redirected to `/login`).
2. Log in using your configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Go to **Settings** and update the admin password.

### 2. Onboard Employees
1. Navigate to the **Employees** tab in the Admin Dashboard.
2. Click **Onboard Employee** and fill in details (Name, Email, Designation, Role, Start Date, Base Hourly Rate).
3. The employee will receive an automated welcome email with a link to set their password.

### 3. Setup Clients and Projects
1. Go to the **Clients** tab and create a new client (inputting code and geography).
2. Go to **Projects** and create a project for that client. Select a contract type (e.g. `Fixed Fee`, `Time & Materials`), standard rates, is-billable status, and associated service lines. 
3. The system automatically registers the project and generates a project code.

### 4. Logging Hours (Employee View)
1. Employees log in at **http://localhost:3000**.
2. On the **Time Sheet** grid, click **+ Add Row**, select a project, and enter the task description.
3. Type the hours worked under each weekday column (totals and grand totals recalculate in real-time). Clicking outside the input or tab-navigating auto-saves the entry.
4. Note: Entries older than 14 days or in the future are locked automatically.
5. In the **Expenses** tab, employees can add rows to report Travel, Food, and other costs per project.

### 5. Reviewing Payables & Invoicing (Admin View)
1. Go to the **Admin Panel** and run the **Client Invoice Report** for any client and date range. You can adjust invoice parameters and export to PDF or Excel.
2. Go to the **Employee Payables Report** to review worked hours, apply non-billable rates, tick entries as paid/reviewed, and track employee compensation.

---

## Troubleshooting

### Port 5000 is Busy (Backend Failures)
If the Flask server says the port is already in use:
* **Windows:**
  ```powershell
  # Find PID using port 5000
  netstat -ano | findstr :5000
  # Kill task by PID
  taskkill /PID <PID> /F
  ```
* **Mac/Linux:**
  ```bash
  kill -9 $(lsof -t -i:5000)
  ```

### Reset Database
To reset the SQLite database completely:
1. Stop the backend server.
2. Delete `backend/timetracking.db`.
3. Restart the backend (`python app.py`). The tables and default admin will be re-created automatically.
