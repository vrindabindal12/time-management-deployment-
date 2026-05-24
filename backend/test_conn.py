import os
from dotenv import load_dotenv
load_dotenv()

db_url = os.environ.get('DATABASE_URL')
print(f"DATABASE_URL is: {db_url}")

from sqlalchemy import create_engine
print("Creating engine...")
engine = create_engine(db_url, pool_size=5, pool_recycle=300, pool_pre_ping=True, max_overflow=10)

print("Connecting...")
try:
    with engine.connect() as conn:
        print("Connected successfully!")
except Exception as e:
    print(f"Error: {e}")
