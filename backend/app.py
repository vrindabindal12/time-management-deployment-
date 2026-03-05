from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os
import csv
import io
from functools import wraps
from openpyxl import Workbook

app = Flask(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'mananbedi.tech@gmail.com')

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'timetracking.db'))
# Fix Heroku PostgreSQL URL format
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# CORS configuration
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[FRONTEND_URL, 'http://localhost:3000'], supports_credentials=True)

db = SQLAlchemy(app)

# Models
class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    punches = db.relationship('Punch', backref='employee', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'is_admin': self.is_admin
        }

class Punch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    project_name = db.Column(db.String(200), nullable=False)
    work_date = db.Column(db.Date, nullable=False)
    hours_worked = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_admin = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'project_name': self.project_name,
            'work_date': self.work_date.isoformat() if self.work_date else None,
            'hours_worked': self.hours_worked,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by_admin': self.updated_by_admin
        }

class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    code = db.Column(db.String(50), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    projects = db.relationship('Project', backref='client', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    rates = db.relationship('ProjectRate', backref='project', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('client_id', 'code', name='uq_client_project_code'),)

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'name': self.name,
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'rates': [rate.to_dict() for rate in self.rates]
        }

class ProjectRate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    designation = db.Column(db.String(100), nullable=False)  # Managing Director, Associate Director, Senior Consultant
    gross_rate = db.Column(db.Float, nullable=False)
    discount = db.Column(db.Float, default=0.0)  # Stored as percentage (0-100)
    net_rate = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'designation': self.designation,
            'gross_rate': self.gross_rate,
            'discount': self.discount,
            'net_rate': self.net_rate,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


def get_filtered_work_entries(employee_id):
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    project_name = (request.args.get('project_name') or '').strip()

    query = Punch.query.filter_by(employee_id=employee_id)

    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Punch.work_date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Punch.work_date <= end)
        except ValueError:
            pass

    if project_name:
        query = query.filter(Punch.project_name.ilike(f'%{project_name}%'))

    return query.order_by(Punch.work_date.desc(), Punch.id.desc()).all()


def build_export_rows(employee, work_entries):
    rows = []
    for entry in work_entries:
        rows.append({
            'ID': entry.id,
            'Employee Name': employee.name,
            'Employee Email': employee.email,
            'Project Name': entry.project_name,
            'Work Date': entry.work_date.isoformat() if entry.work_date else '',
            'Hours Worked': round(entry.hours_worked, 2),
            'Description': entry.description or '',
            'Updated By Admin': 'Yes' if entry.updated_by_admin else 'No',
            'Created At': entry.created_at.isoformat() if entry.created_at else '',
            'Updated At': entry.updated_at.isoformat() if entry.updated_at else ''
        })
    return rows


def create_csv_response(filename, rows):
    output = io.StringIO()
    fieldnames = [
        'ID', 'Employee Name', 'Employee Email', 'Project Name',
        'Work Date', 'Hours Worked', 'Description', 'Updated By Admin',
        'Created At', 'Updated At'
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)

    data = io.BytesIO(output.getvalue().encode('utf-8'))
    output.close()
    data.seek(0)

    return send_file(
        data,
        as_attachment=True,
        download_name=filename,
        mimetype='text/csv'
    )


def create_excel_response(filename, rows):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = 'Work History'

    headers = [
        'ID', 'Employee Name', 'Employee Email', 'Project Name',
        'Work Date', 'Hours Worked', 'Description', 'Updated By Admin',
        'Created At', 'Updated At'
    ]
    worksheet.append(headers)

    for row in rows:
        worksheet.append([row.get(header, '') for header in headers])

    data = io.BytesIO()
    workbook.save(data)
    data.seek(0)

    return send_file(
        data,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


def export_work_history(employee, work_entries):
    fmt = (request.args.get('format') or 'csv').strip().lower()
    rows = build_export_rows(employee, work_entries)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = employee.name.replace(' ', '_')

    if fmt == 'excel':
        filename = f'work_history_{safe_name}_{timestamp}.xlsx'
        return create_excel_response(filename, rows)
    if fmt == 'csv':
        filename = f'work_history_{safe_name}_{timestamp}.csv'
        return create_csv_response(filename, rows)

    return jsonify({'error': 'Invalid format. Use csv or excel'}), 400

# Initialize database
with app.app_context():
    db.create_all()
    # Backfill legacy rows where description may be null from older schema versions.
    legacy_null_descriptions = Punch.query.filter(Punch.description.is_(None)).all()
    if legacy_null_descriptions:
        for entry in legacy_null_descriptions:
            entry.description = ''
        db.session.commit()

    # Create admin user if not exists
    admin = Employee.query.filter_by(email=ADMIN_EMAIL).first()
    if not admin:
        admin = Employee(
            name='Admin',
            email=ADMIN_EMAIL,
            is_admin=True
        )
        admin.set_password('admin123')  # Default password, change after first login
        db.session.add(admin)
        db.session.commit()
        print(f"Admin user created: {ADMIN_EMAIL} / password: admin123")

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = Employee.query.get(data['employee_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Admin-only decorator
def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return f(current_user, *args, **kwargs)
    
    return decorated

# Routes
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    employee = Employee.query.filter_by(email=data['email']).first()
    
    if not employee or not employee.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Generate JWT token
    token = jwt.encode({
        'employee_id': employee.id,
        'email': employee.email,
        'is_admin': employee.is_admin,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'token': token,
        'employee': employee.to_dict()
    }), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    if not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Name, email, and password are required'}), 400
    
    existing_employee = Employee.query.filter_by(email=data['email']).first()
    if existing_employee:
        return jsonify({'error': 'Employee with this email already exists'}), 400
    
    employee = Employee(
        name=data['name'],
        email=data['email'],
        is_admin=False
    )
    employee.set_password(data['password'])
    
    db.session.add(employee)
    db.session.commit()
    
    return jsonify({'message': 'Employee registered successfully', 'employee': employee.to_dict()}), 201

@app.route('/api/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    data = request.json
    
    if not data.get('old_password') or not data.get('new_password'):
        return jsonify({'error': 'Old password and new password are required'}), 400
    
    if not current_user.check_password(data['old_password']):
        return jsonify({'error': 'Old password is incorrect'}), 401
    
    current_user.set_password(data['new_password'])
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200

@app.route('/api/employees', methods=['GET'])
@token_required
@admin_required
def get_employees(current_user):
    employees = Employee.query.all()
    return jsonify([emp.to_dict() for emp in employees])

@app.route('/api/employees', methods=['POST'])
@token_required
@admin_required
def create_employee(current_user):
    data = request.json
    
    if not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Name, email, and password are required'}), 400
    
    existing_employee = Employee.query.filter_by(email=data['email']).first()
    if existing_employee:
        return jsonify({'error': 'Employee with this email already exists'}), 400
    
    employee = Employee(
        name=data['name'],
        email=data['email'],
        is_admin=False
    )
    employee.set_password(data['password'])
    
    db.session.add(employee)
    db.session.commit()
    
    return jsonify(employee.to_dict()), 201

@app.route('/api/add-work', methods=['POST'])
@token_required
def add_work(current_user):
    data = request.json or {}
    project_name = (data.get('project_name') or '').strip()
    description = (data.get('description') or '').strip()
    
    # Validate required fields
    if not project_name or not data.get('hours_worked') or not data.get('work_date') or not description:
        return jsonify({'error': 'Project name, description, hours worked, and work date are required'}), 400
    
    try:
        hours_worked = float(data['hours_worked'])
        if hours_worked <= 0 or hours_worked > 24:
            return jsonify({'error': 'Hours worked must be between 0 and 24'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid hours format'}), 400
    
    try:
        work_date = datetime.strptime(data['work_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    # Employee can only add work for themselves
    work_entry = Punch(
        employee_id=current_user.id,
        project_name=project_name,
        work_date=work_date,
        hours_worked=hours_worked,
        description=description,
        updated_by_admin=False
    )
    
    db.session.add(work_entry)
    db.session.commit()
    
    return jsonify(work_entry.to_dict()), 201

@app.route('/api/my-work', methods=['GET'])
@token_required
def get_my_work(current_user):
    work_entries = get_filtered_work_entries(current_user.id)
    total_hours = sum(entry.hours_worked for entry in work_entries)
    
    return jsonify({
        'employee': current_user.to_dict(),
        'work_entries': [entry.to_dict() for entry in work_entries],
        'total_hours': round(total_hours, 2)
    })


@app.route('/api/my-work/export', methods=['GET'])
@token_required
def export_my_work(current_user):
    work_entries = get_filtered_work_entries(current_user.id)
    return export_work_history(current_user, work_entries)

@app.route('/api/work/<int:work_id>', methods=['PUT'])
@token_required
@admin_required
def edit_work(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404
    
    data = request.json
    
    # Update fields if provided
    if 'project_name' in data:
        project_name = (data.get('project_name') or '').strip()
        if not project_name:
            return jsonify({'error': 'Project name is required'}), 400
        work_entry.project_name = project_name
    
    if 'hours_worked' in data:
        try:
            hours = float(data['hours_worked'])
            if hours <= 0 or hours > 24:
                return jsonify({'error': 'Hours worked must be between 0 and 24'}), 400
            work_entry.hours_worked = hours
        except ValueError:
            return jsonify({'error': 'Invalid hours format'}), 400
    
    if 'work_date' in data:
        try:
            work_entry.work_date = datetime.strptime(data['work_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    if 'description' in data:
        description = (data.get('description') or '').strip()
        if not description:
            return jsonify({'error': 'Description is required'}), 400
        work_entry.description = description
    
    work_entry.updated_by_admin = True
    work_entry.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify(work_entry.to_dict()), 200

@app.route('/api/work/<int:work_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_work(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404
    
    db.session.delete(work_entry)
    db.session.commit()
    
    return jsonify({'message': 'Work entry deleted successfully'}), 200

@app.route('/api/my-status', methods=['GET'])
@token_required
def get_my_status(current_user):
    # Get today's work entries
    today = datetime.now().date()
    today_entries = Punch.query.filter_by(
        employee_id=current_user.id,
        work_date=today
    ).all()
    
    today_hours = sum(entry.hours_worked for entry in today_entries)
    
    return jsonify({
        'employee': current_user.to_dict(),
        'today_entries': [entry.to_dict() for entry in today_entries],
        'today_hours': round(today_hours, 2)
    })

@app.route('/api/my-punches', methods=['GET'])
@token_required
def get_my_punches(current_user):
    # For backward compatibility - redirects to my-work
    return get_my_work(current_user)

@app.route('/api/employee/<int:employee_id>/status', methods=['GET'])
@token_required
@admin_required
def get_employee_status(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404
    
    # Get today's work entries
    today = datetime.now().date()
    today_entries = Punch.query.filter_by(
        employee_id=employee_id,
        work_date=today
    ).all()
    
    today_hours = sum(entry.hours_worked for entry in today_entries)
    
    return jsonify({
        'employee': employee.to_dict(),
        'today_entries': [entry.to_dict() for entry in today_entries],
        'today_hours': round(today_hours, 2)
    })

@app.route('/api/employee/<int:employee_id>/work', methods=['GET'])
@token_required
@admin_required
def get_employee_work(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404

    work_entries = get_filtered_work_entries(employee_id)
    total_hours = sum(entry.hours_worked for entry in work_entries)
    
    return jsonify({
        'employee': employee.to_dict(),
        'work_entries': [entry.to_dict() for entry in work_entries],
        'total_hours': round(total_hours, 2)
    })


@app.route('/api/employee/<int:employee_id>/work/export', methods=['GET'])
@token_required
@admin_required
def export_employee_work(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404

    work_entries = get_filtered_work_entries(employee_id)
    return export_work_history(employee, work_entries)

@app.route('/api/employee/<int:employee_id>/punches', methods=['GET'])
@token_required
@admin_required
def get_employee_punches(current_user, employee_id):
    # For backward compatibility - redirects to work
    return get_employee_work(current_user, employee_id)

@app.route('/api/report', methods=['GET'])
@token_required
@admin_required
def get_report(current_user):
    employees = Employee.query.all()
    report = []
    
    for employee in employees:
        work_entries = Punch.query.filter_by(employee_id=employee.id).all()
        total_hours = sum(entry.hours_worked for entry in work_entries)
        
        # Count unique work days
        unique_dates = set(entry.work_date for entry in work_entries)
        
        report.append({
            'employee': employee.to_dict(),
            'total_hours': round(total_hours, 2),
            'total_days': len(unique_dates),
            'total_entries': len(work_entries)
        })
    
    return jsonify(report)

# ==================== CLIENT ROUTES ====================
@app.route('/api/clients', methods=['GET'])
@token_required
@admin_required
def get_clients(current_user):
    clients = Client.query.all()
    return jsonify([client.to_dict() for client in clients])

@app.route('/api/clients', methods=['POST'])
@token_required
@admin_required
def create_client(current_user):
    data = request.json
    
    if not data.get('name') or not data.get('code'):
        return jsonify({'error': 'Client name and code are required'}), 400
    
    existing_name = Client.query.filter_by(name=data['name']).first()
    if existing_name:
        return jsonify({'error': 'Client with this name already exists'}), 400
    
    existing_code = Client.query.filter_by(code=data['code']).first()
    if existing_code:
        return jsonify({'error': 'Client with this code already exists'}), 400
    
    client = Client(
        name=data['name'].strip(),
        code=data['code'].strip().upper()
    )
    
    db.session.add(client)
    db.session.commit()
    
    return jsonify(client.to_dict()), 201

@app.route('/api/clients/<int:client_id>', methods=['GET'])
@token_required
@admin_required
def get_client(current_user, client_id):
    client = Client.query.get(client_id)
    
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    return jsonify({
        **client.to_dict(),
        'projects': [project.to_dict() for project in client.projects]
    })

@app.route('/api/clients/<int:client_id>', methods=['PUT'])
@token_required
@admin_required
def update_client(current_user, client_id):
    client = Client.query.get(client_id)
    
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    data = request.json
    
    if 'name' in data:
        new_name = data['name'].strip()
        if not new_name:
            return jsonify({'error': 'Client name cannot be empty'}), 400
        
        existing = Client.query.filter_by(name=new_name).first()
        if existing and existing.id != client_id:
            return jsonify({'error': 'Client with this name already exists'}), 400
        
        client.name = new_name
    
    if 'code' in data:
        new_code = data['code'].strip().upper()
        if not new_code:
            return jsonify({'error': 'Client code cannot be empty'}), 400
        
        existing = Client.query.filter_by(code=new_code).first()
        if existing and existing.id != client_id:
            return jsonify({'error': 'Client with this code already exists'}), 400
        
        client.code = new_code
    
    client.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(client.to_dict())

@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_client(current_user, client_id):
    client = Client.query.get(client_id)
    
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    db.session.delete(client)
    db.session.commit()
    
    return jsonify({'message': 'Client deleted successfully'}), 200

# ==================== PROJECT ROUTES ====================
@app.route('/api/clients/<int:client_id>/projects', methods=['GET'])
@token_required
@admin_required
def get_client_projects(current_user, client_id):
    client = Client.query.get(client_id)
    
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    return jsonify([project.to_dict() for project in client.projects])

@app.route('/api/clients/<int:client_id>/projects', methods=['POST'])
@token_required
@admin_required
def create_project(current_user, client_id):
    client = Client.query.get(client_id)
    
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    data = request.json
    
    if not data.get('name') or not data.get('code'):
        return jsonify({'error': 'Project name and code are required'}), 400
    
    # Check if project code already exists for this client
    existing = Project.query.filter_by(client_id=client_id, code=data['code']).first()
    if existing:
        return jsonify({'error': 'Project with this code already exists for this client'}), 400
    
    project = Project(
        client_id=client_id,
        name=data['name'].strip(),
        code=data['code'].strip().upper()
    )
    
    db.session.add(project)
    db.session.commit()
    
    return jsonify(project.to_dict()), 201

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@token_required
@admin_required
def get_project(current_user, project_id):
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    return jsonify(project.to_dict())

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@token_required
@admin_required
def update_project(current_user, project_id):
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.json
    
    if 'name' in data:
        new_name = data['name'].strip()
        if not new_name:
            return jsonify({'error': 'Project name cannot be empty'}), 400
        project.name = new_name
    
    if 'code' in data:
        new_code = data['code'].strip().upper()
        if not new_code:
            return jsonify({'error': 'Project code cannot be empty'}), 400
        
        existing = Project.query.filter_by(client_id=project.client_id, code=new_code).first()
        if existing and existing.id != project_id:
            return jsonify({'error': 'Project with this code already exists for this client'}), 400
        
        project.code = new_code
    
    project.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(project.to_dict())

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_project(current_user, project_id):
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    db.session.delete(project)
    db.session.commit()
    
    return jsonify({'message': 'Project deleted successfully'}), 200

# ==================== PROJECT RATE ROUTES ====================
@app.route('/api/projects/<int:project_id>/rates', methods=['GET'])
@token_required
@admin_required
def get_project_rates(current_user, project_id):
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    return jsonify([rate.to_dict() for rate in project.rates])

@app.route('/api/projects/<int:project_id>/rates', methods=['POST'])
@token_required
@admin_required
def create_project_rate(current_user, project_id):
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.json
    
    if not data.get('designation') or data.get('gross_rate') is None:
        return jsonify({'error': 'Designation and gross rate are required'}), 400
    
    try:
        gross_rate = float(data['gross_rate'])
        discount = float(data.get('discount', 0))
        
        if gross_rate < 0:
            return jsonify({'error': 'Gross rate must be positive'}), 400
        
        if discount < 0 or discount > 100:
            return jsonify({'error': 'Discount must be between 0 and 100'}), 400
        
        # Calculate net rate: gross_rate * (1 - discount/100)
        net_rate = gross_rate * (1 - discount / 100)
        
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid rate values'}), 400
    
    rate = ProjectRate(
        project_id=project_id,
        designation=data['designation'].strip(),
        gross_rate=gross_rate,
        discount=discount,
        net_rate=round(net_rate, 2)
    )
    
    db.session.add(rate)
    db.session.commit()
    
    return jsonify(rate.to_dict()), 201

@app.route('/api/rates/<int:rate_id>', methods=['PUT'])
@token_required
@admin_required
def update_project_rate(current_user, rate_id):
    rate = ProjectRate.query.get(rate_id)
    
    if not rate:
        return jsonify({'error': 'Rate not found'}), 404
    
    data = request.json
    
    if 'designation' in data:
        designation = data['designation'].strip()
        if not designation:
            return jsonify({'error': 'Designation cannot be empty'}), 400
        rate.designation = designation
    
    if 'gross_rate' in data or 'discount' in data:
        gross_rate = float(data.get('gross_rate', rate.gross_rate))
        discount = float(data.get('discount', rate.discount))
        
        if gross_rate < 0:
            return jsonify({'error': 'Gross rate must be positive'}), 400
        
        if discount < 0 or discount > 100:
            return jsonify({'error': 'Discount must be between 0 and 100'}), 400
        
        rate.gross_rate = gross_rate
        rate.discount = discount
        rate.net_rate = round(gross_rate * (1 - discount / 100), 2)
    
    rate.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(rate.to_dict())

@app.route('/api/rates/<int:rate_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_project_rate(current_user, rate_id):
    rate = ProjectRate.query.get(rate_id)
    
    if not rate:
        return jsonify({'error': 'Rate not found'}), 404
    
    db.session.delete(rate)
    db.session.commit()
    
    return jsonify({'message': 'Rate deleted successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
