from app import db, Project, ProjectRate, app
import json

def check_apollo():
    with app.app_context():
        apollo = Project.query.filter_by(code='AP001').first()
        if not apollo:
            print("Apollo project not found.")
            return
        
        rates = ProjectRate.query.filter_by(project_id=apollo.id).all()
        print(f"Apollo ID: {apollo.id}")
        print(f"Project Name: {apollo.name}")
        print(f"Project Code: {apollo.code}")
        print(f"Project Discount: {apollo.project_discount}")
        print(f"Rates Count: {len(rates)}")
        for r in rates:
            print(f"  - Rate ID {r.id}: {r.employee_name} ({r.designation}) -> ${r.gross_rate}")

if __name__ == "__main__":
    check_apollo()
