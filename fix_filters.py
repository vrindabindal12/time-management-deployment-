path = 'C:/Users/Administrator/Documents/Time-Tracking/frontend/app/admin/page.tsx'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8')

replacements = [
    (
        "data.filter((employee: Employee) => !employee.is_admin).map((employee: Employee) => employee.id)",
        "data.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee: Employee) => employee.id)"
    ),
    (
        "employees.filter((employee) => !employee.is_admin).map((employee) => employee.id)",
        "employees.filter((employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee) => employee.id)"
    ),
    (
        "employees.filter((employee) => !employee.is_admin);",
        "employees.filter((employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin');"
    ),
    (
        "employees.filter((emp) => !emp.is_admin).length}",
        "employees.filter((emp) => (emp.role ?? (emp.is_admin ? 'admin' : 'employee')) !== 'admin').length}"
    ),
    (
        "employees.filter((employee: Employee) => !employee.is_admin).map((employee) => (",
        "employees.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').map((employee) => ("
    ),
    (
        "employees.filter((employee: Employee) => !employee.is_admin).length === 0 && !showAddEmployeeForm",
        "employees.filter((employee: Employee) => (employee.role ?? (employee.is_admin ? 'admin' : 'employee')) !== 'admin').length === 0 && !showAddEmployeeForm"
    ),
    (
        ".filter((emp) => !emp.is_admin)",
        ".filter((emp) => (emp.role ?? (emp.is_admin ? 'admin' : 'employee')) !== 'admin')"
    ),
]

for old, new in replacements:
    count = content.count(old)
    print(f'Found {count} occurrence(s) of: {old[:70]}')
    content = content.replace(old, new)

with open(path, 'wb') as f:
    f.write(content.encode('utf-8'))
print('All replacements applied.')
