import re

def refactor():
    with open('app.py', 'r') as f:
        lines = f.readlines()

    models = ['Employee', 'Punch', 'Client', 'Project', 'Service', 'EmployeeHiddenProject', 'Expense', 'FixedFeeAlertLog', 'ProjectRate']
    
    inside_func = False
    func_has_current_user = False
    
    for i in range(len(lines)):
        line = lines[i]
        
        # Check if entering a function
        match = re.match(r'^def (\w+)\((.*)\):', line)
        if match:
            inside_func = True
            args = match.group(2)
            func_has_current_user = 'current_user' in args
            continue
            
        # If we hit a non-indented line (that isn't empty or a decorator or comment), we exit the function
        if inside_func and line.strip() and not line.startswith(' ') and not line.startswith('\t') and not line.startswith('@') and not line.startswith('#'):
            inside_func = False
            func_has_current_user = False
            
        if inside_func and func_has_current_user:
            for model in models:
                # Replace Model.query with get_query(Model, current_user)
                if f"{model}.query" in line:
                    lines[i] = line.replace(f"{model}.query", f"get_query({model}, current_user)")

    with open('app.py', 'w') as f:
        f.writelines(lines)

if __name__ == '__main__':
    refactor()
