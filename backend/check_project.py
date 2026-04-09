from app import db, Project, ProjectRate, app, Employee
import sys

def check_project(code):
    with app.app_context():
        project = Project.query.filter_by(code=code).first()
        if not project:
            print(f"Project {code} not found.")
            return
        
        rates = ProjectRate.query.filter_by(project_id=project.id).all()
        print(f"Project ID: {project.id}")
        print(f"Project Name: {project.name}")
        print(f"Project Code: {project.code}")
        print(f"Project Discount: {project.project_discount}")
        print(f"Rates Count: {len(rates)}")
        for r in rates:
            print(f"  - Rate ID {r.id}: {r.employee_name} ({r.designation}) -> ${r.gross_rate}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_project(sys.argv[1])
    else:
        print("Usage: python check_project.py <PROJECT_CODE>")
