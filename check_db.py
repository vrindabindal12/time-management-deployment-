import sys
sys.path.insert(0, './backend')
from app import app, db, Employee
import traceback
try:
    with app.app_context():
        admin = Employee.query.filter_by(email='admin@example.com').first()
        if not admin:
            admin = Employee(name='Admin', email='admin@example.com', is_admin=True, role='admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("Admin created")
        else:
            admin.set_password('admin123')
            db.session.commit()
            print("Admin updated")
except Exception as e:
    traceback.print_exc()
