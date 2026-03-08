from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os
import csv
import io
from functools import wraps
from openpyxl import Workbook
from sqlalchemy import text

app = Flask(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configuration – all secrets from env; no defaults that contain real secrets
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

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

# Models
class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
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
            'is_admin': self.is_admin,
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
            'profile_photo': self.profile_photo
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
            'hours_worked': self.hours_worked,
            'invoice_hours': self.invoice_hours,
            'invoice_gross_rate': self.invoice_gross_rate,
            'invoice_discount': self.invoice_discount,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by_admin': self.updated_by_admin,
            'is_paid': self.is_paid
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
            'gross_rate': self.gross_rate,
            'discount': self.discount,
            'net_rate': self.net_rate,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


def send_verification_email(employee):
    verification_url = f"{FRONTEND_URL}/verify-email?token={employee.verification_token}"
    
    msg = Message(
        subject='Verify Your Email - Time Tracking System',
        recipients=[employee.email],
        body=f'''Hello {employee.name},

Thank you for registering with our Time Tracking System!

Please click the following link to verify your email address:
{verification_url}

This link will expire in 24 hours.

If you did not register for this account, please ignore this email.

Best regards,
Time Tracking System Team
''',
        html=f'''
<html>
<body>
    <h2>Hello {employee.name},</h2>
    
    <p>Thank you for registering with our Time Tracking System!</p>
    
    <p>Please click the button below to verify your email address:</p>
    
    <p style="margin: 20px 0;">
        <a href="{verification_url}" 
           style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
        </a>
    </p>
    
    <p><strong>Important:</strong> This link will expire in 24 hours.</p>
    
    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p><a href="{verification_url}">{verification_url}</a></p>
    
    <p>If you did not register for this account, please ignore this email.</p>
    
    <br>
    <p>Best regards,<br>
    Time Tracking System Team</p>
</body>
</html>
'''
    )
    
    try:
        mail.send(msg)
        print(f"Verification email sent to {employee.email}")
    except Exception as e:
        print(f"Failed to send verification email to {employee.email}: {str(e)}")


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


def ensure_employee_schema():
    """Add onboarding/profile columns for existing sqlite databases."""
    if not DATABASE_URL.startswith('sqlite'):
        return

    required_columns = {
        'employee_code': 'TEXT',
        'designation': 'TEXT',
        'reporting_manager': 'TEXT',
        'start_date': 'DATE',
        'current_hourly_rate': 'FLOAT',
        'promotion_1_date': 'DATE',
        'promotion_1_rate': 'FLOAT',
        'promotion_1_designation': 'TEXT',
        'promotion_2_date': 'DATE',
        'promotion_2_rate': 'FLOAT',
        'promotion_2_designation': 'TEXT',
        'promotion_3_date': 'DATE',
        'promotion_3_rate': 'FLOAT',
        'promotion_3_designation': 'TEXT',
        'promotion_4_date': 'DATE',
        'promotion_4_rate': 'FLOAT',
        'promotion_4_designation': 'TEXT',
        'promotion_5_date': 'DATE',
        'promotion_5_rate': 'FLOAT',
        'promotion_5_designation': 'TEXT',
        'profile_photo': 'TEXT',
    }

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


def generate_employee_code(employee_id):
    return f'BKP-{employee_id:03d}'


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
    """Add invoice override columns for existing sqlite databases."""
    if not DATABASE_URL.startswith('sqlite'):
        return

    required_columns = {
        'invoice_hours': 'FLOAT',
        'invoice_gross_rate': 'FLOAT',
        'invoice_discount': 'FLOAT',
    }

    existing = {
        row[1]
        for row in db.session.execute(text("PRAGMA table_info(punch)")).fetchall()
    }

    for column_name, column_type in required_columns.items():
        if column_name not in existing:
            db.session.execute(text(f"ALTER TABLE punch ADD COLUMN {column_name} {column_type}"))
    db.session.commit()


def ensure_project_rate_schema():
    """Add project rate columns for existing sqlite databases."""
    if not DATABASE_URL.startswith('sqlite'):
        return

    required_columns = {
        'employee_name': 'TEXT',
    }

    existing = {
        row[1]
        for row in db.session.execute(text("PRAGMA table_info(project_rate)")).fetchall()
    }

    for column_name, column_type in required_columns.items():
        if column_name not in existing:
            db.session.execute(text(f"ALTER TABLE project_rate ADD COLUMN {column_name} {column_type}"))
    db.session.commit()


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


def parse_profile_photo(value, field_name='profile_photo'):
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise ValueError(f'{field_name} must be a string')

    photo_data = value.strip()
    if not photo_data:
        return None
    if not photo_data.startswith('data:image/'):
        raise ValueError(f'{field_name} must be a valid image data URL')
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
    ensure_employee_codes()
    ensure_punch_invoice_schema()
    ensure_project_rate_schema()
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
            is_admin=True
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
        if existing_employee.is_verified:
            return jsonify({'error': 'Employee with this email already exists'}), 400
        else:
            # Resend verification email for unverified account
            verification_token = existing_employee.generate_verification_token()
            db.session.commit()
            send_verification_email(existing_employee)
            return jsonify({
                'message': 'Verification email sent. Please check your email to verify your account.',
                'email_sent': True
            }), 200
    
    employee = Employee(
        name=data['name'],
        email=data['email'],
        is_admin=False,
        is_verified=False
    )
    employee.set_password(data['password'])
    
    # Generate verification token
    verification_token = employee.generate_verification_token()
    
    db.session.add(employee)
    db.session.commit()
    
    # Send verification email
    send_verification_email(employee)
    
    return jsonify({
        'message': 'Registration successful. Please check your email to verify your account.',
        'email_sent': True
    }), 201

@app.route('/api/verify-email/<token>', methods=['GET'])
def verify_email(token):
    employee = Employee.query.filter_by(verification_token=token).first()
    
    if not employee:
        return jsonify({'error': 'Invalid verification token'}), 400
    
    if employee.verification_token_expires < datetime.utcnow():
        return jsonify({'error': 'Verification token has expired. Please request a new verification email.'}), 400
    
    if employee.is_verified:
        return jsonify({'message': 'Email already verified. You can now log in.'}), 200
    
    employee.is_verified = True
    employee.verification_token = None
    employee.verification_token_expires = None
    db.session.commit()
    
    return jsonify({'message': 'Email verified successfully! You can now log in.'}), 200

@app.route('/api/resend-verification', methods=['POST'])
def resend_verification():
    data = request.json
    
    if not data.get('email'):
        return jsonify({'error': 'Email is required'}), 400
    
    employee = Employee.query.filter_by(email=data['email']).first()
    
    if not employee:
        return jsonify({'error': 'No account found with this email address'}), 404
    
    if employee.is_verified:
        return jsonify({'error': 'This email is already verified'}), 400
    
    # Generate new verification token
    verification_token = employee.generate_verification_token()
    db.session.commit()
    
    # Send verification email
    send_verification_email(employee)
    
    return jsonify({'message': 'Verification email sent. Please check your email.'}), 200

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
    
    existing_employee = Employee.query.filter_by(email=data['email']).first()
    if existing_employee:
        return jsonify({'error': 'Employee with this email already exists'}), 400
    
    employee = Employee(
        name=data['name'],
        email=data['email'],
        is_admin=False
    )
    employee.set_password(data['password'])

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
    
    return jsonify(employee.to_dict()), 201

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

    oldest_allowed = today - timedelta(days=7)
    if work_date < oldest_allowed or work_date > today:
        return jsonify({'error': 'Work date must be within the last 7 days (including today)'}), 400
    
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

    projects = Project.query.filter_by(client_id=client_id).all()
    project_by_id = {project.id: project for project in projects}
    project_by_code = {project.code: project for project in projects if project.code}
    project_by_name = {project.name: project for project in projects if project.name}
    project_ids = list(project_by_id.keys())

    if not project_ids:
        return jsonify({
            'client': client.to_dict(),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'rows': [],
            'project_totals': [],
            'total_hours': 0.0,
            'total_net_billable': 0.0
        })

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
    employee_by_id = {employee.id: employee for employee in employees}

    def _norm_text(value):
        return (value or '').strip().lower()

    rates = ProjectRate.query.filter(ProjectRate.project_id.in_(project_ids)).all()
    rate_by_project_employee_designation = {}
    rate_by_project_and_employee = {}
    rate_by_project_and_designation = {}
    employee_scoped_projects = set()
    for rate in rates:
        designation_key = _norm_text(rate.designation)
        employee_key = _norm_text(rate.employee_name)
        if employee_key and designation_key:
            rate_by_project_employee_designation[(rate.project_id, employee_key, designation_key)] = rate
        if employee_key and (rate.project_id, employee_key) not in rate_by_project_and_employee:
            rate_by_project_and_employee[(rate.project_id, employee_key)] = rate
            employee_scoped_projects.add(rate.project_id)
        # Keep designation fallback available even when employee_name is present.
        if designation_key and (rate.project_id, designation_key) not in rate_by_project_and_designation:
            rate_by_project_and_designation[(rate.project_id, designation_key)] = rate
    first_rate_by_project = {}
    for rate in rates:
        if rate.project_id not in first_rate_by_project:
            first_rate_by_project[rate.project_id] = rate

    rows = []
    project_totals_map = {}
    total_hours = 0.0
    total_net_billable = 0.0

    for punch in punches:
        project = None
        if punch.project_id and punch.project_id in project_by_id:
            project = project_by_id[punch.project_id]
        elif punch.project_code and punch.project_code in project_by_code:
            project = project_by_code[punch.project_code]
        elif punch.project_name and punch.project_name in project_by_name:
            project = project_by_name[punch.project_name]

        if not project:
            continue

        employee = employee_by_id.get(punch.employee_id)
        _, designation = get_employee_compensation_for_date(employee, punch.work_date) if employee else (0.0, 'Unspecified')
        employee_key = _norm_text(employee.name) if employee else ''
        designation_key = _norm_text(designation)
        selected_rate = rate_by_project_employee_designation.get((project.id, employee_key, designation_key))
        if not selected_rate:
            selected_rate = rate_by_project_and_employee.get((project.id, employee_key))
        # If project has employee-specific rates, only those employees are invoiceable.
        if not selected_rate and project.id in employee_scoped_projects:
            continue
        if not selected_rate:
            selected_rate = rate_by_project_and_designation.get((project.id, designation_key))
        if not selected_rate:
            selected_rate = first_rate_by_project.get(project.id)
        if not selected_rate:
            continue

        base_gross_rate = selected_rate.gross_rate if selected_rate else 0.0
        base_discount = selected_rate.discount if selected_rate else 0.0

        # Invoicing report is fully auto-populated from configured project rates and attendance hours.
        gross_rate = base_gross_rate
        discount = base_discount
        hours = punch.hours_worked
        net_rate = round(gross_rate * (1 - discount / 100), 2)
        net_billable = round(net_rate * hours, 2)

        total_hours += hours
        total_net_billable += net_billable

        if project.id not in project_totals_map:
            project_totals_map[project.id] = {
                'project_id': project.id,
                'project_code': project.code,
                'project_name': project.name,
                'total_hours': 0.0,
                'total_net_billable': 0.0
            }
        project_totals_map[project.id]['total_hours'] += hours
        project_totals_map[project.id]['total_net_billable'] += net_billable

        rows.append({
            'work_id': punch.id,
            'work_date': punch.work_date.isoformat(),
            'project_code': project.code,
            'project_name': project.name,
            'employee_name': employee.name if employee else 'Unknown',
            'employee_designation': designation,
            'gross_rate': gross_rate,
            'discount': discount,
            'net_rate': net_rate,
            'hours': round(hours, 2),
            'net_billable': net_billable,
            'task_performed': punch.description or '',
            'is_invoice_override': False
        })

    rows.sort(key=lambda item: (item['work_date'], item['project_code'], item['employee_name']))

    project_totals = list(project_totals_map.values())
    for summary in project_totals:
        summary['total_hours'] = round(summary['total_hours'], 2)
        summary['total_net_billable'] = round(summary['total_net_billable'], 2)
    project_totals.sort(key=lambda item: item['project_code'])

    return jsonify({
        'client': client.to_dict(),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'rows': rows,
        'project_totals': project_totals,
        'total_hours': round(total_hours, 2),
        'total_net_billable': round(total_net_billable, 2)
    })

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

    # Non-admin payroll report by default unless explicitly querying an admin employee_id.
    if not employee_id:
        punches = [p for p in punches if p.employee_id in employee_by_id and not employee_by_id[p.employee_id].is_admin]

    project_ids = list({p.project_id for p in punches if p.project_id})
    projects = Project.query.filter(Project.id.in_(project_ids)).all() if project_ids else []
    project_by_id = {project.id: project for project in projects}

    rows = []
    employee_totals_map = {}
    total_hours = 0.0
    total_net_payable = 0.0

    for punch in punches:
        employee = employee_by_id.get(punch.employee_id)
        if not employee:
            continue

        hours = round(float(punch.hours_worked), 2)
        resolved_rate, resolved_designation = get_employee_compensation_for_date(employee, punch.work_date)
        rate = round(resolved_rate, 2)
        net_payable = round(hours * rate, 2)

        project = project_by_id.get(punch.project_id) if punch.project_id else None
        project_code = project.code if project else (punch.project_code or '')
        project_name = project.name if project else punch.project_name

        total_hours += hours
        total_net_payable += net_payable

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
            'is_paid': punch.is_paid
        })

    employee_totals = list(employee_totals_map.values())
    for summary in employee_totals:
        summary['total_hours'] = round(summary['total_hours'], 2)
        summary['total_net_payable'] = round(summary['total_net_payable'], 2)
    employee_totals.sort(key=lambda item: item['employee_name'])

    return jsonify({
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'rows': rows,
        'employee_totals': employee_totals,
        'total_hours': round(total_hours, 2),
        'total_net_payable': round(total_net_payable, 2)
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
    """Get all projects (for dropdown lists)"""
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
        })
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
