# Local dev runner — stubs out supabase so the app works without it installed
import sys, types

# Stub the supabase module so api/index.py doesn't crash on import
stub = types.ModuleType("supabase")
stub.create_client = lambda *a, **kw: None
stub.Client = type("Client", (), {})
sys.modules["supabase"] = stub

# Now import and run the Flask app
from api.index import app
app.run(port=5000, debug=True)
