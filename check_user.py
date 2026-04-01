import sys
sys.path.insert(0, './backend')
from app import app, db, Employee
try:
    with app.app_context():
        emp = Employee.query.filter_by(email='ankitasarve6@gmail.com').first()
        if emp:
            print(f"User found: {emp.email}")
            print(f"Name: {emp.name}")
            print(f"Role: {emp.role}")
            print(f"Is Admin: {emp.is_admin}")
            # Reset password
            emp.set_password('welcome123')
            db.session.commit()
            print("Password reset to welcome123")
        else:
            print(f"User NOT found: ankitasarve6@gmail.com")
except Exception as e:
    import traceback
    traceback.print_exc()
