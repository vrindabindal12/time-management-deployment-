# Quick Setup Guide

## Prerequisites

Make sure you have the following installed:
- Python 3.8 or higher
- Node.js 16 or higher
- npm (comes with Node.js)

## Quick Start

### Option 1: Using Start Scripts (Recommended)

**On Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**On Windows:**
```bash
start.bat
```

### Option 2: Manual Setup

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Access the Application

Open your browser and go to:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## First Steps

1. **Admin Login**
   - Open http://localhost:3000
   - You'll be redirected to login page
   - Login with admin credentials from your backend `.env`:
     - `ADMIN_EMAIL`
     - `ADMIN_PASSWORD`
   - You'll be redirected to the admin dashboard

2. **⚠️ IMPORTANT: Change Admin Password**
   - Click "Settings" in the admin dashboard
   - Change the default password immediately
   - Use a strong password (12+ characters recommended)

3. **Add Employees** (Admin only)
   - In admin dashboard, click "Add New Employee"
   - Enter name, email, and set a password
   - Give the credentials to the employee
   - Employee should change their password after first login

4. **Employee Login**
   - Employees go to http://localhost:3000
   - Login with credentials provided by admin
   - OR self-register at `/register`
   - After login, go to Settings to change password

5. **Punch In/Out** (Employee)
   - In employee dashboard, click "Punch In"
   - Work...
   - Click "Punch Out" when done
   - View your history in "View My History"

6. **View Reports** (Admin only)
   - Admin can view any employee's history
   - Generate full reports with statistics
   - Monitor employee punch status

## Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :5000   # Windows (note the PID and use Task Manager)
```

**Module not found:**
```bash
pip install -r requirements.txt --force-reinstall
```

### Frontend Issues

**Port already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :3000   # Windows
```

**Dependencies error:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**API connection error:**
- Make sure backend is running on port 5000
- Check `.env.local` file has correct API URL
- Try accessing http://localhost:5000/api/employees directly

## Common Commands

### Backend
```bash
# Activate virtual environment
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows

# Install new package
pip install package-name
pip freeze > requirements.txt

# Deactivate virtual environment
deactivate
```

### Frontend
```bash
# Install new package
npm install package-name

# Build for production
npm run build
npm start

# Clear cache
rm -rf .next
```

## Database

The SQLite database (`timetracking.db`) is automatically created in the `backend/` directory when you first run the application.

**Reset database:**
```bash
cd backend
rm timetracking.db
python app.py  # Will recreate the database
```

## Development Tips

1. **Auto-reload is enabled** for both frontend and backend
2. **Check console logs** for errors in browser dev tools
3. **Backend logs** appear in the terminal running Flask
4. **Use API testing tools** like Postman or curl for testing endpoints

## Need Help?

- Check the main README.md for detailed documentation
- Review API endpoints in the backend/app.py file
- Inspect browser console for frontend errors
- Check terminal output for backend errors
