import re

with open('frontend/app/admin/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove imports
content = content.replace('clientRateApi, ', '')
content = content.replace('ClientRate, ', '')

# 2. Remove states
content = re.sub(r'  const \[clientRates, setClientRates\].*?;\n', '', content)
content = re.sub(r'  const \[showAddClientRateForm, setShowAddClientRateForm\].*?;\n', '', content)
content = re.sub(r'  const \[clientRateForm, setClientRateForm\].*?;\n', '', content)
content = re.sub(r'  const \[editingClientRateId, setEditingClientRateId\].*?;\n', '', content)
content = re.sub(r'  const \[clientRateEditForm, setClientRateEditForm\].*?;\n', '', content)

# 3. Remove loadClientRates(selectedClient);
content = content.replace('loadClientRates(selectedClient);', '')
content = content.replace('setClientRates([]);', '')

# 4. Remove loadClientRates func
content = re.sub(r'  const loadClientRates = async.*?setError\(\'Failed to load client rates\'\);\n      clearError\(\);\n    \}\n  \};\n', '', content, flags=re.DOTALL)

# 5. Remove 'client-rate'
content = content.replace(" | 'client-rate'", "")
content = re.sub(r'      \} else if \(deleteEntityModal\.entityType === \'client-rate\'\) \{.*?loadClientRates\(selectedClient\);\n', '', content, flags=re.DOTALL)

# 6. Remove client rate edit functions
content = re.sub(r'  const startEditClientRate.*?\n  const handleApplyClientRatesToProject = async \(\) => \{.*?\} catch \(err: any\) \{.*?\n      clearError\(\);\n    \}\n  \};\n', '', content, flags=re.DOTALL)

# 7. Remove UI chunks
content = re.sub(r'              \{/\* Client Default Rates Section \*/\}.*?(?=              \{/\* End clients panel \*/\})', '', content, flags=re.DOTALL) # wait, it's after End clients panel

# better:
content = re.sub(r'              \{/\* Client Default Rates Section \*/\}.*?                </div>\n              \)\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'                    \{clientRates\.length > 0 && \(.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'                \{editingClientRateId !== null && \(.*?</form>\n                  \)\}\n', '', content, flags=re.DOTALL)
content = content.replace('/* LEFT: Clients + Client Default Rates */', '/* LEFT: Clients */')

with open('frontend/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
