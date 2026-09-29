import os
import shutil

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

# Detect Vercel serverless environment
IS_VERCEL = os.environ.get('VERCEL') == '1' or os.environ.get('NOW_REGION') is not None

if IS_VERCEL:
    # /tmp is the only writable directory on Vercel Serverless
    default_db_path = '/tmp/emp.db'
    seeded_db = os.path.join(basedir, 'instance', 'emp.db')
    if os.path.exists(seeded_db) and not os.path.exists(default_db_path):
        try:
            shutil.copyfile(seeded_db, default_db_path)
        except Exception:
            pass
    default_exports_path = '/tmp/exports'
else:
    default_db_path = os.path.join(basedir, 'instance', 'emp.db')
    default_exports_path = os.path.join(basedir, 'exports')

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'emp-portal-secret-key-2026')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', f"sqlite:///{default_db_path}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/1')
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/2')

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'emp-portal-jwt-super-secret-key-32bytes-2026')
    JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

    EXPORTS_DIR = os.environ.get('EXPORTS_DIR', default_exports_path)
    CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes
