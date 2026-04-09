with open('frontend/app/admin/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove states
text = text.replace("  const [clientRates, setClientRates] = useState<ClientRate[]>([]);\n", "")
text = text.replace("  const [showAddClientRateForm, setShowAddClientRateForm] = useState(false);\n", "")
text = text.replace("  const [clientRateForm, setClientRateForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });\n", "")
text = text.replace("  const [editingClientRateId, setEditingClientRateId] = useState<number | null>(null);\n", "")
text = text.replace("  const [clientRateEditForm, setClientRateEditForm] = useState({ employeeName: '', designation: DESIGNATIONS[0], grossRate: '', discount: '0' });\n", "")

text = text.replace("loadClientRates(selectedClient);", "")
text = text.replace("setClientRates([]);", "")

text = text.replace("  const loadClientRates = async (clientId: number) => {\n    try {\n      const data = await clientRateApi.getClientRates(clientId);\n      setClientRates(data);\n    } catch (err: any) {\n      setError('Failed to load client rates');\n      clearError();\n    }\n  };\n", "")

text = text.replace("      } else if (deleteEntityModal.entityType === 'client-rate') {\n        await clientRateApi.deleteClientRate(deleteEntityModal.entityId);\n        if (selectedClient) {\n          await loadClientRates(selectedClient);\n        }\n", "")

text = text.replace(", clientRateApi", "")
text = text.replace(", ClientRate", "")

text = text.replace("'client' | 'project' | 'rate' | 'client-rate'", "'client' | 'project' | 'rate'")

s2 = text.find("              {/* Client Default Rates Section */}")
e2 = text.find("              {/* End left column wrapper */}")
if s2 != -1 and e2 != -1:
    text = text[:s2] + text[e2:]

s3 = text.find("                    {clientRates.length > 0 && (")
e3 = text.find("                    )}\n", s3)
if s3 != -1 and e3 != -1:
    text = text[:s3] + text[e3+len("                    )}\n"):]

s4 = text.find("              {editingClientRateId !== null && (")
e4 = text.find("                // End edit rate modal space\n", s4)
if s4 != -1 and e4 != -1:
    text = text[:s4] + text[e4+len("                // End edit rate modal space\n"):]

with open('frontend/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
