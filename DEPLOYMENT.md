# Deployment Guide



This guide covers deploying the Time Tracking System to production. We'll cover multiple deployment options.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Backend Deployment (Flask)](#backend-deployment)
3. [Frontend Deployment (Next.js)](#frontend-deployment)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Popular Deployment Options](#deployment-options)

---

## Pre-Deployment Checklist

### Security
- [ ] Change `SECRET_KEY` in Flask app
- [ ] Change admin default password
- [ ] Set up environment variables
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Use PostgreSQL instead of SQLite

### Configuration
- [ ] Set production database URL
- [ ] Configure API URL in frontend
- [ ] Set up domain/subdomain
- [ ] Configure email (if needed)

### Testing
- [ ] Test all API endpoints
- [ ] Test authentication flow
- [ ] Test on mobile devices
- [ ] Test with production database

---

## Backend Deployment

### Option 1: Heroku (Recommended for beginners)

#### Step 1: Prepare Flask App

Create `Procfile` in backend folder:
```
web: gunicorn app:app
```

Create `runtime.txt` in backend folder:
```
python-3.11.0
```

Update `requirements.txt`:
```bash
cd backend
pip freeze > requirements.txt
```

#### Step 2: Install Heroku CLI
```bash
# macOS
brew install heroku/brew/heroku

# Windows
# Download from https://devcenter.heroku.com/articles/heroku-cli
```

#### Step 3: Deploy to Heroku
```bash
cd backend

# Login to Heroku
heroku login

# Create new app
heroku create your-timetracking-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set SECRET_KEY="your-super-secret-key-here"
heroku config:set ADMIN_EMAIL="admin@example.com"

# Deploy
git init
git add .
git commit -m "Initial deployment"
git push heroku main

# Run migrations (if needed)
heroku run python
>>> from app import app, db
>>> with app.app_context():
>>>     db.create_all()
>>> exit()

# View logs
heroku logs --tail

# Your API is now at: https://your-timetracking-api.herokuapp.com
```

### Option 2: Railway.app

#### Step 1: Prepare App
Same as Heroku (Procfile, runtime.txt)

#### Step 2: Deploy
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
cd backend
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Set environment variables in Railway dashboard
# Your API URL will be provided
```

### Option 3: DigitalOcean App Platform

#### Step 1: Push to GitHub
```bash
cd backend
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

#### Step 2: Deploy on DigitalOcean
1. Go to DigitalOcean App Platform
2. Click "Create App"
3. Connect GitHub repository
4. Select backend folder
5. Configure:
   - Type: Web Service
   - Environment: Python
   - Build Command: `pip install -r requirements.txt`
   - Run Command: `gunicorn app:app`
6. Add PostgreSQL database
7. Set environment variables
8. Deploy

### Option 4: AWS EC2 / VPS (Advanced)

See [AWS_DEPLOYMENT.md](#aws-deployment) for detailed instructions.

---

## Frontend Deployment

### Option 1: Vercel (Recommended - Made for Next.js)

#### Step 1: Prepare Frontend
Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // For Docker deployment
}

module.exports = nextConfig
```

#### Step 2: Deploy to Vercel
```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: time-tracking-frontend
# - Directory: ./
# - Override settings? No

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL production
# Enter your backend API URL: https://your-timetracking-api.herokuapp.com/api

# Deploy to production
vercel --prod

# Your app is now live at: https://your-app.vercel.app
```

### Option 2: Netlify

#### Step 1: Build Configuration
Create `netlify.toml` in frontend folder:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### Step 2: Deploy
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd frontend
netlify init

# Set environment variable in Netlify dashboard:
# NEXT_PUBLIC_API_URL = https://your-backend-url.com/api

netlify deploy --prod
```

### Option 3: GitHub Pages + Vercel

1. Push frontend to GitHub
2. Go to Vercel.com
3. Import GitHub repository
4. Configure:
   - Framework: Next.js
   - Root directory: frontend
5. Add environment variables
6. Deploy

---

## Database Setup

### PostgreSQL on Heroku
```bash
# Already added with: heroku addons:create heroku-postgresql:mini
# Get database URL
heroku config:get DATABASE_URL

# Access database
heroku pg:psql
```

### PostgreSQL on Railway
```bash
# Added through Railway dashboard
# Connection string provided automatically
```

### Supabase (Free PostgreSQL)
1. Go to supabase.com
2. Create new project
3. Get connection string
4. Update Flask app:
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@host:5432/db'
```

---

## Environment Configuration

### Backend Environment Variables

Create `.env` file in backend (for production):
```env
# Security
SECRET_KEY=your-super-secret-random-key-change-this
ADMIN_EMAIL=admin@example.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Flask
FLASK_ENV=production
FLASK_DEBUG=False

# CORS
FRONTEND_URL=https://your-frontend-domain.com
```

Update `app.py` to use environment variables:
```python
import os
from dotenv import load_dotenv

load_dotenv()

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///timetracking.db')

# If using Heroku PostgreSQL, fix the URL
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

# CORS Configuration
CORS(app, origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')])
```

Install python-dotenv:
```bash
pip install python-dotenv
pip freeze > requirements.txt
```

### Frontend Environment Variables

Create `.env.production` in frontend:
```env
NEXT_PUBLIC_API_URL=https://your-backend-api.herokuapp.com/api
```

---

## Deployment Options Comparison

| Platform | Backend | Frontend | Database | Cost | Difficulty |
|----------|---------|----------|----------|------|------------|
| **Heroku + Vercel** | ✅ | ✅ | ✅ | Free tier available | Easy |
| **Railway + Vercel** | ✅ | ✅ | ✅ | $5/month | Easy |
| **DigitalOcean App** | ✅ | ✅ | ✅ | $12/month | Medium |
| **AWS (EC2/RDS)** | ✅ | ✅ | ✅ | ~$20/month | Hard |
| **VPS (DigitalOcean Droplet)** | ✅ | ✅ | ✅ | $6/month | Hard |

### Recommended Setup (Free/Cheap)

**For Free:**
- Backend: Railway.app (500 hours/month free)
- Frontend: Vercel (Unlimited)
- Database: Supabase (500MB free)

**For Best Performance ($12/month):**
- Backend + Frontend + DB: DigitalOcean App Platform
- Or: Railway ($5) + Vercel (Free)

---

## Step-by-Step: Railway + Vercel (Easiest)

### Part 1: Backend on Railway

1. **Create Railway Account**
   - Go to railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your backend repository
   - Or click "Empty Project" and deploy manually

3. **Add PostgreSQL**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically creates DATABASE_URL

4. **Configure Backend**
   - Go to backend service
   - Click "Variables"
   - Add:
     - `SECRET_KEY`: Generate random string
     - `ADMIN_EMAIL`: admin@example.com
   - Click "Settings"
   - Add start command: `gunicorn app:app`

5. **Deploy**
   - Railway auto-deploys on push
   - Get your backend URL: `https://your-app.railway.app`

### Part 2: Frontend on Vercel

1. **Create Vercel Account**
   - Go to vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your frontend repository
   - Or select from GitHub

3. **Configure**
   - Framework Preset: Next.js
   - Root Directory: `frontend` (if monorepo)
   - Build Command: `npm run build`
   - Output Directory: `.next`

4. **Environment Variables**
   - Add `NEXT_PUBLIC_API_URL`
   - Value: `https://your-backend.railway.app/api`

5. **Deploy**
   - Click "Deploy"
   - Your app is live at: `https://your-app.vercel.app`

6. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your domain
   - Update DNS records as instructed

---

## Post-Deployment

### 1. Test Everything
```bash
# Test backend
curl https://your-backend-url.com/api/employees

# Test login
curl -X POST https://your-backend-url.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'
```

### 2. Change Admin Password
- Login to your deployed app
- Go to Settings
- Change password immediately

### 3. Set Up Monitoring
- Use Railway/Heroku logs
- Set up error tracking (Sentry)
- Monitor API performance

### 4. Set Up Backups
- Enable automatic database backups
- Export data regularly

### 5. Custom Domain (Optional)
- Buy domain (Namecheap, GoDaddy)
- Configure DNS:
  - Frontend: Point to Vercel
  - Backend: Point to Railway/Heroku

---

## Troubleshooting

### CORS Errors
```python
# Update backend CORS
CORS(app, origins=['https://your-frontend-domain.com'], supports_credentials=True)
```

### Database Connection Issues
```python
# Check DATABASE_URL format
# PostgreSQL format: postgresql://user:pass@host:5432/db
```

### Build Failures
```bash
# Check logs
railway logs
# or
heroku logs --tail
# or
vercel logs
```

### 404 on API Calls
- Verify NEXT_PUBLIC_API_URL is correct
- Check if backend is running
- Verify CORS settings

---

## Cost Optimization

### Free Tier Limits
- **Heroku**: 550-1000 dyno hours/month
- **Railway**: 500 execution hours/month  
- **Vercel**: Unlimited frontend hosting
- **Supabase**: 500MB database

### Tips to Stay Free
1. Use Railway for backend (500 hours = ~20 days)
2. Use Vercel for frontend (unlimited)
3. Use Supabase for database (500MB)
4. Sleep backend when inactive
5. Optimize database queries

---

## Security Checklist for Production

- [ ] HTTPS enabled
- [ ] Strong SECRET_KEY
- [ ] Admin password changed
- [ ] Environment variables secured
- [ ] CORS configured properly
- [ ] SQL injection protection (SQLAlchemy handles this)
- [ ] Rate limiting (add Flask-Limiter)
- [ ] Input validation
- [ ] Error messages don't expose system info
- [ ] Database backups enabled
- [ ] Monitoring set up

---

## Need Help?

1. Check deployment platform documentation
2. Review error logs
3. Test locally first
4. Use platform-specific support channels

## Quick Commands Reference

```bash
# Heroku
heroku login
heroku create
heroku logs --tail
heroku config:set KEY=value

# Railway
railway login
railway init
railway up
railway logs

# Vercel
vercel login
vercel
vercel --prod
vercel env add

# Check Python version
python --version

# Create requirements
pip freeze > requirements.txt

# Test locally
flask run
npm run dev
```

Ready to deploy! Choose your platform and follow the guide above. 🚀
