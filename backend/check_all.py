from app import db, Project, ProjectRate, app, Employee
import sys

def check_everything():
    with app.app_context():
        print("--- EMPLOYEES ---")
        employees = Employee.query.all()
        for e in employees:
            print(f"ID {e.id}: {e.name} ({e.designation}) -> Base Rate: ${e.current_hourly_rate}")
        
        print("\n--- PROJECTS ---")
        projects = Project.query.all()
        for p in projects:
            print(f"ID {p.id}: {p.name} ({p.code}) - Project Discount: {p.project_discount}%")
            rates = ProjectRate.query.filter_by(project_id=p.id).all()
            if rates:
                for r in rates:
                    print(f"  - Rate ID {r.id}: {r.employee_name} ({r.designation}) -> ${r.gross_rate}")
            else:
                print("  - No project rates defined.")

if __name__ == "__main__":
    check_everything()
