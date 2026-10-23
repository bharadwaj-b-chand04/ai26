"""Startup inference-branch switches must avoid work when a branch is off."""
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ['AI26_PROCESSING_ENABLED']='0'
sys.path.insert(0,str(__import__('pathlib').Path(__file__).resolve().parents[1]/'backend'))
import processing


class InferenceBranches(unittest.TestCase):
    def test_disabled_branches_return_without_importing_models(self):
        frame=object()
        with patch.object(processing,'VEHICLE_DETECTION_ENABLED',False), \
             patch.object(processing,'PLATE_RECOGNITION_ENABLED',False), \
             patch.dict(sys.modules,{'inference':None}):
            self.assertEqual(processing.annotate(frame,'vehicle','CAM-01'),(frame,[]))
            self.assertEqual(processing.annotate(frame,'plate','CAM-07'),(frame,[]))

    def test_plate_recognition_can_run_without_vehicle_detector(self):
        frame=SimpleNamespace(copy=lambda:'raw')
        plate_frame=object();plate={'kind':'plate'}
        module=SimpleNamespace(annotate_plate_frame=lambda raw,camera:(plate_frame,[plate]))
        with patch.object(processing,'VEHICLE_DETECTION_ENABLED',False), \
             patch.object(processing,'PLATE_RECOGNITION_ENABLED',True), \
             patch.dict(sys.modules,{'inference':module}):
            self.assertEqual(processing.annotate(frame,'plate','CAM-07'),(plate_frame,[plate]))

    def test_vehicle_detection_can_run_without_plate_recognition(self):
        frame=SimpleNamespace(copy=lambda:'raw')
        vehicle_frame=object();vehicle={'kind':'vehicle'}
        module=SimpleNamespace(annotate_vehicle_frame=lambda original,camera:(vehicle_frame,[vehicle]),
                               take_person_boxes=lambda camera:[])
        with patch.object(processing,'VEHICLE_DETECTION_ENABLED',True), \
             patch.object(processing,'PLATE_RECOGNITION_ENABLED',False), \
             patch.dict(sys.modules,{'inference':module}):
            self.assertEqual(processing.annotate(frame,'plate','CAM-07'),(vehicle_frame,[vehicle]))

    def test_combined_plate_and_vehicle_branches_keep_both_overlays(self):
        import numpy as np
        raw=np.zeros((12,12,3),dtype=np.uint8)
        vehicle_frame=raw.copy()
        vehicle_frame[2:5,2]=[0,255,0]
        plate_frame=raw.copy()
        plate_frame[7:10,7]=[0,0,255]
        vehicle={'kind':'vehicle','bbox':[2,2,5,5]}
        plate={'kind':'plate','bbox':[7,7,10,10]}
        module=SimpleNamespace(
            annotate_vehicle_frame=lambda original,camera:(vehicle_frame,[vehicle]),
            take_person_boxes=lambda camera:[],
            annotate_plate_frame=lambda original,camera:(plate_frame,[plate]),
        )
        with patch.object(processing,'VEHICLE_DETECTION_ENABLED',True), \
             patch.object(processing,'PLATE_RECOGNITION_ENABLED',True), \
             patch.dict(sys.modules,{'inference':module}):
            annotated,detections=processing.annotate(raw.copy(),'plate','CAM-07')
        self.assertTrue(np.array_equal(annotated[3,2],[0,255,0]))
        self.assertTrue(np.array_equal(annotated[8,7],[0,0,255]))
        self.assertEqual(detections,[plate,vehicle])

    def test_privacy_mode_rejects_disabling_person_detection_branch(self):
        with patch.object(processing,'VEHICLE_DETECTION_ENABLED',False), \
             patch('privacy.enabled',return_value=True):
            with self.assertRaisesRegex(RuntimeError,'requires the vehicle/person detection branch'):
                processing.validate_branch_configuration()

    def test_branch_switch_accepts_only_explicit_zero_or_one(self):
        with patch.dict(os.environ,{'AI26_TEST_BRANCH_SWITCH':'0'}):
            self.assertFalse(processing._branch_switch('AI26_TEST_BRANCH_SWITCH'))
        with patch.dict(os.environ,{'AI26_TEST_BRANCH_SWITCH':'1'}):
            self.assertTrue(processing._branch_switch('AI26_TEST_BRANCH_SWITCH'))
        with patch.dict(os.environ,{'AI26_TEST_BRANCH_SWITCH':'yes'}):
            with self.assertRaisesRegex(RuntimeError,'must be 0 or 1'):
                processing._branch_switch('AI26_TEST_BRANCH_SWITCH')


if __name__=='__main__':
    unittest.main()
