import re
import os

path = 'c:\\Users\\vrind\\OneDrive\\Desktop\\timeManagement\\backend\\app.py'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace get_query(Model, current_user).get(id) 
# with get_query(Model, current_user).filter_by(id=id).first()
pattern = re.compile(r'get_query\(\s*([^,]+)\s*,\s*current_user\s*\)\.get\(\s*([^)]+)\s*\)')

new_content, count = pattern.subn(r'get_query(\1, current_user).filter_by(id=\2).first()', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Replaced {count} occurrences.")
