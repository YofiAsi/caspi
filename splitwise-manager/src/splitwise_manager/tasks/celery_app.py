from celery import Celery
from celery.schedules import schedule

from splitwise_manager.settings import settings

celery_app = Celery(
    "splitwise_manager",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["splitwise_manager.tasks.splitwise_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "requeue-due-outbox": {
        "task": "splitwise_manager.tasks.splitwise_tasks.requeue_due_outbox",
        "schedule": schedule(run_every=30.0),
    },
}
