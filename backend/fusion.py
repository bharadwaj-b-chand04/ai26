"""Conservative per-track consensus; conflicting reads abstain, never copy another identity."""
from collections import defaultdict, deque

class PlateConsensus:
    def __init__(self, minimum_reads=3, window=8):
        self.minimum_reads = minimum_reads
        self.window = window
        self.history = defaultdict(lambda: deque(maxlen=window))

    def read(self, camera, track, plate):
        history = self.history[(camera, track)]
        history.append(plate)
        if len(set(history)) > 1:
            return {'identity_status': 'conflicting', 'fused_plate': None, 'supporting_reads': len(history)}
        supported = len(history) >= self.minimum_reads
        return {'identity_status': 'supported' if supported else 'tentative',
                'fused_plate': plate if supported else None, 'supporting_reads': len(history)}

    def reset(self, camera):
        for key in list(self.history):
            if key[0] == camera: del self.history[key]

    def retain(self, camera, active_tracks):
        for key in list(self.history):
            if key[0] == camera and key[1] not in active_tracks: del self.history[key]
