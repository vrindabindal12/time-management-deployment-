# Docker Deployment Guide

Deploy the entire Time Tracking System using Docker and Docker Compose.

## Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed ([Get Docker Compose](https://docs.docker.com/compose/install/))

## Quick Start

### 1. Clone/Extract the Project
```bash
cd time-tracking-system
```

### 2. Set Up Environment Variables
```bash
# Copy the example file
cp .env.docker.example .env

# Edit the .env file
nano .env  # or use your preferred editor
```

Update these values:
```env
DB_PASSWORD=your-secure-database-password
SECRET_KEY=your-super-secret-key-at-least-32-characters-long
ADMIN_EMAIL=mananbedi.tech@gmail.com
```

### 3. Build and Start Services
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 4. Initialize Database
The database will be automatically created on first run. The admin user will be created automatically.

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Database**: localhost:5432

Default login:
- Email: `mananbedi.tech@gmail.com`
- Password: `admin123`

⚠️ **Change the admin password immediately!**

## Docker Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Stop and Remove Data
```bash
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

### Check Status
```bash
docker-compose ps
```

### Access Database
```bash
docker-compose exec db psql -U timetracking -d timetracking
```

### Execute Commands in Container
```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh
```

## Production Deployment with Docker

### 1. Update Environment Variables
```env
# .env file
DB_PASSWORD=very-secure-password
SECRET_KEY=long-random-secret-key-at-least-32-chars
FRONTEND_URL=https://timetracking.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### 2. Use a Reverse Proxy (Nginx)

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Set Up SSL with Let's Encrypt
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### 4. Deploy
```bash
docker-compose up -d --build
```

## Deploy to VPS (DigitalOcean, AWS, etc.)

### 1. Set Up VPS
```bash
# Connect to your VPS
ssh root@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Upload Project
```bash
# From your local machine
scp -r time-tracking-system root@your-vps-ip:/root/

# Or clone from Git
ssh root@your-vps-ip
git clone your-repo-url
cd your-repo
```

### 3. Deploy
```bash
# On VPS
cd time-tracking-system
cp .env.docker.example .env
nano .env  # Update values

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Configure Firewall
```bash
# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## Backup and Restore

### Backup Database
```bash
# Create backup
docker-compose exec db pg_dump -U timetracking timetracking > backup.sql

# Or use docker volume
docker run --rm -v timetracking_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```

### Restore Database
```bash
# Restore from SQL
cat backup.sql | docker-compose exec -T db psql -U timetracking timetracking

# Or restore volume
docker run --rm -v timetracking_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /
```

## Monitoring

### Check Resource Usage
```bash
docker stats
```

### Check Disk Space
```bash
docker system df
```

### Clean Up Unused Resources
```bash
docker system prune -a
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose logs

# Check if ports are in use
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :5000
```

### Database Connection Issues
```bash
# Check if database is ready
docker-compose exec db pg_isready -U timetracking

# Restart database
docker-compose restart db
```

### Frontend Can't Connect to Backend
```bash
# Check backend is running
curl http://localhost:5000/api/employees

# Check environment variables
docker-compose exec frontend env | grep NEXT_PUBLIC_API_URL
```

### Reset Everything
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## Security Best Practices

1. **Change Default Credentials**
   - Update DB_PASSWORD
   - Update SECRET_KEY
   - Change admin password after first login

2. **Use Secrets in Production**
   - Use Docker secrets instead of environment variables
   - Store sensitive data in secure vault

3. **Enable HTTPS**
   - Use Let's Encrypt for free SSL
   - Configure reverse proxy

4. **Regular Updates**
   - Keep Docker images updated
   - Update application dependencies

5. **Backups**
   - Schedule automatic database backups
   - Test restore procedures

## Performance Tuning

### Increase Workers
Edit `docker-compose.yml`:
```yaml
backend:
  command: gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

### Resource Limits
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
```

## Scaling

### Add More Backend Workers
```yaml
backend:
  deploy:
    replicas: 3
```

### Use Load Balancer
Add Nginx as load balancer in docker-compose.yml

---

You're now ready to deploy with Docker! 🐳

For questions or issues, check the logs first:
```bash
docker-compose logs -f
```
