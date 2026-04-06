import urllib.request
import urllib.parse
import time
import subprocess
import os

env = os.environ.copy()
env['PYTHONPATH'] = 'c:\\Users\\ronal\\OneDrive\\Documentos\\software do Luna\\lucia-classifier'

proc = subprocess.Popen(
    [r"c:\Users\ronal\OneDrive\Documentos\software do Luna\lucia-classifier\api\venv\Scripts\python.exe", "-m", "uvicorn", "api.index:app", "--port", "8008"],
    cwd=r"c:\Users\ronal\OneDrive\Documentos\software do Luna\lucia-classifier",
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

time.sleep(3)

import pandas as pd
from io import BytesIO

df = pd.DataFrame({'poro': [0.1, 0.2], 'perm': [10, 100], 'outra_coluna': [1, float('nan')]})
output = BytesIO()
with pd.ExcelWriter(output, engine='openpyxl') as writer:
    df.to_excel(writer, index=False)
output.seek(0)
file_data = output.read()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="file"; filename="test.xlsx"\r\n'
    b'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n' + file_data + b'\r\n'
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="col_poro"\r\n\r\n'
    b'poro\r\n'
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="col_perm"\r\n\r\n'
    b'perm\r\n'
    b'--' + boundary.encode() + b'--\r\n'
)

def test_route(route):
    req = urllib.request.Request(f"http://localhost:8008{route}", data=body, method="POST")
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    try:
        res = urllib.request.urlopen(req)
        print(f"{route} Status:", res.status)
    except urllib.error.HTTPError as e:
        print(f"{route} Status:", e.code)
        print("Response:", e.read().decode('utf-8'))

print("Testing /api/processar (Lucia)")
test_route("/api/processar")

print("\nTesting /api/processar_ghe (GHE)")
test_route("/api/processar_ghe")

proc.terminate()
stdout, stderr = proc.communicate()
print("\n--- Uvicorn Error Log ---")
print(stderr.decode('utf-8', errors='replace'))
