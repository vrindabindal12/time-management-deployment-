import os
from app import app, db, Organization, Employee

def cleanup():
    with app.app_context():
        # Get all workspaces except ID 1
        orgs_to_delete = Organization.query.filter(Organization.id > 1).all()
        
        for org in orgs_to_delete:
            print(f"Deleting workspace {org.id}: {org.name}")
            
            # Delete employees belonging to this organization
            Employee.query.filter_by(organization_id=org.id).delete()
            
            # Delete the organization itself
            db.session.delete(org)
            
        db.session.commit()
        print("Cleanup complete!")

if __name__ == "__main__":
    cleanup()
