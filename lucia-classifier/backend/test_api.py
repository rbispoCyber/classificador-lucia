import requests
from io import BytesIO

print("Starting test...")

try:
    import pandas as pd
    # Create valid excel file string in memory
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame({"A": [1, 2], "B": [3, 4]}).to_excel(writer, index=False)
    mock_excel_bytes = output.getvalue()

    print("Sending request to FastAPI...")
    
    response = requests.post(
        "http://127.0.0.1:8000/api/colunas",
        files={"file": ("test.xlsx", mock_excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    print("STATUS CODE:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()
    print("Failed to run test script:", e)
