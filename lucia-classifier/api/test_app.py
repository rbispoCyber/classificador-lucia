import sys
try:
    from app.main import app
    print("App imported successfully!")
except Exception as e:
    print("FAILED TO IMPORT APP:")
    import traceback
    traceback.print_exc()
