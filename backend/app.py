import threading
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta, date
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os
import re
import secrets
import csv
import io
from functools import wraps
from collections import defaultdict
from openpyxl import Workbook
from sqlalchemy import text
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

_PASSWORD_SPECIAL_RE = re.compile(r'[!@#$%^&*()\-_=+\[\]{}|;:\'",.<>?/`~\\]')

def validate_password_strength(password: str):
    """Returns an error message string, or None if the password passes all rules."""
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    if not re.search(r'[a-z]', password):
        return 'Password must contain at least one lowercase letter'
    if not re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter'
    if not _PASSWORD_SPECIAL_RE.search(password):
        return 'Password must contain at least one special character'
    return None

# Project code that identifies non-billable / internal work.
# Entries logged against this project bypass employee compensation rates;
# payables rates must be set manually by an admin.
NON_BILLABLE_PROJECT_CODE = 'BKP-003'
CONTRACT_TYPE_FIXED_FEE = 'fixed_fee'
CONTRACT_TYPE_TIME_MATERIALS = 'time_materials'
CONTRACT_TYPE_RETAINER = 'retainer'
CONTRACT_TYPE_ADMIN = 'admin'
CONTRACT_TYPE_DOCUMENTATION = 'documentation'

app = Flask(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()
FIXED_FEE_WARNING_THRESHOLD = float(os.environ.get('FIXED_FEE_WARNING_THRESHOLD', '0.8'))

# Configuration – all secrets from env; no defaults that contain real secrets
basedir = os.path.abspath(os.path.dirname(__file__))
_secret_key = os.environ.get('SECRET_KEY', '')
if not _secret_key:
    raise ValueError("SECRET_KEY must be set in .env — do not run with an empty key")
app.config['SECRET_KEY'] = _secret_key
ADMIN_EMAIL = (os.environ.get('ADMIN_EMAIL', '') or '').lower().strip()
SUPER_ADMIN_EMAIL = ADMIN_EMAIL
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'timetracking.db'))
# Fix Heroku PostgreSQL URL format
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Production database engine options (connection pooling & SSL)
if not DATABASE_URL.startswith('sqlite'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 5,
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'max_overflow': 10,
    }

# CORS configuration
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[FRONTEND_URL, 'http://localhost:3000'], supports_credentials=True)

# Mail configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])

mail = Mail(app)

db = SQLAlchemy(app)

limiter = Limiter(app=app, key_func=get_remote_address, storage_uri='memory://')

# Models
class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    role = db.Column(db.String(20), nullable=False, server_default='employee')
    employee_code = db.Column(db.String(50), unique=True, nullable=True)
    designation = db.Column(db.String(120), nullable=True)
    reporting_manager = db.Column(db.String(120), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    current_hourly_rate = db.Column(db.Float, nullable=True)
    promotion_1_date = db.Column(db.Date, nullable=True)
    promotion_1_rate = db.Column(db.Float, nullable=True)
    promotion_1_designation = db.Column(db.String(120), nullable=True)
    promotion_2_date = db.Column(db.Date, nullable=True)
    promotion_2_rate = db.Column(db.Float, nullable=True)
    promotion_2_designation = db.Column(db.String(120), nullable=True)
    promotion_3_date = db.Column(db.Date, nullable=True)
    promotion_3_rate = db.Column(db.Float, nullable=True)
    promotion_3_designation = db.Column(db.String(120), nullable=True)
    promotion_4_date = db.Column(db.Date, nullable=True)
    promotion_4_rate = db.Column(db.Float, nullable=True)
    promotion_4_designation = db.Column(db.String(120), nullable=True)
    promotion_5_date = db.Column(db.Date, nullable=True)
    promotion_5_rate = db.Column(db.Float, nullable=True)
    promotion_5_designation = db.Column(db.String(120), nullable=True)
    profile_photo = db.Column(db.Text, nullable=True)
    password_reset_token = db.Column(db.String(100), nullable=True)
    password_reset_expires = db.Column(db.DateTime, nullable=True)
    punches = db.relationship('Punch', backref='employee', lazy=True)

    def generate_password_reset_token(self):
        token = secrets.token_urlsafe(32)
        self.password_reset_token = token
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=24)
        return token

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        effective_role = self.role or 'employee'
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'is_admin': effective_role in ('admin', 'both'),
            'role': effective_role,
            'employee_code': self.employee_code,
            'designation': self.designation,
            'reporting_manager': self.reporting_manager,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'current_hourly_rate': self.current_hourly_rate,
            'promotion_1_date': self.promotion_1_date.isoformat() if self.promotion_1_date else None,
            'promotion_1_rate': self.promotion_1_rate,
            'promotion_1_designation': self.promotion_1_designation,
            'promotion_2_date': self.promotion_2_date.isoformat() if self.promotion_2_date else None,
            'promotion_2_rate': self.promotion_2_rate,
            'promotion_2_designation': self.promotion_2_designation,
            'promotion_3_date': self.promotion_3_date.isoformat() if self.promotion_3_date else None,
            'promotion_3_rate': self.promotion_3_rate,
            'promotion_3_designation': self.promotion_3_designation,
            'promotion_4_date': self.promotion_4_date.isoformat() if self.promotion_4_date else None,
            'promotion_4_rate': self.promotion_4_rate,
            'promotion_4_designation': self.promotion_4_designation,
            'promotion_5_date': self.promotion_5_date.isoformat() if self.promotion_5_date else None,
            'promotion_5_rate': self.promotion_5_rate,
            'promotion_5_designation': self.promotion_5_designation,
            'profile_photo': self.profile_photo,
            'has_set_password': self.password_reset_token is None
        }

class Punch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    project_name = db.Column(db.String(200), nullable=False)
    project_code = db.Column(db.String(50), nullable=True)  # New field for project code
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)  # New field for project FK
    work_date = db.Column(db.Date, nullable=False)
    hours_worked = db.Column(db.Float, nullable=False)
    invoice_hours = db.Column(db.Float, nullable=True)
    invoice_gross_rate = db.Column(db.Float, nullable=True)
    invoice_discount = db.Column(db.Float, nullable=True)
    payable_rate = db.Column(db.Float, nullable=True)  # New field for locked/overridden employee rate
    payable_designation = db.Column(db.String(120), nullable=True)  # New field for locked/overridden designation
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_admin = db.Column(db.Boolean, default=False)
    is_paid = db.Column(db.Boolean, default=False)  # New field for payables tracking
    project = db.relationship('Project', backref='punches', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'project_name': self.project_name,
            'project_code': self.project_code,
            'project_id': self.project_id,
            'client_name': self.project.client.name if self.project else None,
            'work_date': self.work_date.isoformat() if self.work_date else None,
            'hours_worked': float(self.hours_worked) if self.hours_worked is not None else None,
            'invoice_hours': float(self.invoice_hours) if self.invoice_hours is not None else None,
            'invoice_gross_rate': float(self.invoice_gross_rate) if self.invoice_gross_rate is not None else None,
            'invoice_discount': float(self.invoice_discount) if self.invoice_discount is not None else None,
            'payable_rate': float(self.payable_rate) if self.payable_rate is not None else None,
            'payable_designation': self.payable_designation,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to projects: one client can have many projects.
    # When a client is deleted, its projects (and their related data) are also deleted.
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
    contract_type = db.Column(db.String(30), nullable=False, server_default=CONTRACT_TYPE_TIME_MATERIALS)
    fixed_fee_amount = db.Column(db.Float, nullable=True)
    expected_hours = db.Column(db.Float, nullable=True)
    discount = db.Column(db.Float, nullable=True)
    project_discount = db.Column(db.Float, default=0.0)
    standard_rate = db.Column(db.Float, nullable=True)
    is_billable = db.Column(db.Boolean, default=True)
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
            'contract_type': self.contract_type,
            'fixed_fee_amount': float(self.fixed_fee_amount) if self.fixed_fee_amount is not None else None,
            'expected_hours': float(self.expected_hours) if self.expected_hours is not None else None,
            'discount': float(self.discount) if self.discount is not None else None,
            'project_discount': float(self.project_discount) if self.project_discount is not None else 0.0,
            'standard_rate': float(self.standard_rate) if self.standard_rate is not None else None,
            'is_billable': bool(self.is_billable),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'rates': [rate.to_dict() for rate in self.rates]
        }

class EmployeeHiddenProject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    __table_args__ = (db.UniqueConstraint('employee_id', 'project_id', name='uq_employee_hidden_project'),)


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    expense_type = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    week_start_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship('Project', backref='expenses', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else None,
            'project_code': self.project.code if self.project else None,
            'expense_type': self.expense_type,
            'date': self.date.isoformat() if self.date else None,
            'amount': float(self.amount),
            'week_start_date': self.week_start_date.isoformat() if self.week_start_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FixedFeeAlertLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    alert_date = db.Column(db.Date, nullable=False)
    alert_type = db.Column(db.String(20), nullable=False)  # near_limit | overage
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('project_id', 'alert_date', 'alert_type', name='uq_fixed_fee_alert_day_type'),
    )

class ProjectRate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    employee_name = db.Column(db.String(120), nullable=True)
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
            'employee_name': self.employee_name,
            'designation': self.designation,
            'gross_rate': float(self.gross_rate) if self.gross_rate is not None else None,
            'discount': float(self.discount) if self.discount is not None else None,
            'net_rate': float(self.net_rate) if self.net_rate is not None else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


def _send_email_async(app_instance, msg, recipient_email, email_type='email'):
    """Send an email in a background thread so the API responds immediately."""
    def _send():
        with app_instance.app_context():
            try:
                mail.send(msg)
                print(f"{email_type} sent to {recipient_email}")
            except Exception as e:
                print(f"Failed to send {email_type} to {recipient_email}: {str(e)}")
    thread = threading.Thread(target=_send, daemon=True)
    thread.start()


def send_welcome_email(employee, reset_token):
    set_password_url = f"{FRONTEND_URL}/reset-password?token={reset_token}&mode=welcome"

    msg = Message(
        subject='Welcome to Time Tracking — Set Your Password',
        recipients=[employee.email],
        body=f'''Hello {employee.name},

Your account has been created on the Time Tracking System.

Please click the link below to set your password and activate your account:
{set_password_url}

This link will expire in 24 hours.

If you did not expect this email, please contact your administrator.

Best regards,
Time Tracking System Team
''',
        html=f'''
<html>
<body>
    <h2>Hello {employee.name},</h2>
    <p>Your account has been created on the Time Tracking System.</p>
    <p>Please click the button below to set your password:</p>
    <p style="margin: 20px 0;">
        <a href="{set_password_url}"
           style="background-color: #4CAF50; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 4px; display: inline-block;">
            Set Your Password
        </a>
    </p>
    <p><strong>Important:</strong> This link will expire in 24 hours.</p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="{set_password_url}">{set_password_url}</a></p>
    <br>
    <p>Best regards,<br>Time Tracking System Team</p>
</body>
</html>
'''
    )

    _send_email_async(app, msg, employee.email, 'Welcome email')


def send_password_reset_email(employee, reset_token):
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    msg = Message(
        subject='Reset Your Password - Time Tracking System',
        recipients=[employee.email],
        body=f'''Hello {employee.name},

A password reset was requested for your account.

Please click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you did not request a password reset, please ignore this email.

Best regards,
Time Tracking System Team
''',
        html=f'''
<html>
<body>
    <h2>Hello {employee.name},</h2>
    <p>A password reset was requested for your account.</p>
    <p style="margin: 20px 0;">
        <a href="{reset_url}"
           style="background-color: #3B82F6; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
        </a>
    </p>
    <p><strong>Important:</strong> This link will expire in 24 hours.</p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>If you did not request this, please ignore this email.</p>
    <br>
    <p>Best regards,<br>Time Tracking System Team</p>
</body>
</html>
'''
    )

    _send_email_async(app, msg, employee.email, 'Password reset email')


def get_filtered_work_entries(employee_id):
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    project_name = (request.args.get('project_name') or '').strip()
    client_name = (request.args.get('client_name') or '').strip()

    query = Punch.query.filter_by(employee_id=employee_id).options(
        db.joinedload(Punch.project).joinedload(Project.client)
    )

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

    if client_name:
        query = query.filter(
            db.and_(
                Punch.project_id.isnot(None),
                Client.name.ilike(f'%{client_name}%')
            )
        ).join(Project).join(Client)

    return query.order_by(Punch.work_date.desc(), Punch.id.desc()).all()


def build_export_rows(employee, work_entries):
    rows = []
    for entry in work_entries:
        rows.append({
            'ID': entry.id,
            'Employee Name': employee.name,
            'Employee Email': employee.email,
            'Project Name': entry.project_name,
            'Project Code': entry.project_code or '',
            'Client Name': entry.project.client.name if entry.project else '',
            'Work Date': entry.work_date.isoformat() if entry.work_date else '',
            'Hours Worked': round(entry.hours_worked, 2),
            'Description': entry.description or '',
            'Updated By Admin': 'Yes' if entry.updated_by_admin else 'No',
            'Payment Status': 'Paid' if entry.is_paid else 'Unpaid',
            'Created At': entry.created_at.isoformat() if entry.created_at else '',
            'Updated At': entry.updated_at.isoformat() if entry.updated_at else ''
        })
    return rows


def create_csv_response(filename, rows):
    output = io.StringIO()
    fieldnames = [
        'ID', 'Employee Name', 'Employee Email', 'Project Name', 'Project Code', 'Client Name',
        'Work Date', 'Hours Worked', 'Description', 'Updated By Admin', 'Payment Status',
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
        'ID', 'Employee Name', 'Employee Email', 'Project Name', 'Project Code', 'Client Name',
        'Work Date', 'Hours Worked', 'Description', 'Updated By Admin', 'Payment Status',
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


def ensure_role_schema():
    """Add role column and backfill from is_admin for existing databases."""
    # SQLite: add column if missing then backfill
    if DATABASE_URL.startswith('sqlite'):
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(employee)")).fetchall()
        }
        if 'role' not in existing:
            db.session.execute(text("ALTER TABLE employee ADD COLUMN role TEXT NOT NULL DEFAULT 'employee'"))
            db.session.execute(text("UPDATE employee SET role='admin' WHERE is_admin=1"))
        else:
            # Repair any rows with NULL role
            db.session.execute(text("UPDATE employee SET role='admin' WHERE role IS NULL AND is_admin=1"))
            db.session.execute(text("UPDATE employee SET role='employee' WHERE role IS NULL"))
        db.session.commit()
    else:
        # PostgreSQL: attempt column add; ignore if it already exists
        try:
            db.session.execute(text("ALTER TABLE employee ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'employee'"))
            db.session.execute(text("UPDATE employee SET role='admin' WHERE is_admin=TRUE AND role='employee'"))
            db.session.commit()
        except Exception:
            db.session.rollback()


def ensure_employee_schema():
    """Add onboarding/profile columns for existing databases."""
    required_columns = {
        'employee_code': 'VARCHAR(50)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'reporting_manager': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'start_date': 'DATE',
        'current_hourly_rate': 'FLOAT',
        'promotion_1_date': 'DATE',
        'promotion_1_rate': 'FLOAT',
        'promotion_1_designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'promotion_2_date': 'DATE',
        'promotion_2_rate': 'FLOAT',
        'promotion_2_designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'promotion_3_date': 'DATE',
        'promotion_3_rate': 'FLOAT',
        'promotion_3_designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'promotion_4_date': 'DATE',
        'promotion_4_rate': 'FLOAT',
        'promotion_4_designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'promotion_5_date': 'DATE',
        'promotion_5_rate': 'FLOAT',
        'promotion_5_designation': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
        'profile_photo': 'TEXT',
    }

    if DATABASE_URL.startswith('sqlite'):
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(employee)")).fetchall()
        }
        for column_name, column_type in required_columns.items():
            if column_name not in existing:
                db.session.execute(text(f"ALTER TABLE employee ADD COLUMN {column_name} {column_type}"))
        db.session.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_employee_code "
            "ON employee(employee_code)"
        ))
        db.session.commit()
    else:
        for column_name, column_type in required_columns.items():
            try:
                db.session.execute(text(f"ALTER TABLE employee ADD COLUMN {column_name} {column_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()


def ensure_password_reset_schema():
    """Add password_reset_token/expires columns for existing databases."""
    if DATABASE_URL.startswith('sqlite'):
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(employee)")).fetchall()
        }
        for col, col_type in [('password_reset_token', 'TEXT'), ('password_reset_expires', 'DATETIME')]:
            if col not in existing:
                db.session.execute(text(f"ALTER TABLE employee ADD COLUMN {col} {col_type}"))
        db.session.commit()
    else:
        for col, col_type in [('password_reset_token', 'VARCHAR(100)'), ('password_reset_expires', 'TIMESTAMP')]:
            try:
                db.session.execute(text(f"ALTER TABLE employee ADD COLUMN {col} {col_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()


def generate_employee_code(employee_id):
    prefix = os.environ.get('EMPLOYEE_CODE_PREFIX', 'BKP')
    return f'{prefix}-{employee_id:03d}'


def ensure_employee_codes():
    employees = Employee.query.filter_by(is_admin=False).all()
    updated = False
    for employee in employees:
        if not employee.employee_code:
            employee.employee_code = generate_employee_code(employee.id)
            updated = True
    if updated:
        db.session.commit()


def ensure_punch_invoice_schema():
    """Add invoice override columns for existing databases."""
    required_columns_sqlite = {
        'project_code': 'TEXT',
        'project_id': 'INTEGER',
        'invoice_hours': 'FLOAT',
        'invoice_gross_rate': 'FLOAT',
        'invoice_discount': 'FLOAT',
        'payable_rate': 'FLOAT',
        'payable_designation': 'TEXT',
        'is_paid': 'BOOLEAN DEFAULT 0',
    }
    required_columns_pg = {
        'project_code': 'VARCHAR(50)',
        'project_id': 'INTEGER',
        'invoice_hours': 'FLOAT',
        'invoice_gross_rate': 'FLOAT',
        'invoice_discount': 'FLOAT',
        'payable_rate': 'FLOAT',
        'payable_designation': 'VARCHAR(120)',
        'is_paid': 'BOOLEAN DEFAULT FALSE',
    }

    if DATABASE_URL.startswith('sqlite'):
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(punch)")).fetchall()
        }
        for column_name, column_type in required_columns_sqlite.items():
            if column_name not in existing:
                db.session.execute(text(f"ALTER TABLE punch ADD COLUMN {column_name} {column_type}"))
        db.session.commit()
    else:
        for column_name, column_type in required_columns_pg.items():
            try:
                db.session.execute(text(f"ALTER TABLE punch ADD COLUMN {column_name} {column_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()


def ensure_project_rate_schema():
    """Add project rate columns for existing databases."""
    required_columns = {
        'employee_name': 'VARCHAR(120)' if not DATABASE_URL.startswith('sqlite') else 'TEXT',
    }

    if DATABASE_URL.startswith('sqlite'):
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(project_rate)")).fetchall()
        }
        for column_name, column_type in required_columns.items():
            if column_name not in existing:
                db.session.execute(text(f"ALTER TABLE project_rate ADD COLUMN {column_name} {column_type}"))
        db.session.commit()
    else:
        for column_name, column_type in required_columns.items():
            try:
                db.session.execute(text(f"ALTER TABLE project_rate ADD COLUMN {column_name} {column_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()



def ensure_hidden_projects_schema():
    """Create hidden_project table for existing databases."""
    db.create_all()


def ensure_expenses_schema():
    """Create expenses table for existing databases."""
    db.create_all()


def ensure_project_contract_schema():
    """Add project contract fields for existing databases."""
    if DATABASE_URL.startswith('sqlite'):
        required_columns = {
            'contract_type': f"TEXT NOT NULL DEFAULT '{CONTRACT_TYPE_TIME_MATERIALS}'",
            'fixed_fee_amount': 'FLOAT',
            'expected_hours': 'FLOAT',
            'discount': 'FLOAT',
            'project_discount': 'FLOAT DEFAULT 0.0',
            'standard_rate': 'FLOAT',
            'is_billable': 'BOOLEAN DEFAULT 1',
        }
        existing = {
            row[1]
            for row in db.session.execute(text("PRAGMA table_info(project)")).fetchall()
        }
        for column_name, column_type in required_columns.items():
            if column_name not in existing:
                db.session.execute(text(f"ALTER TABLE project ADD COLUMN {column_name} {column_type}"))
    else:
        pg_columns = {
            'contract_type': f"VARCHAR(30) NOT NULL DEFAULT '{CONTRACT_TYPE_TIME_MATERIALS}'",
            'fixed_fee_amount': 'FLOAT',
            'expected_hours': 'FLOAT',
            'discount': 'FLOAT',
            'project_discount': 'FLOAT DEFAULT 0.0',
            'standard_rate': 'FLOAT',
            'is_billable': 'BOOLEAN DEFAULT TRUE',
        }
        for column_name, column_type in pg_columns.items():
            try:
                db.session.execute(text(f"ALTER TABLE project ADD COLUMN {column_name} {column_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()

    db.session.execute(
        text(
            "UPDATE project "
            "SET contract_type = :default_ct "
            "WHERE contract_type IS NULL OR TRIM(contract_type) = ''"
        ),
        {'default_ct': CONTRACT_TYPE_TIME_MATERIALS}
    )
    db.session.commit()


def _normalize_contract_type(raw_contract_type):
    normalized = (raw_contract_type or '').strip().lower()
    if normalized in ('fixed fee', 'fixed_fee', 'fixedfee', 'fixed'):
        return CONTRACT_TYPE_FIXED_FEE
    if normalized in ('time & materials', 'time and materials', 'time_materials', 't&m', 'tm', 't and m'):
        return CONTRACT_TYPE_TIME_MATERIALS
    if normalized in ('retainer', 'retainers', 'recurring'):
        return CONTRACT_TYPE_RETAINER
    if normalized in ('admin', 'administrative'):
        return CONTRACT_TYPE_ADMIN
    if normalized in ('documentation', 'docs', 'doc'):
        return CONTRACT_TYPE_DOCUMENTATION
    return None


def _parse_fixed_fee_amount(value, required):
    if value is None or value == '':
        if required:
            raise ValueError('Fixed fee amount is required for fixed fee projects')
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ValueError('Fixed fee amount must be a valid number')
    if amount < 0:
        raise ValueError('Fixed fee amount must be non-negative')
    return amount


def parse_optional_date(value, field_name):
    if value is None or value == '':
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f'{field_name} must be in YYYY-MM-DD format')


def parse_optional_rate(value, field_name):
    if value is None or value == '':
        return None
    try:
        parsed = float(value)
    except (ValueError, TypeError):
        raise ValueError(f'{field_name} must be a valid number')
    if parsed < 0:
        raise ValueError(f'{field_name} must be non-negative')
    return parsed


_ALLOWED_PHOTO_PREFIXES = (
    'data:image/jpeg,', 'data:image/jpeg;',
    'data:image/png,', 'data:image/png;',
    'data:image/gif,', 'data:image/gif;',
    'data:image/webp,', 'data:image/webp;',
)

def parse_profile_photo(value, field_name='profile_photo'):
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise ValueError(f'{field_name} must be a string')

    photo_data = value.strip()
    if not photo_data:
        return None
    if not any(photo_data.startswith(p) for p in _ALLOWED_PHOTO_PREFIXES):
        raise ValueError(f'{field_name} must be a JPEG, PNG, GIF, or WebP image')
    if len(photo_data) > 2_000_000:
        raise ValueError(f'{field_name} is too large')
    return photo_data


def apply_employee_profile(employee, data):
    if 'designation' in data:
        designation = (data.get('designation') or '').strip()
        employee.designation = designation or None

    if 'reporting_manager' in data:
        reporting_manager = (data.get('reporting_manager') or '').strip()
        employee.reporting_manager = reporting_manager or None

    if 'start_date' in data:
        employee.start_date = parse_optional_date(data.get('start_date'), 'start_date')

    if 'current_hourly_rate' in data:
        employee.current_hourly_rate = parse_optional_rate(data.get('current_hourly_rate'), 'current_hourly_rate')

    for idx in range(1, 6):
        date_key = f'promotion_{idx}_date'
        rate_key = f'promotion_{idx}_rate'
        designation_key = f'promotion_{idx}_designation'

        if date_key in data:
            setattr(employee, date_key, parse_optional_date(data.get(date_key), date_key))
        if rate_key in data:
            setattr(employee, rate_key, parse_optional_rate(data.get(rate_key), rate_key))
        if designation_key in data:
            designation = (data.get(designation_key) or '').strip()
            setattr(employee, designation_key, designation or None)

    if 'profile_photo' in data:
        employee.profile_photo = parse_profile_photo(data.get('profile_photo'))


def get_employee_compensation_for_date(employee, work_date):
    """
    Resolve employee hourly rate and designation for a given work date.
    Priority:
    1) Latest promotion fields where promotion date <= work_date
    2) employee base designation/current_hourly_rate
    """
    effective_rate = employee.current_hourly_rate if employee.current_hourly_rate is not None else 0.0
    effective_designation = employee.designation or 'Unspecified'

    promotions = []
    for idx in range(1, 6):
        promo_date = getattr(employee, f'promotion_{idx}_date')
        promo_rate = getattr(employee, f'promotion_{idx}_rate')
        promo_designation = getattr(employee, f'promotion_{idx}_designation')
        if promo_date and (promo_rate is not None or promo_designation):
            promotions.append((promo_date, promo_rate, promo_designation))

    promotions.sort(key=lambda item: item[0])
    for promo_date, promo_rate, promo_designation in promotions:
        if promo_date <= work_date:
            if promo_rate is not None:
                effective_rate = promo_rate
            if promo_designation:
                effective_designation = promo_designation
        else:
            break

    return float(effective_rate or 0.0), effective_designation


def is_non_billable_punch(punch, project_by_id=None):
    """Return True if a punch belongs to the non-billable project."""
    if (punch.project_code or '').upper() == NON_BILLABLE_PROJECT_CODE:
        return True
    if project_by_id and punch.project_id:
        project = project_by_id.get(punch.project_id)
        if project and (project.code or '').upper() == NON_BILLABLE_PROJECT_CODE:
            return True
    return False


def _employee_lookup_keys(employee):
    keys = set()
    if employee.name:
        keys.add(employee.name.strip().lower())
    if employee.email:
        keys.add(employee.email.strip().lower())
    if employee.employee_code:
        keys.add(employee.employee_code.strip().lower())
    return keys


def build_employee_hierarchy(employee):
    employees = Employee.query.all()
    lookup = {}
    for emp in employees:
        for key in _employee_lookup_keys(emp):
            lookup[key] = emp

    # Upward chain: self -> manager -> manager...
    chain_bottom_up = [employee]
    seen_ids = {employee.id}
    current = employee

    while current.reporting_manager:
        manager_key = current.reporting_manager.strip().lower()
        manager = lookup.get(manager_key)
        if not manager or manager.id in seen_ids:
            break
        chain_bottom_up.append(manager)
        seen_ids.add(manager.id)
        current = manager

    chain_top_down = list(reversed(chain_bottom_up))

    def emp_min_dict(emp):
        return {
            'id': emp.id,
            'name': emp.name,
            'email': emp.email,
            'employee_code': emp.employee_code,
            'designation': emp.designation,
            'reporting_manager': emp.reporting_manager
        }

    # Optional context: direct reports under current user.
    current_keys = _employee_lookup_keys(employee)
    direct_reports = []
    for emp in employees:
        if emp.id == employee.id or not emp.reporting_manager:
            continue
        if emp.reporting_manager.strip().lower() in current_keys:
            direct_reports.append(emp_min_dict(emp))

    return {
        'chain': [emp_min_dict(emp) for emp in chain_top_down],
        'direct_reports': direct_reports,
        'current_employee_id': employee.id
    }

# Initialize database
with app.app_context():
    db.create_all()
    ensure_employee_schema()
    ensure_role_schema()
    ensure_password_reset_schema()
    ensure_employee_codes()
    ensure_punch_invoice_schema()
    ensure_project_rate_schema()
    ensure_project_contract_schema()
    ensure_hidden_projects_schema()
    ensure_expenses_schema()
    # Backfill legacy rows where description may be null from older schema versions.
    legacy_null_descriptions = Punch.query.filter(Punch.description.is_(None)).all()
    if legacy_null_descriptions:
        for entry in legacy_null_descriptions:
            entry.description = ''
        db.session.commit()

    # Create admin user if not exists
    admin = Employee.query.filter_by(email=ADMIN_EMAIL).first()
    if not admin:
        if not ADMIN_EMAIL or not ADMIN_PASSWORD:
            raise ValueError("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env to create the initial admin user")
        admin = Employee(
            name='Admin',
            email=ADMIN_EMAIL,
            is_admin=True,
            role='admin'
        )
        admin.set_password(ADMIN_PASSWORD)
        db.session.add(admin)
        db.session.commit()
        print(f"Admin user created: {ADMIN_EMAIL}")

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
            current_user = db.session.get(Employee, data['employee_id'])
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
@limiter.limit("10 per minute")
def login():
    data = request.json
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = (data['email'] or '').lower().strip()
    employee = Employee.query.filter_by(email=email).first()
    
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

@app.route('/api/forgot-password', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password():
    data = request.json or {}
    email = (data.get('email') or '').lower().strip()
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    employee = Employee.query.filter_by(email=email).first()
    # Always return success to avoid user enumeration
    if employee:
        token = employee.generate_password_reset_token()
        db.session.commit()
        send_password_reset_email(employee, token)

    return jsonify({'message': 'If that email exists in our system, a reset link has been sent.'}), 200


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json or {}
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password') or ''

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    pwd_error = validate_password_strength(new_password)
    if pwd_error:
        return jsonify({'error': pwd_error}), 400

    employee = Employee.query.filter_by(password_reset_token=token).first()
    if not employee:
        return jsonify({'error': 'Invalid or expired reset token'}), 400

    if employee.password_reset_expires < datetime.utcnow():
        return jsonify({'error': 'Reset token has expired. Please request a new one.'}), 400

    employee.set_password(new_password)
    employee.password_reset_token = None
    employee.password_reset_expires = None
    db.session.commit()

    return jsonify({'message': 'Password updated successfully. You can now log in.'}), 200

@app.route('/api/work/<int:work_id>/payable-values', methods=['PUT'])
@token_required
@admin_required
def update_work_payable_values(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404
    
    data = request.json or {}
    if 'payable_rate' in data:
        try:
            work_entry.payable_rate = float(data['payable_rate'])
        except ValueError:
            return jsonify({'error': 'Invalid rate format'}), 400
            
    if 'payable_designation' in data:
        work_entry.payable_designation = (data.get('payable_designation') or '').strip() or None

    work_entry.updated_by_admin = True
    work_entry.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Payable values updated successfully', 'work': work_entry.to_dict()}), 200

@app.route('/api/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    data = request.json
    
    if not data.get('old_password') or not data.get('new_password'):
        return jsonify({'error': 'Old password and new password are required'}), 400
    
    if not current_user.check_password(data['old_password']):
        return jsonify({'error': 'Old password is incorrect'}), 401

    pwd_error = validate_password_strength(data['new_password'])
    if pwd_error:
        return jsonify({'error': pwd_error}), 400

    current_user.set_password(data['new_password'])
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200


@app.route('/api/me/profile-photo', methods=['PUT'])
@token_required
def update_my_profile_photo(current_user):
    data = request.json or {}
    try:
        current_user.profile_photo = parse_profile_photo(data.get('profile_photo'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db.session.commit()
    return jsonify(current_user.to_dict()), 200

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
    data = request.json or {}
    
    if not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Name, email, and password are required'}), 400
    if not (data.get('reporting_manager') or '').strip():
        return jsonify({'error': 'Reporting manager is required'}), 400

    email = (data['email'] or '').lower().strip()
    password = data.get('password') or ''
    pwd_error = validate_password_strength(password)
    if pwd_error:
        return jsonify({'error': pwd_error}), 400
    
    existing_employee = Employee.query.filter_by(email=email).first()
    if existing_employee:
        return jsonify({'error': 'Employee with this email already exists'}), 400

    role = (data.get('role') or 'employee').strip().lower()
    if role not in ('admin', 'employee', 'both'):
        return jsonify({'error': 'Invalid role. Must be admin, employee, or both'}), 400

    employee = Employee(
        name=data['name'],
        email=email,
        is_admin=(role in ('admin', 'both')),
        role=role
    )
    employee.set_password(password)

    try:
        apply_employee_profile(employee, data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    
    db.session.add(employee)
    db.session.commit()

    # Auto-generate immutable employee code.
    if not employee.employee_code:
        employee.employee_code = generate_employee_code(employee.id)
        db.session.commit()

    # Send welcome email with password-set link
    reset_token = employee.generate_password_reset_token()
    db.session.commit()
    send_welcome_email(employee, reset_token)
    
    return jsonify(employee.to_dict()), 201

@app.route('/api/employees/<int:employee_id>/role', methods=['PUT'])
@token_required
@admin_required
def update_employee_role(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404

    data = request.json or {}
    role = (data.get('role') or '').strip().lower()
    if role not in ('admin', 'employee', 'both'):
        return jsonify({'error': 'Invalid role. Must be admin, employee, or both'}), 400

    if employee.id == current_user.id:
        return jsonify({'error': 'You cannot change your own role'}), 400

    employee.role = role
    employee.is_admin = (role in ('admin', 'both'))
    db.session.commit()
    return jsonify(employee.to_dict()), 200


@app.route('/api/employees/<int:employee_id>/profile', methods=['PUT'])
@token_required
@admin_required
def update_employee_profile(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404

    data = request.json or {}
    try:
        apply_employee_profile(employee, data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    db.session.commit()
    return jsonify(employee.to_dict()), 200

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_employee(current_user, employee_id):
    employee = Employee.query.get(employee_id)

    if not employee:
        return jsonify({'error': 'Employee not found'}), 404

    if SUPER_ADMIN_EMAIL and employee.email.lower() == SUPER_ADMIN_EMAIL:
        return jsonify({'error': 'The super admin account cannot be deleted'}), 403

    # Delete related work entries first to avoid foreign key constraint issues.
    Punch.query.filter_by(employee_id=employee_id).delete(synchronize_session=False)
    db.session.delete(employee)
    db.session.commit()

    return jsonify({'message': 'Employee deleted successfully'}), 200

@app.route('/api/add-work', methods=['POST'])
@token_required
def add_work(current_user):
    data = request.json or {}
    
    # Support both project_name (legacy) and project_code (new)
    project_code = (data.get('project_code') or '').strip()
    project_name = (data.get('project_name') or '').strip()
    description = (data.get('description') or '').strip()
    
    # Determine how to get project info
    project_id = None
    if project_code:
        # Look up project by code
        project = Project.query.filter_by(code=project_code.upper()).first()
        if not project:
            return jsonify({'error': f'Project with code {project_code} not found'}), 400
        project_name = project.name
        project_id = project.id
    elif not project_name:
        return jsonify({'error': 'Either project_name or project_code is required'}), 400
    
    # Validate required fields
    if not data.get('hours_worked') or not data.get('work_date') or not description:
        return jsonify({'error': 'Description, hours worked, and work date are required'}), 400
    
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

    utc_today = datetime.utcnow().date()
    today = utc_today
    client_today_raw = (data.get('client_today') or '').strip()
    if client_today_raw:
        try:
            client_today = datetime.strptime(client_today_raw, '%Y-%m-%d').date()
            # Accept client-reported local date when it is within a safe drift window.
            # This avoids timezone edge rejections (e.g., Asia timezones ahead of UTC).
            if abs((client_today - utc_today).days) <= 1:
                today = max(utc_today, client_today)
        except ValueError:
            return jsonify({'error': 'client_today must be in YYYY-MM-DD format'}), 400

    oldest_allowed = today - timedelta(days=14)
    if work_date < oldest_allowed or work_date > today:
        return jsonify({'error': 'Work date must be within the last 14 days (including today)'}), 400
    
    # Employee can only add work for themselves
    work_entry = Punch(
        employee_id=current_user.id,
        project_name=project_name,
        project_code=project_code if project_code else None,
        project_id=project_id,
        work_date=work_date,
        hours_worked=hours_worked,
        description=description,
        updated_by_admin=False
    )
    
    # Auto-populate payable values based on date-aware compensation rules.
    # Non-billable (BKP-003) entries always start at rate=0; admin sets the rate later.
    if (project_code or '').upper() == NON_BILLABLE_PROJECT_CODE:
        work_entry.payable_rate = 0.0
        work_entry.payable_designation = 'Non-Billable'
    else:
        resolved_rate, resolved_designation = get_employee_compensation_for_date(current_user, work_date)
        work_entry.payable_rate = resolved_rate
        work_entry.payable_designation = resolved_designation
    
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
def edit_work(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404
    
    # Check permissions: Admin can edit anything, Employee can only edit their own
    if not current_user.is_admin and work_entry.employee_id != current_user.id:
        return jsonify({'error': 'Permission denied'}), 403
    
    # Check 14-day restriction for non-admins
    if not current_user.is_admin:
        utc_today = datetime.utcnow().date()
        today = utc_today
        # Allow client-reported today to handle timezone drift (same logic as add_work)
        # Note: We don't have client_today in PUT request usually, so we rely on UTC+1 drift
        oldest_allowed = today - timedelta(days=14)
        if work_entry.work_date < oldest_allowed:
            return jsonify({'error': 'Cannot edit entries older than 14 days'}), 400
        if work_entry.work_date > today + timedelta(days=1): # Allow 1 day future for TZ drift
             return jsonify({'error': 'Cannot edit future entries'}), 400

    data = request.json
    
    # Handle project_code first (takes priority over project_name)
    if 'project_code' in data:
        project_code = (data.get('project_code') or '').strip()
        if project_code:
            project = Project.query.filter_by(code=project_code.upper()).first()
            if not project:
                return jsonify({'error': f'Project with code {project_code} not found'}), 400
            work_entry.project_code = project_code.upper()
            work_entry.project_name = project.name
            work_entry.project_id = project.id
    
    # Update project_name if provided (and no project_code)
    if 'project_name' in data and 'project_code' not in data:
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
            new_date = datetime.strptime(data['work_date'], '%Y-%m-%d').date()
            if new_date != work_entry.work_date:
                # If changing date, check the new date too
                if not current_user.is_admin:
                    utc_today = datetime.utcnow().date()
                    oldest_allowed = utc_today - timedelta(days=14)
                    if new_date < oldest_allowed or new_date > utc_today + timedelta(days=1):
                        return jsonify({'error': 'Target work date must be within the last 14 days'}), 400
                
                work_entry.work_date = new_date
                # Re-calculate default payable values for new date.
                # Non-billable entries keep rate=0; admin sets it via the payables UI.
                if (work_entry.project_code or '').upper() == NON_BILLABLE_PROJECT_CODE:
                    work_entry.payable_rate = 0.0
                    work_entry.payable_designation = 'Non-Billable'
                else:
                    employee = Employee.query.get(work_entry.employee_id)
                    if employee:
                        res_rate, res_des = get_employee_compensation_for_date(employee, new_date)
                        work_entry.payable_rate = res_rate
                        work_entry.payable_designation = res_des
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    if 'description' in data:
        description = (data.get('description') or '').strip()
        # Allow empty description if hours are 0? Better to keep it consistent.
        # if not description and work_entry.hours_worked > 0:
        #    return jsonify({'error': 'Description is required'}), 400
        work_entry.description = description
    
    if current_user.is_admin:
        work_entry.updated_by_admin = True
    else:
        work_entry.updated_by_admin = False
    
    work_entry.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(work_entry.to_dict()), 200

@app.route('/api/work/<int:work_id>', methods=['DELETE'])
@token_required
def delete_work(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404
    
    # Check permissions: Admin can delete anything, Employee can only delete their own
    if not current_user.is_admin and work_entry.employee_id != current_user.id:
        return jsonify({'error': 'Permission denied'}), 403
    
    # Check 14-day restriction for non-admins
    if not current_user.is_admin:
        utc_today = datetime.utcnow().date()
        oldest_allowed = utc_today - timedelta(days=14)
        if work_entry.work_date < oldest_allowed:
            return jsonify({'error': 'Cannot delete entries older than 14 days'}), 400
        if work_entry.work_date > utc_today + timedelta(days=1):
            return jsonify({'error': 'Cannot delete future entries'}), 400

    db.session.delete(work_entry)
    db.session.commit()
    
    return jsonify({'message': 'Work entry deleted successfully'}), 200


@app.route('/api/work/<int:work_id>/invoice-values', methods=['PUT'])
@token_required
@admin_required
def update_work_invoice_values(current_user, work_id):
    work_entry = Punch.query.get(work_id)
    if not work_entry:
        return jsonify({'error': 'Work entry not found'}), 404

    data = request.json or {}

    if 'hours' in data:
        hours = data.get('hours')
        if hours is None or hours == '':
            work_entry.invoice_hours = None
        else:
            try:
                parsed_hours = float(hours)
            except (ValueError, TypeError):
                return jsonify({'error': 'hours must be a valid number'}), 400
            if parsed_hours <= 0:
                return jsonify({'error': 'hours must be greater than 0'}), 400
            work_entry.invoice_hours = parsed_hours

    if 'gross_rate' in data:
        gross_rate = data.get('gross_rate')
        if gross_rate is None or gross_rate == '':
            work_entry.invoice_gross_rate = None
        else:
            try:
                parsed_gross_rate = float(gross_rate)
            except (ValueError, TypeError):
                return jsonify({'error': 'gross_rate must be a valid number'}), 400
            if parsed_gross_rate < 0:
                return jsonify({'error': 'gross_rate must be non-negative'}), 400
            work_entry.invoice_gross_rate = parsed_gross_rate

    if 'discount' in data:
        discount = data.get('discount')
        if discount is None or discount == '':
            work_entry.invoice_discount = None
        else:
            try:
                parsed_discount = float(discount)
            except (ValueError, TypeError):
                return jsonify({'error': 'discount must be a valid number'}), 400
            if parsed_discount < 0 or parsed_discount > 100:
                return jsonify({'error': 'discount must be between 0 and 100'}), 400
            work_entry.invoice_discount = parsed_discount

    db.session.commit()
    return jsonify(work_entry.to_dict()), 200

@app.route('/api/my-status', methods=['GET'])
@token_required
def get_my_status(current_user):
    target_date_str = request.args.get('date')
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        target_date = datetime.now().date()

    today_entries = Punch.query.filter_by(
        employee_id=current_user.id,
        work_date=target_date
    ).all()
    
    today_hours = sum(entry.hours_worked for entry in today_entries)
    
    return jsonify({
        'employee': current_user.to_dict(),
        'date': target_date.isoformat(),
        'today_entries': [entry.to_dict() for entry in today_entries],
        'today_hours': round(today_hours, 2)
    })


@app.route('/api/my-hierarchy', methods=['GET'])
@token_required
def get_my_hierarchy(current_user):
    hierarchy = build_employee_hierarchy(current_user)
    return jsonify(hierarchy)

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
    # Single aggregation pass — avoids N+1 query (one query instead of one per employee)
    all_punches = Punch.query.all()
    hours_by_emp = defaultdict(float)
    entries_by_emp = defaultdict(int)
    dates_by_emp = defaultdict(set)
    for punch in all_punches:
        hours_by_emp[punch.employee_id] += punch.hours_worked
        entries_by_emp[punch.employee_id] += 1
        dates_by_emp[punch.employee_id].add(punch.work_date)

    report = [
        {
            'employee': emp.to_dict(),
            'total_hours': round(hours_by_emp[emp.id], 2),
            'total_days': len(dates_by_emp[emp.id]),
            'total_entries': entries_by_emp[emp.id]
        }
        for emp in employees
    ]
    return jsonify(report)


def _build_client_invoice_data(client, start_date, end_date):
    """Build the client invoice data dict shared by JSON and PDF endpoints."""
    projects = Project.query.filter_by(client_id=client.id).all()
    project_by_id = {project.id: project for project in projects}
    project_by_code = {project.code.upper(): project for project in projects if project.code}
    project_by_name = {project.name: project for project in projects if project.name}
    project_ids = list(project_by_id.keys())

    if not project_ids:
        return {
            'client': client.to_dict(),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'rows': [],
            'project_totals': [],
            'total_hours': 0.0,
            'total_net_billable': 0.0,
            'total_invoice_amount': 0.0,
            'fixed_fee_projects': [],
            'tm_projects': [],
            'fixed_fee_warnings': []
        }

    base_query = Punch.query.filter(
        Punch.work_date >= start_date,
        Punch.work_date <= end_date
    )
    punches = base_query.filter(Punch.project_id.in_(project_ids)).all()
    legacy_punches = base_query.filter(Punch.project_id.is_(None)).all()
    for punch in legacy_punches:
        if punch.project_code and punch.project_code in project_by_code:
            punches.append(punch)
        elif punch.project_name and punch.project_name in project_by_name:
            punches.append(punch)

    employee_ids = list({p.employee_id for p in punches})
    employees = Employee.query.filter(Employee.id.in_(employee_ids)).all() if employee_ids else []
    employee_by_id = {emp.id: emp for emp in employees}

    def _norm(v):
        return (v or '').strip().lower()

    rates = ProjectRate.query.filter(ProjectRate.project_id.in_(project_ids)).all()
    rate_by_ped, rate_by_pe, rate_by_pd = {}, {}, {}
    employee_scoped_projects = set()
    first_rate_by_project = {}
    for rate in rates:
        dk = _norm(rate.designation)
        ek = _norm(rate.employee_name)
        if ek and dk:
            rate_by_ped[(rate.project_id, ek, dk)] = rate
        if ek and (rate.project_id, ek) not in rate_by_pe:
            rate_by_pe[(rate.project_id, ek)] = rate
            employee_scoped_projects.add(rate.project_id)
        if dk and (rate.project_id, dk) not in rate_by_pd:
            rate_by_pd[(rate.project_id, dk)] = rate
        if rate.project_id not in first_rate_by_project:
            first_rate_by_project[rate.project_id] = rate

    rows, project_totals_map = [], {}
    total_hours = total_net_billable = 0.0

    for punch in punches:
        project = (
            project_by_id.get(punch.project_id)
            or (project_by_code.get((punch.project_code or '').upper()))
            or (project_by_name.get(punch.project_name))
        )
        if not project:
            print(f"Skipping punch {punch.id} - project not found")
            continue

        # Skip non-billable documentation
        if project.contract_type == CONTRACT_TYPE_DOCUMENTATION and not project.is_billable:
            continue

        employee = employee_by_id.get(punch.employee_id)
        base_rate, designation = get_employee_compensation_for_date(employee, punch.work_date) if employee else (0.0, 'Unspecified')
        ek = _norm(employee.name) if employee else ''
        dk = _norm(designation)

        sel = (
            rate_by_ped.get((project.id, ek, dk))
            or rate_by_pe.get((project.id, ek))
            or rate_by_pd.get((project.id, dk))
            or first_rate_by_project.get(project.id)
        )
        
        if not sel:
            gross_rate = base_rate
        else:
            gross_rate = float(sel.gross_rate) if sel.gross_rate is not None else 0.0
            
        # Use simple project-level discount instead of complex role-based overrides
        project_discount = float(project.project_discount or 0.0)
        hours = float(punch.hours_worked) if punch.hours_worked is not None else 0.0
        net_rate = round(gross_rate * (1 - project_discount / 100.0), 2)
        net_billable = round(net_rate * hours, 2)
        total_hours += hours
        total_net_billable += net_billable

        pt = project_totals_map.setdefault(project.id, {
            'project_id': project.id, 'project_code': project.code,
            'project_name': project.name,
            'contract_type': project.contract_type or CONTRACT_TYPE_TIME_MATERIALS,
            'fixed_fee_amount': float(project.fixed_fee_amount) if project.fixed_fee_amount is not None else None,
            'total_hours': 0.0,
            'total_net_billable': 0.0
        })
        pt['total_hours'] += hours
        pt['total_net_billable'] += net_billable

        rows.append({
            'work_id': punch.id,
            'work_date': punch.work_date.isoformat(),
            'project_code': project.code,
            'project_name': project.name,
            'employee_name': employee.name if employee else 'Unknown',
            'employee_designation': designation,
            'gross_rate': gross_rate,
            'discount': project_discount,
            'net_rate': net_rate,
            'hours': round(hours, 2),
            'net_billable': net_billable,
            'task_performed': punch.description or '',
            'is_invoice_override': False
        })

    rows.sort(key=lambda r: (r['work_date'] or '', r['project_code'] or '', r['employee_name'] or ''))
    project_totals = sorted(project_totals_map.values(), key=lambda t: t['project_code'] or '')
    fixed_fee_projects = []
    tm_projects = []
    fixed_fee_warnings = []
    total_invoice_amount = 0.0

    for t in project_totals:
        t['total_hours'] = round(t['total_hours'], 2)
        t['total_net_billable'] = round(t['total_net_billable'], 2)
        contract_type = t.get('contract_type') or CONTRACT_TYPE_TIME_MATERIALS
        t['contract_type'] = contract_type

        if contract_type == CONTRACT_TYPE_FIXED_FEE:
            fixed_fee_amount = float(t.get('fixed_fee_amount') or 0.0)
            actual_amount = float(t.get('total_net_billable') or 0.0)
            variance = round(actual_amount - fixed_fee_amount, 2)
            variance_type = 'none'
            if variance > 0:
                variance_type = 'overage'
            elif variance < 0:
                variance_type = 'credit'

            utilization_ratio = (actual_amount / fixed_fee_amount) if fixed_fee_amount > 0 else None
            status = 'ok'
            if utilization_ratio is not None and utilization_ratio > 1:
                status = 'overage'
            elif utilization_ratio is not None and utilization_ratio >= FIXED_FEE_WARNING_THRESHOLD:
                status = 'near_limit'

            fixed_data = {
                'project_id': t['project_id'],
                'project_code': t['project_code'],
                'project_name': t['project_name'],
                'actual_hours_amount': round(actual_amount, 2),
                'fixed_fee_amount': round(fixed_fee_amount, 2),
                'variance_amount': abs(variance),
                'variance_type': variance_type,
                'utilization_ratio': round(utilization_ratio, 4) if utilization_ratio is not None else None,
                'status': status,
            }
            fixed_fee_projects.append(fixed_data)

            if status in ('near_limit', 'overage'):
                fixed_fee_warnings.append(fixed_data)

            total_invoice_amount += fixed_fee_amount
        else:
            tm_projects.append({
                'project_id': t['project_id'],
                'project_code': t['project_code'],
                'project_name': t['project_name'],
                'total_hours': t['total_hours'],
                'total_amount': t['total_net_billable'],
            })
            total_invoice_amount += float(t['total_net_billable'] or 0.0)

    _send_fixed_fee_variance_alerts(client, fixed_fee_warnings)

    # ── EXPENSES ────────────────────────────────────────────────────────
    # Expenses are always billable — no discount, not tied to hourly rates.
    expenses = Expense.query.filter(
        Expense.project_id.in_(project_ids),
        Expense.date >= start_date,
        Expense.date <= end_date
    ).all() if project_ids else []

    total_expenses_amount = 0.0
    expense_rows = []
    for expense in expenses:
        total_expenses_amount += float(expense.amount)
        project = project_by_id.get(expense.project_id)
        expense_rows.append({
            'project_code': project.code if project else '',
            'project_name': project.name if project else '',
            'expense_type': expense.expense_type,
            'amount': round(float(expense.amount), 2),
            'date': expense.date.isoformat()
        })
    total_invoice_amount += total_expenses_amount

    return {
        'client': client.to_dict(),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'rows': rows,
        'project_totals': project_totals,
        'total_hours': round(total_hours, 2),
        'total_net_billable': round(total_net_billable, 2),
        'total_invoice_amount': round(total_invoice_amount, 2),
        'fixed_fee_projects': fixed_fee_projects,
        'tm_projects': tm_projects,
        'fixed_fee_warnings': fixed_fee_warnings,
        'expense_rows': expense_rows,
        'total_expenses_amount': round(total_expenses_amount, 2),
    }


def _send_fixed_fee_variance_alerts(client, fixed_fee_warnings):
    recipients = [
        (employee.email or '').strip().lower()
        for employee in Employee.query.filter(Employee.role.in_(['admin', 'both'])).all()
        if employee.email
    ]
    recipients = sorted(set([r for r in recipients if r]))
    if not recipients or not fixed_fee_warnings:
        return

    today = date.today()
    alerts_to_send = []
    for warning in fixed_fee_warnings:
        alert_type = 'overage' if warning.get('status') == 'overage' else 'near_limit'
        if alert_type == 'overage':
            existing = FixedFeeAlertLog.query.filter_by(
                project_id=warning['project_id'],
                alert_date=today,
                alert_type=alert_type,
            ).first()
            if existing:
                continue
        else:
            existing = FixedFeeAlertLog.query.filter_by(
                project_id=warning['project_id'],
                alert_type=alert_type,
            ).first()
            if existing:
                continue
        alerts_to_send.append((warning, alert_type))

    if not alerts_to_send:
        return

    lines = []
    for warning, _alert_type in alerts_to_send:
        utilization = warning.get('utilization_ratio')
        utilization_pct = f"{utilization * 100:.1f}%" if utilization is not None else 'n/a'
        lines.append(
            f"- {warning['project_code']} ({warning['project_name']}): "
            f"actual CAD$ {warning['actual_hours_amount']:,.2f}, "
            f"fixed CAD$ {warning['fixed_fee_amount']:,.2f}, "
            f"utilization {utilization_pct}, status {warning['status']}"
        )

    msg = Message(
        subject=f"[Time Tracking] Fixed Fee Variance Alert - {client.code}",
        recipients=recipients,
        body=(
            f"Client: {client.name} ({client.code})\n"
            f"Date: {today.isoformat()}\n\n"
            "Fixed fee project variance warnings:\n"
            + "\n".join(lines)
            + "\n\nThis is an automated internal alert."
        ),
    )

    try:
        mail.send(msg)
    except Exception:
        return

    for warning, alert_type in alerts_to_send:
        db.session.add(FixedFeeAlertLog(
            project_id=warning['project_id'],
            alert_date=today,
            alert_type=alert_type,
        ))
    db.session.commit()


def _generate_invoice_pdf(data, project_filter=None):
    """Generate a polished client billing report PDF. Returns a BytesIO buffer."""
    buf = io.BytesIO()
    PAGE_W_RAW, _ = A4
    MARGIN = 1.8 * cm
    PAGE_W = PAGE_W_RAW - 2 * MARGIN

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=2 * cm
    )

    C_NAVY   = rl_colors.HexColor('#1a2c5b')
    C_SKY    = rl_colors.HexColor('#0ea5e9')
    C_LIGHT  = rl_colors.HexColor('#f1f5f9')
    C_BORDER = rl_colors.HexColor('#e2e8f0')
    C_WHITE  = rl_colors.white
    C_TEXT   = rl_colors.HexColor('#1e293b')
    C_MUTED  = rl_colors.HexColor('#64748b')

    def ps(size=9, color=None, bold=False, align=TA_LEFT, leading=None):
        return ParagraphStyle('x',
            fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=size, textColor=color or C_TEXT,
            alignment=align, leading=leading or size * 1.3)

    client        = data['client']
    start_date_s  = data['start_date']
    end_date_s    = data['end_date']
    rows          = [r for r in data['rows']
                     if not project_filter or project_filter == 'ALL'
                     or r['project_code'] == project_filter]
    project_totals     = [
        pt for pt in data['project_totals']
        if not project_filter or project_filter == 'ALL' or pt['project_code'] == project_filter
    ]
    total_hours        = data['total_hours']
    total_net_billable = data['total_net_billable']
    total_invoice_amount = data.get('total_invoice_amount', total_net_billable)

    def fmt(d):
        try:
            return datetime.strptime(d, '%Y-%m-%d').strftime('%b %d, %Y')
        except Exception:
            return d

    invoice_no   = f"INV-{client['code']}-{datetime.now().strftime('%Y%m%d%H%M')}"
    issued_date  = datetime.now().strftime('%B %d, %Y')
    elements     = []

    # ── HEADER ─────────────────────────────────────────────────────────
    hdr = Table([[
        Paragraph('BKP CYGNUS CONSULTING INC.', ps(16, C_WHITE, bold=True)),
        Paragraph('BILLING REPORT', ps(20, C_WHITE, bold=True, align=TA_RIGHT)),
    ]], colWidths=[PAGE_W * 0.6, PAGE_W * 0.4])
    hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_NAVY),
        ('TOPPADDING',    (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('LEFTPADDING',   (0, 0), (0, -1),  16),
        ('RIGHTPADDING',  (-1, 0), (-1, -1), 16),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(hdr)
    elements.append(Spacer(1, 0.5 * cm))

    # ── META ───────────────────────────────────────────────────────────
    meta = Table([
        [ps(7, C_MUTED, bold=True), ps(7, C_MUTED, bold=True),
         ps(7, C_MUTED, bold=True), ps(7, C_MUTED, bold=True)],
        [Paragraph(client['name'],             ps(10, C_NAVY, bold=True)),
         Paragraph(f"{fmt(start_date_s)} – {fmt(end_date_s)}", ps(10, C_NAVY, bold=True)),
         Paragraph(invoice_no,                 ps(9,  C_NAVY, bold=True)),
         Paragraph(issued_date,                ps(9,  C_NAVY, bold=True))],
    ], colWidths=[PAGE_W * 0.28, PAGE_W * 0.32, PAGE_W * 0.24, PAGE_W * 0.16])
    # replace label row with proper Paragraphs
    meta._cellvalues[0] = [
        Paragraph('CLIENT',         ps(7, C_MUTED, bold=True)),
        Paragraph('BILLING PERIOD', ps(7, C_MUTED, bold=True)),
        Paragraph('INVOICE #',      ps(7, C_MUTED, bold=True)),
        Paragraph('ISSUED',         ps(7, C_MUTED, bold=True)),
    ]
    meta.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 0.75, C_BORDER),
        ('LINEAFTER',     (0, 0), (-2, -1), 0.5,  C_BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(meta)
    elements.append(Spacer(1, 0.5 * cm))

    # ── PROJECT SUMMARY ────────────────────────────────────────────────
    elements.append(Paragraph('PROJECT SUMMARY', ps(7, C_MUTED, bold=True)))
    elements.append(Spacer(1, 0.2 * cm))
    sum_cols = [PAGE_W * 0.18, PAGE_W * 0.44, PAGE_W * 0.18, PAGE_W * 0.20]
    sum_data = [[Paragraph(h, ps(8, C_WHITE, bold=True))
                 for h in ['Project Code', 'Project Name', 'Contract', 'Amount (CAD$)']]]
    sum_style = [
        ('BACKGROUND', (0, 0), (-1, 0), C_SKY),
        ('BOX',  (0, 0), (-1, -1), 0.75, C_BORDER),
        ('GRID', (0, 0), (-1, -1), 0.4,  C_BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('ALIGN',  (3, 0), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for i, t in enumerate(project_totals):
        bg = C_WHITE if i % 2 == 0 else C_LIGHT
        sum_style.append(('BACKGROUND', (0, i + 1), (-1, i + 1), bg))
        sum_data.append([
            Paragraph(t['project_code'],               ps(8.5, C_NAVY, bold=True)),
            Paragraph(t['project_name'],               ps(8.5)),
            Paragraph(
                'Fixed fee' if t.get('contract_type') == CONTRACT_TYPE_FIXED_FEE
                else 'Documentation' if t.get('contract_type') == CONTRACT_TYPE_DOCUMENTATION
                else 'Time & Materials', ps(8.5)
            ),
            Paragraph(
                f"{((t.get('fixed_fee_amount') or 0.0) if t.get('contract_type') == CONTRACT_TYPE_FIXED_FEE else t['total_net_billable']):,.2f}",
                ps(8.5, bold=True, align=TA_RIGHT)
            ),
        ])
    sum_table = Table(sum_data, colWidths=sum_cols)
    sum_table.setStyle(TableStyle(sum_style))
    elements.append(sum_table)
    elements.append(Spacer(1, 0.5 * cm))

    # ── DETAILED BILLING ───────────────────────────────────────────────
    tm_rows = [
        row for row in rows
        if any(
            pt['project_code'] == row['project_code']
            and pt.get('contract_type') != CONTRACT_TYPE_FIXED_FEE
            for pt in project_totals
        )
    ]
    fixed_fee_projects = [pt for pt in project_totals if pt.get('contract_type') == CONTRACT_TYPE_FIXED_FEE]

    if tm_rows:
        elements.append(Paragraph('DETAILED BILLING', ps(7, C_MUTED, bold=True)))
        elements.append(Spacer(1, 0.2 * cm))
        d_cols = [PAGE_W * 0.12, PAGE_W * 0.12, PAGE_W * 0.20, PAGE_W * 0.18, PAGE_W * 0.12, PAGE_W * 0.13, PAGE_W * 0.13]
        d_hdrs = ['Date', 'Project', 'Employee', 'Description', 'Hours', 'Rate', 'Amount']
        d_data = [[Paragraph(h, ps(7, C_WHITE, bold=True)) for h in d_hdrs]]
        d_style = [
            ('BACKGROUND', (0, 0), (-1, 0), C_NAVY),
            ('BOX',  (0, 0), (-1, -1), 0.75, C_BORDER),
            ('GRID', (0, 0), (-1, -1), 0.3,  C_BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 5),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        for i, row in enumerate(tm_rows):
            bg = C_WHITE if i % 2 == 0 else C_LIGHT
            d_style.append(('BACKGROUND', (0, i + 1), (-1, i + 1), bg))
            d_data.append([
                Paragraph(row['work_date'],              ps(7.5)),
                Paragraph(row['project_code'],           ps(7.5, C_NAVY, bold=True)),
                Paragraph(row['employee_name'],          ps(7.5)),
                Paragraph((row.get('task_performed') or '-')[:90],   ps(7.5, C_MUTED)),
                Paragraph(f"{row['hours']:.2f}",         ps(7.5, align=TA_RIGHT)),
                Paragraph(f"{row['net_rate']:,.2f}",     ps(7.5, align=TA_RIGHT)),
                Paragraph(f"{row['net_billable']:,.2f}", ps(7.5, C_NAVY, bold=True, align=TA_RIGHT)),
            ])
        d_table = Table(d_data, colWidths=d_cols, repeatRows=1)
        d_table.setStyle(TableStyle(d_style))
        elements.append(d_table)
        elements.append(Spacer(1, 0.5 * cm))

    if fixed_fee_projects:
        elements.append(Paragraph('FIXED FEE RECONCILIATION', ps(7, C_MUTED, bold=True)))
        elements.append(Spacer(1, 0.2 * cm))
        ff_cols = [PAGE_W * 0.16, PAGE_W * 0.26, PAGE_W * 0.32, PAGE_W * 0.26]
        ff_data = [[Paragraph(h, ps(7.5, C_WHITE, bold=True)) for h in ['Project', 'Project Name', 'Line Item', 'Amount (CAD$)']]]
        ff_style = [
            ('BACKGROUND', (0, 0), (-1, 0), C_NAVY),
            ('BOX', (0, 0), (-1, -1), 0.75, C_BORDER),
            ('GRID', (0, 0), (-1, -1), 0.3, C_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ]
        row_idx = 1
        for project_total in fixed_fee_projects:
            actual_amount = float(project_total.get('total_net_billable') or 0.0)
            fixed_amount = float(project_total.get('fixed_fee_amount') or 0.0)
            variance = round(actual_amount - fixed_amount, 2)
            variance_label = 'Overage' if variance > 0 else ('Credit' if variance < 0 else 'Difference')
            variance_amount = abs(variance)

            lines = [
                ('Actual billable hours value (Actual_hours_amount x Rate by consultant)', actual_amount),
                ('Fixed fee amount', fixed_amount),
                (variance_label, variance_amount),
            ]
            for line_label, line_amount in lines:
                ff_data.append([
                    Paragraph(project_total['project_code'], ps(7.2, C_NAVY, bold=True)),
                    Paragraph(project_total['project_name'], ps(7.2)),
                    Paragraph(line_label, ps(7.2)),
                    Paragraph(f"{line_amount:,.2f}", ps(7.2, bold=True, align=TA_RIGHT)),
                ])
                bg = C_WHITE if row_idx % 2 == 1 else C_LIGHT
                ff_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), bg))
                row_idx += 1

        ff_table = Table(ff_data, colWidths=ff_cols, repeatRows=1)
        ff_table.setStyle(TableStyle(ff_style))
        elements.append(ff_table)
        elements.append(Spacer(1, 0.15 * cm))
        elements.append(Paragraph(
            'For information only; client is charged fixed fee.',
            ps(7.5, C_MUTED)
        ))
        elements.append(Spacer(1, 0.5 * cm))

    # ── EXPENSES SECTION ────────────────────────────────────────────────
    expense_rows_pdf = data.get('expense_rows', [])
    total_expenses_amount_pdf = data.get('total_expenses_amount', 0.0)

    if expense_rows_pdf:
        C_GREEN_HDR = rl_colors.HexColor('#059669')   # emerald-600
        C_GREEN_BG  = rl_colors.HexColor('#ecfdf5')   # emerald-50
        C_GREEN_TXT = rl_colors.HexColor('#065f46')   # emerald-900

        elements.append(Paragraph('Expenses', ps(12, C_GREEN_HDR, bold=True)))
        elements.append(Spacer(1, 0.25 * cm))
        elements.append(Paragraph(
            'Always billable. No discount or hourly rate applies.',
            ps(7.5, C_MUTED)
        ))
        elements.append(Spacer(1, 0.2 * cm))

        ex_data = [[
            Paragraph('Project Code', ps(8, C_WHITE, bold=True)),
            Paragraph('Project Name', ps(8, C_WHITE, bold=True)),
            Paragraph('Expense Type', ps(8, C_WHITE, bold=True)),
            Paragraph('Date', ps(8, C_WHITE, bold=True, align=TA_CENTER)),
            Paragraph('Amount (CAD$)', ps(8, C_WHITE, bold=True, align=TA_RIGHT)),
        ]]
        for r in expense_rows_pdf:
            ex_data.append([
                Paragraph(r.get('project_code', ''), ps(8, C_TEXT)),
                Paragraph(r.get('project_name', ''), ps(8, C_TEXT)),
                Paragraph(r.get('expense_type', ''), ps(8, C_TEXT)),
                Paragraph(r.get('date', ''), ps(8, C_TEXT, align=TA_CENTER)),
                Paragraph(f"{r.get('amount', 0):,.2f}", ps(8, C_TEXT, align=TA_RIGHT)),
            ])
        ex_data.append([
            Paragraph(''), Paragraph(''), Paragraph(''),
            Paragraph('Total Expenses', ps(8, C_GREEN_TXT, bold=True, align=TA_RIGHT)),
            Paragraph(f'{total_expenses_amount_pdf:,.2f}', ps(9, C_GREEN_TXT, bold=True, align=TA_RIGHT)),
        ])

        cw_ex = [PAGE_W * 0.15, PAGE_W * 0.32, PAGE_W * 0.18, PAGE_W * 0.15, PAGE_W * 0.20]
        ex_t = Table(ex_data, colWidths=cw_ex, repeatRows=1)
        ex_style = [
            ('BACKGROUND', (0, 0), (-1, 0), C_GREEN_HDR),
            ('TEXTCOLOR',  (0, 0), (-1, 0), C_WHITE),
            ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0, 0), (-1, 0), 8),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 4),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LINEBELOW', (0, 0), (-1, -2), 0.4, C_BORDER),
            ('BACKGROUND', (0, -1), (-1, -1), C_GREEN_BG),
            ('FONTNAME',   (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]
        for i in range(1, len(ex_data) - 1):
            if i % 2 == 0:
                ex_style.append(('BACKGROUND', (0, i), (-1, i), C_LIGHT))
        ex_t.setStyle(TableStyle(ex_style))
        elements.append(ex_t)
        elements.append(Spacer(1, 0.5 * cm))

    # ── TOTAL BAND ─────────────────────────────────────────────────────
    tot = Table([[
        Paragraph(f'TOTAL HOURS: {total_hours:.2f}',
                  ps(10, C_WHITE, bold=True, align=TA_RIGHT)),
        Paragraph(f'TOTAL INVOICE:  CAD$ {total_invoice_amount:,.2f}',
                  ps(14, C_WHITE, bold=True, align=TA_RIGHT)),
    ]], colWidths=[PAGE_W * 0.40, PAGE_W * 0.60])
    tot.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_NAVY),
        ('TOPPADDING',    (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING',   (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 14),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(tot)
    elements.append(Spacer(1, 0.4 * cm))

    # ── FOOTER ─────────────────────────────────────────────────────────
    elements.append(Paragraph(
        f'Confidential — Prepared by BKP Cygnus Consulting Inc. on {issued_date}. '
        f'This document is intended solely for the named client.',
        ps(7.5, C_MUTED, align=TA_CENTER)
    ))

    doc.build(elements)
    buf.seek(0)
    return buf


@app.route('/api/invoices/client', methods=['GET'])
@token_required
@admin_required
def get_client_invoice_report(current_user):
    client_id = request.args.get('client_id', type=int)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    if not client_id:
        return jsonify({'error': 'client_id is required'}), 400
    if not start_date_str or not end_date_str:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'end_date cannot be before start_date'}), 400

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    return jsonify(_build_client_invoice_data(client, start_date, end_date))


@app.route('/api/invoices/client/pdf', methods=['GET'])
@token_required
@admin_required
def get_client_invoice_pdf(current_user):
    client_id = request.args.get('client_id', type=int)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    project_filter = request.args.get('project_filter')

    if not client_id:
        return jsonify({'error': 'client_id is required'}), 400
    if not start_date_str or not end_date_str:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'end_date cannot be before start_date'}), 400

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    data = _build_client_invoice_data(client, start_date, end_date)
    pdf_buf = _generate_invoice_pdf(data, project_filter=project_filter)
    filename = f"invoice_{client.code}_{start_date_str}_to_{end_date_str}.pdf"
    return send_file(
        pdf_buf,
        as_attachment=True,
        download_name=filename,
        mimetype='application/pdf'
    )


@app.route('/api/fixed-fee/alerts/daily', methods=['POST'])
@token_required
@admin_required
def run_fixed_fee_alerts(current_user):
    """Run fixed-fee warning checks for all clients for the current month.
    Intended to be called by a daily scheduler.
    """
    today = date.today()
    month_start = date(today.year, today.month, 1)
    clients = Client.query.all()
    checked_clients = 0

    for client in clients:
        _build_client_invoice_data(client, month_start, today)
        checked_clients += 1

    return jsonify({
        'message': 'Fixed-fee alert check completed',
        'checked_clients': checked_clients,
        'from_date': month_start.isoformat(),
        'to_date': today.isoformat(),
    })



@app.route('/api/payables/set-nonbillable-rate', methods=['POST'])
@token_required
@admin_required
def set_nonbillable_rate(current_user):
    """Bulk-set the payable rate for all BKP-003 (non-billable) punches
    within a date range. Net payable = rate * hours.
    """
    data = request.json or {}
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')
    rate_val = data.get('rate')

    if not start_date_str or not end_date_str or rate_val is None:
        return jsonify({'error': 'start_date, end_date and rate are required'}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    try:
        rate_float = float(rate_val)
        if rate_float < 0:
            return jsonify({'error': 'Rate must be non-negative'}), 400
    except (TypeError, ValueError):
        return jsonify({'error': 'rate must be a number'}), 400

    # Match punches by stored project_code OR by linked project's code
    nb_project = Project.query.filter(
        db.func.upper(Project.code) == NON_BILLABLE_PROJECT_CODE
    ).first()

    q = Punch.query.filter(
        Punch.work_date >= start_date,
        Punch.work_date <= end_date
    )
    conds = [db.func.upper(Punch.project_code) == NON_BILLABLE_PROJECT_CODE]
    if nb_project:
        conds.append(Punch.project_id == nb_project.id)
    q = q.filter(db.or_(*conds))
    punches = q.all()

    for punch in punches:
        punch.payable_rate = rate_float
        punch.payable_designation = 'Non-Billable'
    db.session.commit()

    return jsonify({
        'message': f'Rate updated for {len(punches)} non-billable entries.',
        'count': len(punches),
    }), 200


@app.route('/api/payables/mark-paid', methods=['PUT'])
@token_required
@admin_required
def mark_payables_paid(current_user):
    data = request.json
    if not data or 'work_ids' not in data or 'is_paid' not in data:
        return jsonify({'error': 'work_ids and is_paid are required'}), 400
    
    work_ids = data['work_ids']
    is_paid = bool(data['is_paid'])

    if not isinstance(work_ids, list):
        return jsonify({'error': 'work_ids must be a list'}), 400

    if not work_ids:
        return jsonify({'message': 'No changes made'}), 200

    punches = Punch.query.filter(Punch.id.in_(work_ids)).all()
    for punch in punches:
        punch.is_paid = is_paid

    db.session.commit()
    return jsonify({'message': f'Successfully updated payment status for {len(punches)} entries.'}), 200


@app.route('/api/payables/employees', methods=['GET'])
@token_required
@admin_required
def get_employee_payables_report(current_user):
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    employee_id = request.args.get('employee_id', type=int)

    if not start_date_str or not end_date_str:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'end_date cannot be before start_date'}), 400

    query = Punch.query.filter(
        Punch.work_date >= start_date,
        Punch.work_date <= end_date
    ).order_by(Punch.work_date.asc(), Punch.id.asc())

    if employee_id:
        query = query.filter(Punch.employee_id == employee_id)

    punches = query.all()
    if not punches:
        return jsonify({
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'rows': [],
            'employee_totals': [],
            'total_hours': 0.0,
            'total_net_payable': 0.0
        })

    employee_ids = list({p.employee_id for p in punches})
    employees = Employee.query.filter(Employee.id.in_(employee_ids)).all()
    employee_by_id = {employee.id: employee for employee in employees}

    # Exclude pure-admin accounts (role='admin') from the payroll report by default.
    # Users with role='both' have an employee profile and should be included.
    if not employee_id:
        punches = [p for p in punches if p.employee_id in employee_by_id and (employee_by_id[p.employee_id].role or 'employee') != 'admin']

    project_ids = list({p.project_id for p in punches if p.project_id})
    projects = Project.query.filter(Project.id.in_(project_ids)).all() if project_ids else []
    project_by_id = {project.id: project for project in projects}

    rows = []
    employee_totals_map = {}
    total_hours = 0.0
    total_net_payable = 0.0
    total_paid = 0.0

    for punch in punches:
        employee = employee_by_id.get(punch.employee_id)
        if not employee:
            continue

        hours = round(float(punch.hours_worked), 2)

        project = project_by_id.get(punch.project_id) if punch.project_id else None
        project_code = project.code if project else (punch.project_code or '')
        project_name = project.name if project else punch.project_name
        non_billable = is_non_billable_punch(punch, project_by_id)

        # Recompute payables by work_date for regular employee-entered rows so
        # promotion updates apply correctly. Preserve explicit admin overrides
        # and non-billable custom rates from stored payable values.
        if non_billable:
            rate = punch.payable_rate if punch.payable_rate is not None else 0.0
            resolved_designation = punch.payable_designation or 'Non-Billable'
        elif punch.updated_by_admin and punch.payable_rate is not None:
            rate = punch.payable_rate
            resolved_designation = punch.payable_designation or 'Unspecified'
        else:
            resolved_rate, resolved_designation = get_employee_compensation_for_date(employee, punch.work_date)
            rate = resolved_rate

        rate = round(float(rate), 2)
        net_payable = round(hours * rate, 2)

        total_hours += hours
        total_net_payable += net_payable
        if punch.is_paid:
            total_paid += net_payable

        if employee.id not in employee_totals_map:
            employee_totals_map[employee.id] = {
                'employee_id': employee.id,
                'employee_name': employee.name,
                'employee_code': employee.employee_code,
                'designation': resolved_designation,
                'total_hours': 0.0,
                'total_net_payable': 0.0
            }
        employee_totals_map[employee.id]['total_hours'] += hours
        employee_totals_map[employee.id]['total_net_payable'] += net_payable

        rows.append({
            'work_id': punch.id,
            'project_code': project_code,
            'employee_name': employee.name,
            'employee_code': employee.employee_code,
            'employee_designation': resolved_designation,
            'project_name': project_name,
            'work_date': punch.work_date.isoformat(),
            'rate': rate,
            'hours': hours,
            'net_payable': net_payable,
            'task_performed': punch.description or '',
            'is_paid': punch.is_paid,
            'is_non_billable': non_billable,
        })

    employee_totals = list(employee_totals_map.values())
    for summary in employee_totals:
        summary['total_hours'] = round(summary['total_hours'], 2)
        summary['total_net_payable'] = round(summary['total_net_payable'], 2)
    employee_totals.sort(key=lambda item: item['employee_name'] or '')

    return jsonify({
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'rows': rows,
        'employee_totals': employee_totals,
        'total_hours': round(total_hours, 2),
        'total_net_payable': round(total_net_payable, 2),
        'total_paid': round(total_paid, 2),
        'total_unpaid': round(total_net_payable - total_paid, 2)
    })

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

    contract_type = _normalize_contract_type(data.get('contract_type'))
    if not contract_type:
        return jsonify({'error': 'Contract type is required and must be Fixed fee, Time & Materials, Retainer, or Admin'}), 400

    try:
        fixed_fee_amount = _parse_fixed_fee_amount(
            data.get('fixed_fee_amount'),
            required=contract_type in (CONTRACT_TYPE_FIXED_FEE, CONTRACT_TYPE_RETAINER),
        )
        
        expected_hours = None
        discount = None
        standard_rate = None
        def _parse_opt(val, name):
            if val in (None, ''): return None
            try: return float(val)
            except (TypeError, ValueError): raise ValueError(f'{name} must be a valid number')

        if contract_type in (CONTRACT_TYPE_FIXED_FEE, CONTRACT_TYPE_RETAINER):
            expected_hours = _parse_opt(data.get('expected_hours'), 'Expected hours')
            discount = _parse_opt(data.get('discount'), 'Discount')
        elif contract_type == CONTRACT_TYPE_ADMIN:
            standard_rate = _parse_opt(data.get('standard_rate'), 'Standard Rate per Hour')
            if standard_rate is None:
                raise ValueError('Standard Rate per Hour is required for admin projects')

        project_discount = _parse_opt(data.get('project_discount'), 'Project discount')
        is_billable = bool(data.get('is_billable', True))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    
    # Check if project code already exists for this client
    existing = Project.query.filter_by(client_id=client_id, code=data['code']).first()
    if existing:
        return jsonify({'error': 'Project with this code already exists for this client'}), 400
    
    project = Project(
        client_id=client_id,
        name=data['name'].strip(),
        code=data['code'].strip().upper(),
        contract_type=contract_type,
        fixed_fee_amount=fixed_fee_amount,
        expected_hours=expected_hours,
        discount=discount,
        project_discount=project_discount,
        standard_rate=standard_rate,
        is_billable=is_billable
    )
    
    db.session.add(project)
    db.session.flush()  # get project.id before commit

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

    if 'contract_type' in data:
        contract_type = _normalize_contract_type(data.get('contract_type'))
        if not contract_type:
            return jsonify({'error': 'Contract type must be Fixed fee, Time & Materials, Retainer, or Admin'}), 400
        project.contract_type = contract_type

    resolved_contract_type = project.contract_type or CONTRACT_TYPE_TIME_MATERIALS
    if 'fixed_fee_amount' in data or 'contract_type' in data:
        try:
            project.fixed_fee_amount = _parse_fixed_fee_amount(
                data.get('fixed_fee_amount', project.fixed_fee_amount),
                required=resolved_contract_type in (CONTRACT_TYPE_FIXED_FEE, CONTRACT_TYPE_RETAINER),
            )
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

    def _parse_opt(val, default, name):
        if val in (None, ''): return None
        try: return float(val)
        except (TypeError, ValueError): raise ValueError(f'{name} must be a valid number')

    if resolved_contract_type == CONTRACT_TYPE_TIME_MATERIALS:
        project.fixed_fee_amount = None
        project.expected_hours = None
        project.discount = None
        project.standard_rate = None
    elif resolved_contract_type in (CONTRACT_TYPE_FIXED_FEE, CONTRACT_TYPE_RETAINER):
        project.standard_rate = None
        def _parse_opt(val, default, name):
            if val in (None, ''): return None
            try: return float(val)
            except (TypeError, ValueError): raise ValueError(f'{name} must be a valid number')
        
        if 'expected_hours' in data:
            try:
                project.expected_hours = _parse_opt(data.get('expected_hours'), project.expected_hours, 'Expected hours')
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400
        
        if 'discount' in data:
            try:
                project.discount = _parse_opt(data.get('discount'), project.discount, 'Discount')
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400

    elif resolved_contract_type == CONTRACT_TYPE_ADMIN:
        project.fixed_fee_amount = None
        project.expected_hours = None
        project.discount = None
        if 'standard_rate' in data:
            try:
                project.standard_rate = _parse_opt(data.get('standard_rate'), project.standard_rate, 'Standard Rate per Hour')
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400
        if project.standard_rate is None:
            return jsonify({'error': 'Standard Rate per Hour is required for admin projects'}), 400
    
    if 'project_discount' in data:
        try:
            project.project_discount = _parse_opt(data.get('project_discount'), project.project_discount, 'Project discount')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    
    if 'is_billable' in data:
        project.is_billable = bool(data['is_billable'])
    
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
    
    if not data.get('employee_name') or not data.get('designation') or data.get('gross_rate') is None:
        return jsonify({'error': 'Employee name, designation and gross rate are required'}), 400
    
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
        employee_name=(data.get('employee_name') or '').strip() or None,
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

    if 'employee_name' in data:
        employee_name = (data.get('employee_name') or '').strip()
        rate.employee_name = employee_name or None
    
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

# ==================== CLIENT RATE ROUTES ====================
# ==================== PROJECT CODE LOOKUP ROUTES ====================
@app.route('/api/projects/by-code/<code>', methods=['GET'])
@token_required
def get_project_by_code(current_user, code):
    """Get project by its code"""
    project = Project.query.filter_by(code=code.strip().upper()).first()
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    return jsonify(project.to_dict())

@app.route('/api/projects/all', methods=['GET'])
@token_required
def get_all_projects(current_user):
    """Get ALL projects for dropdown (including hidden with hidden=true flag)"""
    hidden_query = db.session.query(EmployeeHiddenProject.project_id).filter_by(employee_id=current_user.id)
    hidden_projects = {hp.project_id for hp in hidden_query.all()}
    
    projects = Project.query.all()
    result = []
    for project in projects:
        client = Client.query.get(project.client_id)
        result.append({
            'id': project.id,
            'code': project.code,
            'name': project.name,
            'client_id': project.client_id,
            'client_name': client.name if client else None,
            'hidden': project.id in hidden_projects,
        })
    return jsonify(result)

@app.route('/api/my-hidden-projects', methods=['POST'])
@token_required
def hide_project(current_user):
    data = request.json or {}
    project_id = data.get('project_id')
    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400
    
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
        
    existing = EmployeeHiddenProject.query.filter_by(employee_id=current_user.id, project_id=project_id).first()
    if not existing:
        hp = EmployeeHiddenProject(employee_id=current_user.id, project_id=project_id)
        db.session.add(hp)
        db.session.commit()
    
    return jsonify({'message': 'Project hidden successfully'}), 200

@app.route('/api/my-hidden-projects/<int:project_id>', methods=['DELETE'])
@token_required
def unhide_project(current_user, project_id):
    hp = EmployeeHiddenProject.query.filter_by(employee_id=current_user.id, project_id=project_id).first()
    if hp:
        db.session.delete(hp)
        db.session.commit()
    return jsonify({'message': 'Project restored to dropdown'}), 200

@app.route('/api/employees/<int:employee_id>/resend-welcome', methods=['POST'])
@token_required
@admin_required
def resend_employee_welcome(current_user, employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Employee not found'}), 404
    reset_token = employee.generate_password_reset_token()
    db.session.commit()
    send_welcome_email(employee, reset_token)
    return jsonify({'message': f'Welcome email resent to {employee.email}'}), 200




# ==================== EXPENSE ROUTES ====================

@app.route('/api/expenses', methods=['GET'])
@token_required
def get_my_expenses(current_user):
    """Get all expense entries for the current user for a given week."""
    week_start_str = request.args.get('week')
    if not week_start_str:
        return jsonify({'error': 'week parameter is required (YYYY-MM-DD)'}), 400
    try:
        week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    week_end = week_start + timedelta(days=6)
    expenses = Expense.query.filter(
        Expense.employee_id == current_user.id,
        Expense.date >= week_start,
        Expense.date <= week_end
    ).order_by(Expense.date).all()

    return jsonify({'expenses': [e.to_dict() for e in expenses]})


@app.route('/api/expenses', methods=['POST'])
@token_required
def save_expense_entry(current_user):
    """Upsert a single expense entry (creates or updates by project+type+date)."""
    data = request.json or {}
    project_id   = data.get('project_id')
    expense_type = (data.get('expense_type') or '').strip()
    date_str     = data.get('date')
    amount       = data.get('amount')
    week_start_str = data.get('week_start_date')

    if not all([project_id, expense_type, date_str, amount is not None, week_start_str]):
        return jsonify({'error': 'project_id, expense_type, date, amount, and week_start_date are all required'}), 400

    try:
        entry_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
        amt = float(amount)
        if amt < 0:
            return jsonify({'error': 'amount must be non-negative'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid data format'}), 400

    if not Project.query.get(project_id):
        return jsonify({'error': 'Project not found'}), 404

    existing = Expense.query.filter_by(
        employee_id=current_user.id,
        project_id=project_id,
        expense_type=expense_type,
        date=entry_date
    ).first()

    if amt == 0:
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify({'message': 'Expense entry cleared'})

    if existing:
        existing.amount = amt
        existing.week_start_date = week_start
        db.session.commit()
        return jsonify(existing.to_dict())

    new_exp = Expense(
        employee_id=current_user.id,
        project_id=project_id,
        expense_type=expense_type,
        date=entry_date,
        amount=amt,
        week_start_date=week_start
    )
    db.session.add(new_exp)
    db.session.commit()
    return jsonify(new_exp.to_dict()), 201


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@token_required
def delete_expense_entry(current_user, expense_id):
    """Delete a single expense entry (employee can only delete their own)."""
    exp = Expense.query.get(expense_id)
    if not exp:
        return jsonify({'error': 'Expense not found'}), 404
    if exp.employee_id != current_user.id and not getattr(current_user, 'is_admin', False):
        return jsonify({'error': 'Not authorised'}), 403
    db.session.delete(exp)
    db.session.commit()
    return jsonify({'message': 'Expense deleted successfully'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
