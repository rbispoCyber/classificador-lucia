import sys
import pandas as pd
from io import BytesIO

# add current dir to path
sys.path.append('.')

from api.app.lucia_core import processar_planilha

df = pd.DataFrame({'poro': [0.1, 0.2], 'perm': [10, 100]})
output = BytesIO()
with pd.ExcelWriter(output, engine='openpyxl') as writer:
    df.to_excel(writer, index=False)
output.seek(0)

try:
    res = processar_planilha(output.read(), 'poro', 'perm')
    print("SUCCESS")
except Exception as e:
    import traceback
    print("FAILED WITH EXCEPTION:")
    traceback.print_exc()
