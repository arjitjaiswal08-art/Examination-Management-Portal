import json
import logging
import redis
from app.config import Config

logger = logging.getLogger(__name__)

try:
    redis_client = redis.from_url(Config.REDIS_URL, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Connected to Redis server.")
except Exception as e:
    redis_client = None
    REDIS_AVAILABLE = False
    logger.warning(f"Redis is not available: {e}. Caching will be disabled/fallback.")

def get_cache(key):
    """Retrieve JSON-deserialized object from Redis."""
    if not REDIS_AVAILABLE or not redis_client:
        return None
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error(f"Redis get error for key {key}: {e}")
    return None

def set_cache(key, value, expiry=300):
    """Store JSON-serialized object in Redis with expiration in seconds."""
    if not REDIS_AVAILABLE or not redis_client:
        return False
    try:
        redis_client.setex(key, expiry, json.dumps(value))
        return True
    except Exception as e:
        logger.error(f"Redis set error for key {key}: {e}")
        return False

def delete_cache(key):
    """Delete a single key from Redis."""
    if not REDIS_AVAILABLE or not redis_client:
        return False
    try:
        redis_client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Redis delete error for key {key}: {e}")
        return False

def clear_cache_pattern(pattern):
    """Delete all keys matching pattern (e.g. 'exams:*')."""
    if not REDIS_AVAILABLE or not redis_client:
        return False
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
        return True
    except Exception as e:
        logger.error(f"Redis clear pattern error for {pattern}: {e}")
        return False

# Invalidation helpers
def invalidate_exam_cache(exam_id=None):
    delete_cache("exams:all")
    delete_cache("exams:active")
    delete_cache("admin:stats")
    if exam_id:
        delete_cache(f"exams:{exam_id}")
        delete_cache(f"rubrics:{exam_id}")
        delete_cache(f"schedules:{exam_id}")
    clear_cache_pattern("schedules:*")

def invalidate_rubric_cache(exam_id):
    delete_cache(f"rubrics:{exam_id}")
    if exam_id:
        delete_cache(f"exams:{exam_id}")
    delete_cache("exams:all")

def invalidate_schedule_cache(exam_id=None):
    clear_cache_pattern("schedules:*")
    if exam_id:
        delete_cache(f"schedules:{exam_id}")
