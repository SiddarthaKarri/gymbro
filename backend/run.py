import uvicorn

if __name__ == "__main__":
    print("Starting Kinematic Pose Estimation Backend on http://127.0.0.1:8000...")
    print("WebSocket endpoint: ws://127.0.0.1:8000/ws/pose")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, log_level="info")
