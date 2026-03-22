import sys
sys.path.insert(0, 'c:\\Users\\vrind\\OneDrive\\Desktop\\timeManagement\\backend')
from app import app, db, Employee, ensure_role_schema

with app.app_context():
    ensure_role_schema()
    admin = Employee.query.filter_by(email='admin@example.com').first()
    if not admin:
        admin = Employee.query.filter_by(is_admin=True).first()
        if not admin:
            admin = Employee(name='Admin', email='admin@example.com', is_admin=True, role='admin')
            admin.set_password('admin123')
            db.session.add(admin)
        else:
            admin.email = 'admin@example.com'
            admin.set_password('admin123')
    else:
        admin.set_password('admin123')
        admin.is_admin = True
        admin.role = 'admin'
    
    db.session.commit()
    print("Admin successfully set: admin@example.com / admin123")
