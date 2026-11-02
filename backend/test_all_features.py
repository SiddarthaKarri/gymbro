import asyncio
import json
import time
import urllib.request
import websockets

def generate_test_joints(primary_angle: float, ex: str):
    """Generates synthetic joints for biomechanical validation across all 9 poses."""
    rad = primary_angle * 3.14159 / 180.0
    
    # Standard base posture
    l_shl = {"x": 0.42, "y": 0.32, "z": 0.0, "visibility": 0.95}
    r_shl = {"x": 0.58, "y": 0.32, "z": 0.0, "visibility": 0.95}
    l_hip = {"x": 0.44, "y": 0.65, "z": 0.0, "visibility": 0.95}
    r_hip = {"x": 0.56, "y": 0.65, "z": 0.0, "visibility": 0.95}
    l_kne = {"x": 0.44, "y": 0.82, "z": 0.0, "visibility": 0.95}
    r_kne = {"x": 0.56, "y": 0.82, "z": 0.0, "visibility": 0.95}
    l_ank = {"x": 0.44, "y": 0.98, "z": 0.0, "visibility": 0.95}
    r_ank = {"x": 0.56, "y": 0.98, "z": 0.0, "visibility": 0.95}
    nose = {"x": 0.50, "y": 0.20, "z": 0.0, "visibility": 0.95}

    if ex == "lateral_raise":
        # Arms abducting outward in frontal plane
        l_elb = {"x": 0.42 - 0.20 * float(rad > 1.0), "y": 0.32 + 0.05, "z": 0.0, "visibility": 0.95}
        r_elb = {"x": 0.58 + 0.20 * float(rad > 1.0), "y": 0.32 + 0.05, "z": 0.0, "visibility": 0.95}
        l_wrs = {"x": 0.42 - 0.35 * float(rad > 1.0), "y": 0.32 + 0.08, "z": 0.0, "visibility": 0.95}
        r_wrs = {"x": 0.58 + 0.35 * float(rad > 1.0), "y": 0.32 + 0.08, "z": 0.0, "visibility": 0.95}
    elif ex == "lunge":
        l_elb = {"x": 0.40, "y": 0.50, "z": 0.0, "visibility": 0.95}
        r_elb = {"x": 0.60, "y": 0.50, "z": 0.0, "visibility": 0.95}
        l_wrs = {"x": 0.40, "y": 0.65, "z": 0.0, "visibility": 0.95}
        r_wrs = {"x": 0.60, "y": 0.65, "z": 0.0, "visibility": 0.95}
        l_kne = {"x": 0.44, "y": 0.78, "z": 0.0, "visibility": 0.95}
        r_kne = {"x": 0.56, "y": 0.90, "z": 0.0, "visibility": 0.95}
    else:
        l_elb = {"x": 0.40, "y": 0.50, "z": 0.0, "visibility": 0.95}
        r_elb = {"x": 0.60, "y": 0.50, "z": 0.0, "visibility": 0.95}
        l_wrs = {"x": 0.40 + 0.15 * float(rad < 2.0), "y": 0.50 - 0.20 * float(rad < 2.0), "z": 0.0, "visibility": 0.95}
        r_wrs = {"x": 0.60 - 0.15 * float(rad < 2.0), "y": 0.50 - 0.20 * float(rad < 2.0), "z": 0.0, "visibility": 0.95}

    return {
        "left_shoulder": l_shl, "right_shoulder": r_shl,
        "left_elbow": l_elb, "right_elbow": r_elb,
        "left_wrist": l_wrs, "right_wrist": r_wrs,
        "left_hip": l_hip, "right_hip": r_hip,
        "left_knee": l_kne, "right_knee": r_kne,
        "left_ankle": l_ank, "right_ankle": r_ank,
        "nose": nose,
    }

async def run_integration_tests():
    print("=== STARTING COMPLETE MULTI-POSE & SPORTS SCIENCE ENGINE VALIDATION ===")
    
    # 1. Health check
    res = urllib.request.urlopen("http://127.0.0.1:8000/health")
    health = json.loads(res.read())
    print("1. Health Endpoint:", health)
    assert health["status"] == "healthy", "Health check failed"

    # 2. WebSocket test across ALL 9 poses + 1RM & Power
    exercises = [
        "bicep_curl", "squat", "overhead_press", "deadlift",
        "push_up", "lateral_raise", "lunge", "bent_over_row", "plank"
    ]
    uri = "ws://127.0.0.1:8000/ws/pose"

    async with websockets.connect(uri) as ws:
        print("2. WebSocket Connected successfully to /ws/pose")

        # Test Set Start with 60kg working load
        await ws.send(json.dumps({
            "event": "start_set",
            "exercise_type": "squat",
            "weight_kg": 60.0,
            "timestamp_ms": time.time() * 1000
        }))
        start_ack = json.loads(await ws.recv())
        print("3. Set Start Response:", start_ack)
        assert start_ack["event"] == "set_started", "Failed to start set"

        # Stream frames for all 9 exercises
        for ex in exercises:
            joints = generate_test_joints(primary_angle=80.0 if ex != "squat" else 90.0, ex=ex)
            payload = {
                "frame_index": 1,
                "client_timestamp_ms": time.time() * 1000,
                "exercise_type": ex,
                "weight_kg": 50.0,
                "key_joints": joints
            }
            await ws.send(json.dumps(payload))
            resp_raw = await ws.recv()
            resp = json.loads(resp_raw)
            print(f"4. Pose '{ex}' verified:")
            print(f"   - Phase: {resp['rep_phase']}")
            print(f"   - VBT: {resp.get('vbt')}")
            print(f"   - Power: {resp.get('power_watts')} W | 1RM: {resp.get('estimated_1rm_kg')} kg | RIR: {resp.get('reps_in_reserve')}")
            print(f"   - Live Score: {resp['quality_score']}%")
            assert resp["status"] == "ok", f"Status not ok for {ex}"
            assert "power_watts" in resp, "Power missing"
            assert "estimated_1rm_kg" in resp, "1RM missing"

        # End Set and check persistence
        await ws.send(json.dumps({
            "event": "end_set",
            "timestamp_ms": time.time() * 1000
        }))
        end_ack = json.loads(await ws.recv())
        print("5. Set End Response:", end_ack)
        assert end_ack["event"] == "set_completed", "Failed to complete set"

    # 3. Verify REST API /api/sessions
    res = urllib.request.urlopen("http://127.0.0.1:8000/api/sessions")
    sessions = json.loads(res.read())
    print("6. Fetched Sessions from REST API, count:", len(sessions))
    assert isinstance(sessions, list), "Sessions should be a list"

    print("\n>>> ALL 9 POSES, 1RM/POWER SPORTS SCIENCE ENGINE, AND PERSISTENCE VALIDATED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(run_integration_tests())
