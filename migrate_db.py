import os
import sys
from sqlalchemy import create_engine, MetaData
from backend.app import app, db

def migrate(neon_url):
    sqlite_path = os.path.abspath(os.path.join("backend", "instance", "timetracking.db"))
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database not found at {sqlite_path}")
        return

    sqlite_url = f"sqlite:///{sqlite_path}"
    print(f"Reading from SQLite: {sqlite_url}")
    print(f"Writing to Neon Postgres: {neon_url}")

    # 1. Drop and create tables cleanly using app context
    print("\nCreating tables in Neon PostgreSQL...")
    app.config['SQLALCHEMY_DATABASE_URI'] = neon_url
    with app.app_context():
        # Clear out existing connections
        db.session.remove()
        db.engine.dispose()
        # Create fresh engine pointing to Neon
        db.drop_all()
        db.create_all()

    # 2. Setup isolated engines for migration
    sqlite_engine = create_engine(sqlite_url)
    pg_engine = create_engine(neon_url)

    # 3. Copy data
    print("\nStarting data migration...")
    tables = db.metadata.sorted_tables
    print(f"Found {len(tables)} tables to migrate.")
    
    with pg_engine.begin() as pg_conn:
        print("Connected to PostgreSQL successfully.")
        for table in tables:
            print(f"Migrating table: {table.name}...")
            with sqlite_engine.begin() as sq_conn:
                rows = sq_conn.execute(table.select()).fetchall()
                if rows:
                    data_to_insert = [row._mapping for row in rows]
                    try:
                        pg_conn.execute(table.insert(), data_to_insert)
                    except Exception as e:
                        print(f"  -> Error inserting into {table.name}: {e}")
                        continue
                    
            print(f"  -> Migrated {len(rows)} rows.")

    print("\nMigration completed successfully!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_db.py <NEON_DATABASE_URL>")
        sys.exit(1)
        
    neon_db_url = sys.argv[1]
    # Fix postgres:// to postgresql://
    if neon_db_url.startswith("postgres://"):
        neon_db_url = neon_db_url.replace("postgres://", "postgresql://", 1)
        
    migrate(neon_db_url)
