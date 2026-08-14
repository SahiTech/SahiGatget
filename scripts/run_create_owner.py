import json
import subprocess

sql_query = open('/home/ubuntu/sahigatget/scripts/create_owner.sql').read()
payload = {
    "project_id": "ncknpaezdhsqiicdjtgr",
    "query": sql_query
}

with open('/tmp/create_owner_payload.json', 'w') as f:
    json.dump(payload, f)

res = subprocess.run([
    'manus-mcp-cli', 'tool', 'call', 'execute_sql',
    '--server', 'supabase',
    '--input-file', '/tmp/create_owner_payload.json'
], capture_output=True, text=True)

print(res.stdout)
print(res.stderr)
