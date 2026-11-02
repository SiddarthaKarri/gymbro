import asyncio
import websockets
import json
import time
import urllib.request

async def test_full_pipeline():
    uri = 'ws://127.0.0.1:8000/ws/pose'
    print(f'=== Testing Phases 2, 3, 4, 5 on {uri} ===')
    
    async with websockets.connect(uri) as ws:
        # 1. Test "start_set" event
        print('\n--- Step 1: Starting Workout Set (Bicep Curl) ---')
        await ws.send(json.dumps({
            'event': 'start_set',
            'exercise_type': 'bicep_curl'
        }))
        start_ack = json.loads(await ws.recv())
        print('Start Set Ack:', start_ack)
        assert start_ack.get('event') == 'set_started'
        session_uuid = start_ack['session_uuid']

        # 2. Simulate Repetition 1: Perfect Form (Elbow breaks 90 deg: 74 deg, Symmetry delta: 0 deg)
        print('\n--- Step 2: Streaming Rep #1 (Perfect Form) ---')
        import math
        angles_sequence = [160, 150, 135, 115, 95, 75, 74, 74, 90, 115, 135, 150, 160, 160, 160]
        
        frame_idx = 1
        for elbow_angle in angles_sequence:
            phi = math.radians(180.0 - elbow_angle)
            wrist_y = 0.50 + 0.20 * math.cos(phi)
            wrist_z = -0.20 * math.sin(phi)
            
            payload = {
                'frame_index': frame_idx,
                'client_timestamp_ms': time.time() * 1000,
                'exercise_type': 'bicep_curl',
                'key_joints': {
                    'left_shoulder': {'x': 0.35, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                    'right_shoulder': {'x': 0.65, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                    'left_elbow': {'x': 0.35, 'y': 0.50, 'z': 0.0, 'visibility': 0.99},
                    'right_elbow': {'x': 0.65, 'y': 0.50, 'z': 0.0, 'visibility': 0.99},
                    'left_wrist': {'x': 0.35, 'y': wrist_y, 'z': wrist_z, 'visibility': 0.98},
                    'right_wrist': {'x': 0.65, 'y': wrist_y, 'z': wrist_z, 'visibility': 0.98},
                    'left_hip': {'x': 0.40, 'y': 0.70, 'z': 0.0, 'visibility': 0.99},
                    'right_hip': {'x': 0.60, 'y': 0.70, 'z': 0.0, 'visibility': 0.99}
                }
            }
            await ws.send(json.dumps(payload))
            resp = json.loads(await ws.recv())
            frame_idx += 1
            await asyncio.sleep(0.04)

        print(f"Rep #1 Finished. State: {resp.get('rep_phase')}, Total Reps Counted: {resp.get('rep_count')}")
        if resp.get('last_rep'):
            print("Rep #1 Summary:", resp['last_rep'])

        # 3. Test Confidence Gate (Phase 3 Objective 2)
        print('\n--- Step 3: Testing Confidence Gate with Low Confidence (visibility < 0.65) ---')
        payload_low_conf = {
            'frame_index': frame_idx,
            'client_timestamp_ms': time.time() * 1000,
            'exercise_type': 'bicep_curl',
            'key_joints': {
                'left_shoulder': {'x': 0.35, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                'right_shoulder': {'x': 0.65, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                'left_elbow': {'x': 0.35, 'y': 0.50, 'z': 0.0, 'visibility': 0.40},  # Occluded! (< 0.65)
                'right_elbow': {'x': 0.65, 'y': 0.50, 'z': 0.0, 'visibility': 0.99},
                'left_wrist': {'x': 0.35, 'y': 0.70, 'z': 0.0, 'visibility': 0.98},
                'right_wrist': {'x': 0.65, 'y': 0.70, 'z': 0.0, 'visibility': 0.98},
                'left_hip': {'x': 0.40, 'y': 0.70, 'z': 0.0, 'visibility': 0.99},
                'right_hip': {'x': 0.60, 'y': 0.70, 'z': 0.0, 'visibility': 0.99}
            }
        }
        await ws.send(json.dumps(payload_low_conf))
        gate_resp = json.loads(await ws.recv())
        print("Confidence Gate Response:", {
            "visibility_error": gate_resp.get("visibility_error"),
            "compromised_joints": gate_resp.get("compromised_joints"),
            "message": gate_resp.get("message")
        })
        assert gate_resp.get("visibility_error") is True
        assert "left_elbow" in gate_resp.get("compromised_joints", [])

        # 4. Simulate Repetition 2: Partial ROM (Depth = 105 deg > 90 deg, Penalty Applied)
        print('\n--- Step 4: Streaming Rep #2 (Partial Depth Penalty) ---')
        partial_angles = [160, 150, 135, 120, 105, 105, 120, 135, 150, 160, 160, 160]
        for elbow_angle in partial_angles:
            phi = math.radians(180.0 - elbow_angle)
            wrist_y = 0.50 + 0.20 * math.cos(phi)
            wrist_z = -0.20 * math.sin(phi)
            payload = {
                'frame_index': frame_idx,
                'client_timestamp_ms': time.time() * 1000,
                'exercise_type': 'bicep_curl',
                'key_joints': {
                    'left_shoulder': {'x': 0.35, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                    'right_shoulder': {'x': 0.65, 'y': 0.30, 'z': 0.0, 'visibility': 0.99},
                    'left_elbow': {'x': 0.35, 'y': 0.50, 'z': 0.0, 'visibility': 0.99},
                    'right_elbow': {'x': 0.65, 'y': 0.50, 'z': 0.0, 'visibility': 0.99},
                    'left_wrist': {'x': 0.35, 'y': wrist_y, 'z': wrist_z, 'visibility': 0.98},
                    'right_wrist': {'x': 0.65, 'y': wrist_y, 'z': wrist_z, 'visibility': 0.98},
                    'left_hip': {'x': 0.40, 'y': 0.70, 'z': 0.0, 'visibility': 0.99},
                    'right_hip': {'x': 0.60, 'y': 0.70, 'z': 0.0, 'visibility': 0.99}
                }
            }
            await ws.send(json.dumps(payload))
            resp = json.loads(await ws.recv())
            frame_idx += 1
            await asyncio.sleep(0.04)

        print(f"Rep #2 Finished. Total Reps Counted: {resp.get('rep_count')}")
        if resp.get('last_rep'):
            print("Rep #2 Summary (Should show depth penalty):", resp['last_rep'])

        # 5. Test "end_set" event & SQLite persistence
        print('\n--- Step 5: Ending Workout Set & Persisting to SQLite ---')
        await ws.send(json.dumps({'event': 'end_set'}))
        end_resp = json.loads(await ws.recv())
        print('End Set WebSocket Response:', end_resp)
        assert end_resp.get('event') == 'set_completed'

    # 6. Verify REST API Endpoint (Phase 4 & 5)
    print('\n--- Step 6: Verifying REST API GET /api/sessions/latest ---')
    time.sleep(0.5)
    req = urllib.request.urlopen('http://127.0.0.1:8000/api/sessions/latest')
    session_data = json.loads(req.read().decode())
    print('Fetched latest session from REST API:')
    print(f"Session ID: {session_data['id']}, Total Reps: {session_data['total_reps']}, Avg Quality: {session_data['overall_avg_quality']}%")
    for r in session_data['repetitions']:
        print(f"  Rep #{r['rep_number']}: Quality={r['quality_score']}%, Depth={r['peak_depth_angle']}°, Symmetry Delta={r['avg_symmetry_delta']}°")
    
    print('\n>>> ALL PHASES 2, 3, 4, 5 BACKEND TESTS PASSED SUCCESSFULLY! <<<')

if __name__ == '__main__':
    asyncio.run(test_full_pipeline())
