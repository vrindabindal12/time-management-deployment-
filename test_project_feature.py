#!/usr/bin/env python3
"""Test project code functionality"""
import requests
from datetime import date
import random
import sys

if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:5000/api"

print("\n" + "="*70)
print("TEST: Project Code Auto-Population Feature")
print("="*70)

# Admin login
print("\n[Setup] Admin login...")
admin_login = requests.post(f"{BASE_URL}/login", json={
    "email": "mananbedi.tech@gmail.com",
    "password": "admin123"
}).json()
admin_token = admin_login["token"]
print("  PASS: Admin logged in")

# Create client
print("\n[Setup] Create client...")
client_name = f"Client{random.randint(10000,99999)}"
client_resp = requests.post(f"{BASE_URL}/clients", json={
    "name": client_name,
    "code": f"C{random.randint(1000,9999)}"
}, headers={"Authorization": f"Bearer {admin_token}"}).json()
if "error" in client_resp:
    print(f"  ERROR: {client_resp['error']}")
    # If client already exists, just use it
    print("  Using existing client...")
    clients = requests.get(f"{BASE_URL}/clients", 
        headers={"Authorization": f"Bearer {admin_token}"}).json()
    if clients:
        client_id = clients[0]['id']
    else:
        print("  FAIL: No clients available")
        exit(1)
else:
    client_id = client_resp["id"]
    print(f"  PASS: Client created (ID={client_id})")

# Create project
print("\n[Setup] Create project...")
project_resp = requests.post(f"{BASE_URL}/clients/{client_id}/projects", json={
    "name": "Test Project",
    "code": "TP-001"
}, headers={"Authorization": f"Bearer {admin_token}"}).json()
project_id = project_resp["id"]
project_code = project_resp["code"]
project_name = project_resp["name"]
print(f"  PASS: Project created - {project_code}: {project_name}")

# Test 1: Get project by code
print("\n[TEST 1] Get project by code...")
result = requests.get(f"{BASE_URL}/projects/by-code/{project_code}",
    headers={"Authorization": f"Bearer {admin_token}"}).json()
if result.get("code") == project_code and result.get("name") == project_name:
    print(f"  PASS: Retrieved {result['code']} -> {result['name']}")
else:
    print(f"  FAIL: {result}")
    exit(1)

# Test 2: Get all projects
print("\n[TEST 2] Get all projects...")
all_projects = requests.get(f"{BASE_URL}/projects/all",
    headers={"Authorization": f"Bearer {admin_token}"}).json()
if any(p['code'] == project_code for p in all_projects):
    print(f"  PASS: Project found in list (total: {len(all_projects)})")
else:
    print(f"  FAIL: Project not found in list")
    exit(1)

# Register user
print("\n[Setup] Register user...")
user_email = f"user{random.randint(10000,99999)}@test.com"
requests.post(f"{BASE_URL}/register", json={
    "name": "Test User",
    "email": user_email,
    "password": "pass123"
})
print(f"  PASS: User registered")

# User login
user_login = requests.post(f"{BASE_URL}/login", json={
    "email": user_email,
    "password": "pass123"
}).json()
user_token = user_login["token"]
print("  PASS: User logged in")

# Test 3: Add work with project_code
print("\n[TEST 3] Add work entry with project_code...")
work_resp = requests.post(f"{BASE_URL}/add-work", json={
    "project_code": project_code,
    "work_date": str(date.today()),
    "hours_worked": 8.0,
    "description": "Testing project code"
}, headers={"Authorization": f"Bearer {user_token}"})

if work_resp.status_code == 201:
    work = work_resp.json()
    print(f"  PASS: Work entry created")
    print(f"    Code: {work.get('project_code')}")
    print(f"    Name: {work.get('project_name')} [AUTO-POPULATED]")
    if work.get('project_name') == project_name:
        print("  PASS: Project name correctly auto-populated!")
        work_id = work['id']
    else:
        print(f"  FAIL: Expected '{project_name}', got '{work.get('project_name')}'")
        exit(1)
else:
    print(f"  FAIL: {work_resp.json()}")
    exit(1)

# Test 4: Admin edits work with new project_code
print("\n[TEST 4] Admin updates project code...")

# Create another project first
project2_resp = requests.post(f"{BASE_URL}/clients/{client_id}/projects", json={
    "name": "Test Project 2",
    "code": "TP-002"
}, headers={"Authorization": f"Bearer {admin_token}"}).json()
project2_code = project2_resp["code"]
project2_name = project2_resp["name"]

# Update work entry
edit_resp = requests.put(f"{BASE_URL}/work/{work_id}", json={
    "project_code": project2_code,
    "hours_worked": 7.5
}, headers={"Authorization": f"Bearer {admin_token}"})

if edit_resp.status_code == 200:
    edited = edit_resp.json()
    print(f"  PASS: Work entry updated")
    print(f"    Code: {edited.get('project_code')}")
    print(f"    Name: {edited.get('project_name')} [AUTO-POPULATED]")
    if edited.get('project_name') == project2_name:
        print("  PASS: Project name correctly updated on code change!")
    else:
        print(f"  FAIL: Expected '{project2_name}', got '{edited.get('project_name')}'")
        exit(1)
else:
    print(f"  FAIL: {edit_resp.json()}")
    exit(1)

# Test 5: Verify admin can see work with codes
print("\n[TEST 5] Admin retrieving employee work...")
emp_work_resp = requests.get(f"{BASE_URL}/employee/{user_login['employee']['id']}/work",
    headers={"Authorization": f"Bearer {admin_token}"}).json()
work_entries = emp_work_resp.get('work_entries', [])
if work_entries and any(w.get('project_code') == project2_code for w in work_entries):
    print(f"  PASS: Admin can see work entries with project codes")
    for w in work_entries:
        print(f"    - {w.get('project_code')} -> {w.get('project_name')}")
else:
    print(f"  FAIL: Work entries not found")
    exit(1)

print("\n" + "="*70)
print("SUCCESS: All tests passed!")
print("="*70)
print("\nVerified:")
print("  + Project lookup by code works")
print("  + All projects endpoint returns data")
print("  + Work creation with project_code and auto-populated name")
print("  + Admin editing with project_code and auto-populated name")
print("  + Admin viewing work with both code and name")
print("="*70 + "\n")
