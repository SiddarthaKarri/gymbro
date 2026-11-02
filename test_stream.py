import asyncio
import websockets
import json
import time

async def test_25fps_stream():
    uri = 'ws://127.0.0.1:8000/ws/pose'
    print(f'Connecting to {uri}...')
    async with websockets.connect(uri) as ws:
        print('Connected successfully!')
        
        latencies = []
        for i in range(1, 26):
            t_client = time.time() * 1000
            payload = {
                'frame_index': i,
                'client_timestamp_ms': t_client,
                'exercise_type': 'squat',
                'key_joints': {
                    'left_shoulder': {'x': 0.36, 'y': 0.30, 'z': -0.05, 'visibility': 0.99},
                    'right_shoulder': {'x': 0.64, 'y': 0.30, 'z': 0.05, 'visibility': 0.99},
                    'left_elbow': {'x': 0.30, 'y': 0.44, 'z': -0.10, 'visibility': 0.98},
                    'right_elbow': {'x': 0.70, 'y': 0.44, 'z': 0.02, 'visibility': 0.98},
                    'left_wrist': {'x': 0.32, 'y': 0.58, 'z': -0.15, 'visibility': 0.97},
                    'right_wrist': {'x': 0.68, 'y': 0.58, 'z': -0.05, 'visibility': 0.97},
                    'left_hip': {'x': 0.41, 'y': 0.58, 'z': -0.02, 'visibility': 0.99},
                    'right_hip': {'x': 0.59, 'y': 0.58, 'z': 0.02, 'visibility': 0.99}
                }
            }
            await ws.send(json.dumps(payload))
            resp = await ws.recv()
            t_recv = time.time() * 1000
            data = json.loads(resp)
            rtt = t_recv - t_client
            latencies.append(rtt)
            
            if i in [1, 10, 20, 25]:
                print(f'Frame #{data["frame_index"]}: Quality Score={data["quality_score"]}, Server Proc={data["processing_time_ms"]}ms, RTT={rtt:.2f}ms, Status="{data["message"]}"')
            
            await asyncio.sleep(0.04) # ~25 FPS interval
            
        avg_rtt = sum(latencies) / len(latencies)
        print(f'Streaming test passed! 25 frames sent and received. Average RTT: {avg_rtt:.2f}ms')

if __name__ == '__main__':
    asyncio.run(test_25fps_stream())
