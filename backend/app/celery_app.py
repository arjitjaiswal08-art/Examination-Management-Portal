from celery import Celery
from celery.schedules import crontab
from app.config import Config

def make_celery(app_name=__name__):
    celery = Celery(
        app_name,
        broker=Config.CELERY_BROKER_URL,
        backend=Config.CELERY_RESULT_BACKEND,
        include=['app.tasks']
    )
    celery.conf.update(
        timezone='Asia/Kolkata',
        enable_utc=False,
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        beat_schedule={
            'daily-student-examination-reminders': {
                'task': 'app.tasks.send_daily_reminders',
                'schedule': crontab(hour=8, minute=0),  # Daily at 8:00 AM
            },
            'monthly-admin-examination-report': {
                'task': 'app.tasks.generate_monthly_report',
                'schedule': crontab(day_of_month='1', hour=0, minute=0),  # 1st of every month
            },
        }
    )
    return celery

celery = make_celery()
