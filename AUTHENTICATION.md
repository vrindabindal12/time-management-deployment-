# Authentication & Access Control Guide

## Overview

The Time Tracking System now includes secure authentication and role-based access control to ensure employees can only access their own data, while administrators have full system access.

## Security Features

### 1. JWT Authentication
- Secure token-based authentication
- 24-hour token expiration
- Automatic token refresh on API calls
- Tokens stored in localStorage (client-side)

### 2. Password Security
- Passwords hashed using Werkzeug's security functions
- Minimum 6-character requirement
- Password change functionality
- No plain-text password storage

### 3. Role-Based Access Control (RBAC)
- Two roles: Admin and Employee
- Route protection based on role
- API endpoint authorization
- Frontend route guards

## User Roles

### Admin Role
Admin credentials are configured via environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

**Permissions:**
- ✅ View all employees
- ✅ Add new employees
- ✅ View any employee's punch history
- ✅ Generate comprehensive reports
- ✅ View real-time status of all employees
- ✅ Access admin dashboard
- ✅ Change own password

**Access:**
- `/admin` - Admin dashboard
- `/admin/history` - All employee history
- `/admin/report` - Full system report
- `/settings` - Account settings

### Employee Role
**Credentials:** Provided by admin during registration

**Permissions:**
- ✅ Punch in/out for themselves only
- ✅ View own punch history
- ✅ View own total hours
- ✅ Change own password
- ❌ Cannot see other employees
- ❌ Cannot access admin features
- ❌ Cannot add employees

**Access:**
- `/dashboard` - Employee dashboard
- `/my-history` - Own punch history
- `/settings` - Account settings

## Authentication Flow

### 1. Login Process
```
User enters email/password
  ↓
Frontend sends POST /api/login
  ↓
Backend validates credentials
  ↓
If valid: Generate JWT token
  ↓
Return token + user info
  ↓
Frontend stores token in localStorage
  ↓
Redirect based on role:
  - Admin → /admin
  - Employee → /dashboard
```

### 2. API Request Flow
```
User makes request
  ↓
Axios interceptor adds token to header
  ↓
Backend validates token
  ↓
If valid: Process request
If invalid/expired: Return 401
  ↓
Frontend interceptor catches 401
  ↓
Clear localStorage & redirect to /login
```

### 3. Route Protection
```
User navigates to protected route
  ↓
useEffect checks authentication
  ↓
If not authenticated → /login
If authenticated:
  - Check role
  - Admin accessing admin route → Allow
  - Employee accessing admin route → /dashboard
  - Employee accessing employee route → Allow
```

## API Endpoints & Authorization

### Public Endpoints (No Authentication Required)
```
POST /api/login       - Login
POST /api/register    - Self-registration
```

### Protected Endpoints (Token Required)
```
All endpoints below require:
Authorization: Bearer <jwt_token>
```

#### Employee Endpoints (Any authenticated user)
```
GET  /api/my-status       - Own status
GET  /api/my-punches      - Own history
POST /api/punch-in        - Punch in
POST /api/punch-out       - Punch out
POST /api/change-password - Change password
```

#### Admin Only Endpoints
```
GET  /api/employees            - List all
POST /api/employees            - Add employee
GET  /api/employee/:id/status  - Any employee status
GET  /api/employee/:id/punches - Any employee history
GET  /api/report               - Full report
```

## Setup Instructions

### Initial Admin Setup

1. **First Login**
```
Navigate to: http://localhost:3000
Login with:
  Email: <ADMIN_EMAIL>
  Password: <ADMIN_PASSWORD>
```

2. **Change Admin Password**
```
Go to: Settings
Enter:
  Current Password: <your current admin password>
  New Password: [secure password]
  Confirm: [secure password]
Click: Change Password
```

3. **Add First Employee**
```
Admin Dashboard → Add New Employee
Enter:
  Name: John Doe
  Email: john@company.com
  Password: [temporary password]
Click: Add Employee
```

4. **Provide Credentials**
```
Give the employee their:
  - Email
  - Temporary password
  - Instructions to change password
```

### Employee Onboarding

1. **First Login**
```
Navigate to: http://localhost:3000
Option A - Use provided credentials
Option B - Self-register at /register
```

2. **Change Password**
```
After first login:
  Go to Settings
  Change temporary password
```

3. **Start Tracking**
```
Dashboard → Punch In
Work...
Dashboard → Punch Out
```

## Security Best Practices

### For Admins

1. **Change Default Password Immediately**
   - Never use a weak/default admin password in production

2. **Strong Passwords**
   - Use at least 12 characters
   - Mix uppercase, lowercase, numbers, symbols

3. **Secure Credential Sharing**
   - Use secure channels to share employee credentials
   - Encourage password changes after first login

4. **Regular Monitoring**
   - Review employee punch records
   - Check for unusual activity

### For Employees

1. **Protect Your Credentials**
   - Never share your password
   - Log out after use on shared computers

2. **Change Temporary Passwords**
   - Change password immediately after first login

3. **Report Issues**
   - Report suspicious activity
   - Contact admin if locked out

## Token Management

### Token Lifespan
- Default: 24 hours
- Auto-logout after expiration
- Must login again after expiration

### Token Storage
- Stored in browser's localStorage
- Cleared on logout
- Cleared on 401 error

### Token Security
- Sent in Authorization header
- Not visible in URL
- HTTPS recommended in production

## Common Issues & Solutions

### "Token is missing"
**Cause:** Not logged in or token expired  
**Solution:** Login again

### "Invalid token"
**Cause:** Token corrupted or tampered  
**Solution:** Logout and login again

### "Admin access required"
**Cause:** Employee trying to access admin endpoint  
**Solution:** Use appropriate employee endpoints

### "Token has expired"
**Cause:** 24 hours passed since login  
**Solution:** Login again

### Can't see other employees' records
**Cause:** Regular employee account  
**Solution:** This is by design - contact admin

## Database Security

### Password Storage
```python
# Passwords are hashed, not stored in plain text
employee.set_password("password123")  # Hashes the password
employee.check_password("password123")  # Verifies hash
```

### Admin Identification
```python
# Admin identified by email
ADMIN_EMAIL = 'admin@example.com'
# is_admin flag in database
employee.is_admin = True/False
```

## Production Deployment

### Security Checklist

- [ ] Change SECRET_KEY in app.py
- [ ] Change default admin password
- [ ] Use HTTPS (not HTTP)
- [ ] Use PostgreSQL (not SQLite)
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Add request logging
- [ ] Regular security audits
- [ ] Backup database regularly
- [ ] Use environment variables

### Recommended Changes

```python
# app.py
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')  # From env
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')

# Token expiration (increase if needed)
'exp': datetime.utcnow() + timedelta(hours=24)
```

## Troubleshooting

### Reset Admin Password

If you forget the admin password:

```python
# In Python console with app context
from app import app, db, Employee
with app.app_context():
    admin = Employee.query.filter_by(email='admin@example.com').first()
    admin.set_password('newpassword')
    db.session.commit()
```

### Add New Admin

To make another user an admin:

```python
from app import app, db, Employee
with app.app_context():
    user = Employee.query.filter_by(email='user@example.com').first()
    user.is_admin = True
    db.session.commit()
```

### Reset Database

To start fresh (WARNING: Deletes all data):

```bash
rm backend/timetracking.db
python backend/app.py  # Creates new DB with admin
```

## Support

For issues:
1. Check this guide
2. Review error messages
3. Check browser console (F12)
4. Check backend terminal logs
5. Review API responses

Remember: Security is everyone's responsibility!
