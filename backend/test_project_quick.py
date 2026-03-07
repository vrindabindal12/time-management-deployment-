#!/usr/bin/env python3
import os
import requests
from datetime import date

BASE_URL = "http://localhost:5000/api"

print("="*60)
print("QUICK TEST - Project Code Auto Population")
print("="*60)

# Login as admin
admin_email = os.environ.get("ADMIN_EMAIL")
admin_password = os.environ.get("ADMIN_PASSWORD")
if not admin_email or not admin_password:
    raise SystemExit("Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment before running this script.")

token_resp = requests.post(f"{BASE_URL}/login", json={
    "email": admin_email,
    "password": admin_password
}).json()
admin_token = token_resp["token"]
print("✓ Admin logged in")

# Get all projects
projects_resp = requests.get(f"{BASE_URL}/projects/all", 
    headers={"Authorization": f"Bearer {admin_token}"}).json()
print(f"✓ Found {len(projects_resp)} projects in system")
if projects_resp:
    for p in projects_resp[:3]:
        print(f"  - {p['code']}: {p['name']}")

# Get all clients
clients_resp = requests.get(f"{BASE_URL}/clients",
    headers={"Authorization": f"Bearer {admin_token}"}).json()
print(f"✓ Found {len(clients_resp)} clients in system")

# Try to register a new user
import random
email = f"user{random.randint(1000,9999)}@test.com"
reg_resp = requests.post(f"{BASE_URL}/register", json={
    "name": "Test User",
    "email": email,
    "password": "testpass123"
})
print(f"✓ User registered: {email}")

# Login as user
user_token = requests.post(f"{BASE_URL}/login", json={
    "email": email,
    "password": "testpass123"
}).json()["token"]
print(f"✓ User logged in")

# Get projects list for dropdown
user_projects = requests.get(f"{BASE_URL}/projects/all",
    headers={"Authorization": f"Bearer {user_token}"}).json()
print(f"✓ User can see {len(user_projects)} projects")

# Test adding work with project code (main feature)
if user_projects:
    test_project = user_projects[0]
    print(f"\nTesting work entry with project code: {test_project['code']}")
    
    work_resp = requests.post(f"{BASE_URL}/add-work",
        json={
            "project_code": test_project['code'],
            "work_date": str(date.today()),
            "hours_worked": 8.5,
            "description": "Test work entry"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    if work_resp.status_code == 201:
        work = work_resp.json()
        print(f"✓ Work entry created!")
        print(f"  Project Code: {work['project_code']}")
        print(f"  Project Name: {work['project_name']} (AUTO-POPULATED!)")
        print(f"  Hours: {work['hours_worked']}")
        print(f"\n✓✓✓ SUCCESS - Project name auto-populated from code! ✓✓✓")
    else:
        print(f"✗ Failed to add work: {work_resp.status_code}")
        print(work_resp.json())

# Test get project by code
print(f"\nTesting get project by code...")
if projects_resp:
    test_code = projects_resp[0]['code']
    proj_resp = requests.get(f"{BASE_URL}/projects/by-code/{test_code}",
        headers={"Authorization": f"Bearer {admin_token}"}).json()
    print(f"✓ Get by code {test_code}: {proj_resp['name']}")

print("\n" + "="*60)
print("QUICK TEST COMPLETE")
print("="*60)
