import os
import sys

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting Examination Management Portal on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
