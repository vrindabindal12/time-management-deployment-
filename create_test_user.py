import sys
sys.path.insert(0, './backend')
from app import app, db, Employee
try:
    with app.app_context():
        emp = Employee.query.filter_by(email='test@example.com').first()
        if not emp:
            emp = Employee(name='Test Employee', email='test@example.com', is_admin=False, role='employee')
            emp.set_password('test1234')
            db.session.add(emp)
            db.session.commit()
            print("Employee created: test@example.com / test1234")
        else:
            print("Employee already exists: test@example.com / test1234")
except Exception as e:
    import traceback
    traceback.print_exc()
