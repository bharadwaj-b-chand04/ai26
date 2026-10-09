"""Retention runs even when inference is disabled or a source/model fails."""
import logging
import threading
import time
from artifacts import cleanup_artifacts

log = logging.getLogger(__name__)


class Maintenance:
    def __init__(self, repository):
        self.repository = repository
        self.stop_event = threading.Event()
        self.thread = None

    def run_once(self, now=None):
        now = time.time() if now is None else now
        cutoff = now - 7*86400
        # Report insertion and lease checks share this lock with cleanup.
        with self.repository.lock:
            self.repository.cleanup(cutoff, now)
            cleanup_artifacts(cutoff, self.repository.protected_artifacts(now))

    def start(self):
        if self.thread and self.thread.is_alive(): return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self.run, name='ai26-retention', daemon=True)
        self.thread.start()

    def run(self):
        while not self.stop_event.is_set():
            try: self.run_once()
            except Exception: log.exception('Retention cleanup failed; retrying next minute')
            self.stop_event.wait(60)

    def stop(self):
        self.stop_event.set()
        if self.thread: self.thread.join(timeout=30)
