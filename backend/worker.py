import os
import sys

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.celery_app import celery
from app import create_app

app = create_app()

if __name__ == '__main__':
    # Start Celery worker using solo pool (recommended for macOS local execution)
    celery.worker_main(['worker', '--loglevel=INFO', '--pool=solo'])
