import os
import sys

# Ensure backend directory is in python search path
root_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
backend_dir = os.path.join(root_dir, 'backend')

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import create_app

# Vercel looks for 'app' in api/index.py
app = create_app()
