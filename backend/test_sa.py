import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
print(f"Testing SQLAlchemy with: {db_url}")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("SQLAlchemy connection successful!")
except Exception as e:
    print(f"SQLAlchemy connection failed: {e}")
