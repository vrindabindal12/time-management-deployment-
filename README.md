# Time Tracking System

A complete employee time tracking system with **authentication and role-based access control**, built with Flask (Python) backend and Next.js (React/TypeScript) frontend.

## Features

- ✅ **User Authentication** - Secure login/registration with JWT tokens
- ✅ **Role-Based Access Control** - Admin and Employee roles with different permissions
- ✅ **Employee Self-Service** - Users can only punch in/out for themselves and view their own records
- ✅ **Admin Dashboard** - Full access to manage employees and view all records
- ✅ **Punch In/Out System** - Automatic timestamp recording
- ✅ **Real-time Status Tracking** - See who's currently punched in (admin only)
- ✅ **Work History** - Employees view their own history, admin views all
- ✅ **Comprehensive Reporting** - Total hours calculation and statistics (admin only)
- ✅ **Password Management** - Change password functionality
- ✅ **Beautiful, Responsive UI** - Modern design with Tailwind CSS

## Security & Access Control

### Admin
(First admin is created from `ADMIN_EMAIL` in your backend env; see [SECRETS.md](SECRETS.md).)
- View all employees' punch records
- Generate comprehensive reports
- Add new employees
- View employee status and history

### Regular Employees
- Login with their credentials
- Punch in/out for themselves only
- View their own punch history
- Change their password
- **Cannot** see other employees' records

## Tech Stack

### Backend
- Flask 3.0 with JWT authentication
- SQLAlchemy (SQLite database)
- Flask-CORS for API access
- Password hashing with Werkzeug

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Axios for API calls with interceptors

## Project Structure

```
time-tracking-system/
├── backend/
│   ├── app.py              # Flask application with API routes
│   ├── requirements.txt    # Python dependencies
│   └── timetracking.db     # SQLite database (created automatically)
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Home page (punch in/out)
│   │   ├── history/        # Employee history page
│   │   ├── report/         # All employees report
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── lib/
│   │   └── api.ts          # API client and types
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── .env.local          # Environment variables
└── README.md
```

## Installation & Setup

### Secrets and environment variables

**Do not commit real secrets to GitHub.** All secrets and config go in env files that are gitignored.

1. Copy `.env.example` to create your local env file(s):
   - **Backend:** `backend/.env` (or use root `.env` and run backend from repo root)
   - **Frontend:** `frontend/.env.local` with at least `NEXT_PUBLIC_API_URL`
2. Fill in real values only in those env files. Keep `.env.example` as a template with placeholders.
3. See [SECRETS.md](SECRETS.md) for the full list and rules.

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will start on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (already created with default values):
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

4. Run the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## Usage

### First Time Setup

1. **Admin Login**
   - Navigate to http://localhost:3000
   - Login with admin credentials (from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your backend `.env`)
   - **Important**: Change the admin password immediately in Settings

2. **Add Employees** (Admin only)
   - Click "Add New Employee"
   - Enter name, email, and set a password
   - Employee will receive their credentials

### For Employees

1. **Login**
   - Go to http://localhost:3000
   - Login with provided credentials
   - Or register yourself at `/register`

2. **Punch In/Out**
   - Click "Punch In" to start tracking time
   - Click "Punch Out" to stop tracking
   - The system automatically records timestamps

3. **View Your History**
   - Click "View My History" to see your own punch records
   - See your total hours worked

4. **Change Password**
   - Go to Settings to change your password

### For Admin

1. **Manage Employees**
   - View all employees
   - Add new employees with credentials
   - See real-time status of each employee

2. **View All Records**
   - Click "Employee History" to see any employee's records
   - Select employee from dropdown

3. **Generate Reports**
   - Click "Full Report" to see all employees' statistics
   - View total hours, days worked, and averages

## Admin Credentials

Admin email and password are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your backend `.env` (see [SECRETS.md](SECRETS.md)). Change the admin password after first login.

## API Endpoints

### Authentication (Public)
- `POST /api/login` - Login and get JWT token
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- `POST /api/register` - Register new employee
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

### Protected Endpoints (Requires Authentication)
All endpoints below require `Authorization: Bearer <token>` header

#### Employee Self-Service
- `GET /api/my-status` - Get own current status
- `GET /api/my-punches` - Get own punch history
- `POST /api/punch-in` - Punch in (no employee_id needed)
- `POST /api/punch-out` - Punch out (no employee_id needed)
- `POST /api/change-password` - Change own password
  ```json
  {
    "old_password": "oldpass",
    "new_password": "newpass"
  }
  ```

#### Admin Only Endpoints
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- `GET /api/employee/{id}/status` - Get any employee's status
- `GET /api/employee/{id}/punches` - Get any employee's punch history
- `GET /api/report` - Get report for all employees

## Database Schema

### Employee Table
- `id` (Integer, Primary Key)
- `name` (String, 100)
- `email` (String, 120, Unique)
- `password_hash` (String, 255) - Encrypted password
- `is_admin` (Boolean, Default: False)

### Punch Table
- `id` (Integer, Primary Key)
- `employee_id` (Integer, Foreign Key)
- `punch_in` (DateTime)
- `punch_out` (DateTime, Nullable)
- `total_hours` (Float, Nullable)

## Features in Detail

### Automatic Time Calculation
When an employee punches out, the system automatically:
1. Records the punch out time
2. Calculates the difference between punch in and punch out
3. Converts to hours (rounded to 2 decimal places)
4. Stores in the database

### Status Tracking
- Real-time display of whether an employee is currently punched in
- Prevents double punch in (must punch out first)
- Prevents punch out without punch in

### Validation
- Email uniqueness validation
- Active punch validation
- Employee existence validation

## Deployment

The system can be deployed in multiple ways:

### 🚀 Quick Deploy Options

1. **Docker (Recommended for VPS)**
   ```bash
   docker-compose up -d
   ```
   See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for details

2. **Heroku + Vercel (Free Tier)**
   - Backend: Heroku
   - Frontend: Vercel
   See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step guide

3. **Railway + Vercel (Easiest)**
   - Backend: Railway.app
   - Frontend: Vercel
   See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions

### 📚 Deployment Guides

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide for all platforms
- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Docker & Docker Compose guide
- **Configuration files included:**
  - `backend/Procfile` - Heroku configuration
  - `backend/Dockerfile` - Docker image
  - `frontend/Dockerfile` - Frontend Docker image
  - `docker-compose.yml` - Full stack deployment
  - `.env.example` files - Environment configuration

### 🔒 Pre-Deployment Checklist

- [ ] Change `SECRET_KEY` in backend
- [ ] Update admin password after first login
- [ ] Set up PostgreSQL database
- [ ] Configure environment variables
- [ ] Enable HTTPS/SSL
- [ ] Set up proper CORS origins

See the deployment guides for detailed instructions!

### Backend Development
- The database is automatically created on first run
- SQLite is used for simplicity (can be replaced with PostgreSQL/MySQL)
- CORS is enabled for frontend access

### Frontend Development
- Uses Next.js App Router (latest version)
- TypeScript for type safety
- Tailwind CSS for styling
- Responsive design for mobile and desktop

## Production Deployment

### Backend
1. Use a production WSGI server (Gunicorn):
```bash
pip install gunicorn
gunicorn app:app
```

2. Consider using PostgreSQL instead of SQLite
3. Set proper CORS origins
4. Use environment variables for configuration

### Frontend
1. Build the production version:
```bash
npm run build
npm start
```

2. Deploy to Vercel, Netlify, or any Node.js hosting
3. Update `NEXT_PUBLIC_API_URL` to production API URL

## Future Enhancements

- User authentication and authorization
- Multiple punch sessions per day
- Break time tracking
- Export reports to PDF/Excel
- Email notifications
- Admin dashboard
- Location tracking (GPS)
- Photo capture on punch in/out
- Overtime calculation
- Shift management

## License

MIT License - Feel free to use this project for your needs.

## Support

For issues or questions, please open an issue in the repository.



Admin 
- Client filter employee history
- Clients section gross rates (PROJECT LEVEL SHOULD AUTO POPULATE)
- Rates locking in until promotion
- payable mein tick (client invoicing also)
- non billable work handling

Employee
- Weekly Update