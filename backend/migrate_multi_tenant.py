import os
os.environ['VERCEL'] = '1'
from app import app, db, Organization, Employee, Client, Project, Punch, Service, EmployeeHiddenProject, Expense, FixedFeeAlertLog, ProjectRate
from sqlalchemy import text

def migrate():
    with app.app_context():
        # 1. Create the new Organization table
        print("Creating Organization table...")
        db.create_all()
        
        tables_to_alter = [
            'employee', 'client', 'project', 'punch', 'service',
            'employee_hidden_project', 'expense', 'fixed_fee_alert_log', 'project_rate'
        ]
        
        print("Adding organization_id columns to existing tables...")
        for table in tables_to_alter:
            try:
                db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN organization_id INTEGER REFERENCES organization(id)"))
                print(f"Added organization_id to {table}")
            except Exception as e:
                db.session.rollback()
                print(f"Column organization_id likely already exists in {table} or error: {e}")

        try:
            db.session.execute(text("ALTER TABLE employee ADD COLUMN is_superadmin BOOLEAN DEFAULT FALSE"))
            print("Added is_superadmin to employee")
        except Exception as e:
            db.session.rollback()
            print(f"Column is_superadmin likely already exists in employee or error: {e}")
            
        db.session.commit()

        # 2. Create the Default Workspace
        print("Creating Default Demo Workspace...")
        demo_org = Organization.query.filter_by(name="Demo Workspace").first()
        if not demo_org:
            demo_org = Organization(name="Demo Workspace")
            db.session.add(demo_org)
            db.session.commit()
            print(f"Created Demo Workspace with ID {demo_org.id}")
        else:
            print(f"Demo Workspace already exists with ID {demo_org.id}")

        # 3. Backfill all existing data to the Demo Workspace
        print("Backfilling existing data to Demo Workspace...")
        for table in tables_to_alter:
            try:
                db.session.execute(text(f"UPDATE {table} SET organization_id = :org_id WHERE organization_id IS NULL"), {'org_id': demo_org.id})
                print(f"Updated {table}")
            except Exception as e:
                db.session.rollback()
                print(f"Failed to update {table}: {e}")
                
        db.session.commit()
        
        # 4. Set current admin as Superadmin
        admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com').lower().strip()
        superadmin = Employee.query.filter_by(email=admin_email).first()
        if superadmin:
            superadmin.is_superadmin = True
            db.session.commit()
            print(f"Successfully set {admin_email} as Super Admin.")
        else:
            print(f"Could not find admin user with email {admin_email} to make superadmin.")
            
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
