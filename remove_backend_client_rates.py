import re

with open('backend/app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove ClientRate Model
content = re.sub(r'class ClientRate.*?def to_dict\(self\):.*?\}\n\n\n', '', content, flags=re.DOTALL)

# 2. Remove client.rates relationship in Client class
content = re.sub(r"    rates = db\.relationship\('ClientRate', backref='client', lazy=True, cascade='all, delete-orphan'\)\n", '', content)

# 3. Remove 'rates' from Client.to_dict
content = re.sub(r"            'updated_at'.*?,\n            'rates': \[r\.to_dict\(\) for r in self\.rates\]\n        \}", r"            'updated_at': self.updated_at.isoformat() if self.updated_at else None\n        }", content, flags=re.DOTALL)

# 4. Remove auto-copy logic in POST /api/clients/<int:client_id>/projects
content = re.sub(r'    # Auto-copy client-level default rates to this new project\n    for cr in client\.rates:\n        pr = ProjectRate\([\s\S]*?db\.session\.add\(pr\)\n\n', '', content)

# 5. Remove API routes
content = re.sub(r'@app\.route\(\'/api/clients/<int:client_id>/rates.*?(?=# ==================== PROJECT CODE LOOKUP ROUTES ====================)', '', content, flags=re.DOTALL)

# Let's save it back
with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.write(content)
