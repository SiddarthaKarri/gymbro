import { useState, useEffect, useRef, useCallback } from "react";

export function useKinematicWebSocket({
  targetFps = 25,
  onSetCompleted,
}) {
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [latestFeedback, setLatestFeedback] = useState(null);
  const [rttMs, setRttMs] = useState(0);
  const [streamStats, setStreamStats] = useState({
    sentFrames: 0,
    receivedFrames: 0,
    streamFps: 0,
  });
  const [activeSessionUuid, setActiveSessionUuid] = useState(null);
  const [isSetActive, setIsSetActive] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const lastSendTimeRef = useRef(0);
  const frameIndexRef = useRef(0);
  const sendIntervalMs = 1000 / targetFps;

  const sentCountInSecRef = useRef(0);
  const fpsTimerRef = useRef(performance.now());

  // Determine WebSocket URL dynamically (supports local, cloudflare tunnels, and direct IP)
  const getWebSocketUrl = useCallback(() => {
    const isHttps = window.location.protocol === "https:";
    const host = window.location.host;
    // If port 5173, Vite proxy handles /ws to 8000
    return `${isHttps ? "wss:" : "ws:"}//${host}/ws/pose`;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus("connecting");
    const wsUrl = getWebSocketUrl();

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnectionStatus("connected");
        console.log(`[Kinematic WS] Connected at ${wsUrl}`);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();

          // Handle Set Lifecycle Events (Phase 4)
          if (data.event === "set_started") {
            setActiveSessionUuid(data.session_uuid);
            setIsSetActive(true);
            return;
          }

          if (data.event === "set_completed") {
            setIsSetActive(false);
            if (data.session_summary && onSetCompleted) {
              onSetCompleted(data.session_summary);
            }
            return;
          }

          if (data.client_timestamp_ms) {
            const calculatedRtt = Math.max(0, Math.round(now - data.client_timestamp_ms));
            setRttMs(calculatedRtt);
          }

          setLatestFeedback(data);
          if (data.session_uuid) {
            setActiveSessionUuid(data.session_uuid);
            setIsSetActive(Boolean(data.is_set_active));
          }

          setStreamStats((prev) => ({
            ...prev,
            receivedFrames: prev.receivedFrames + 1,
          }));
        } catch (err) {
          console.error("[Kinematic WS] Message error:", err);
        }
      };

      socket.onerror = (err) => {
        console.warn("[Kinematic WS] Error on connection:", err);
        setConnectionStatus("error");
      };

      socket.onclose = () => {
        setConnectionStatus("disconnected");
        reconnectTimeoutRef.current = setTimeout(connect, 2500);
      };

      wsRef.current = socket;
    } catch (err) {
      console.error("[Kinematic WS] Connection exception:", err);
      setConnectionStatus("error");
      reconnectTimeoutRef.current = setTimeout(connect, 2500);
    }
  }, [getWebSocketUrl, onSetCompleted]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Start Workout Set (Phase 4)
  const startSet = useCallback((exerciseType = "bicep_curl", weight_kg = 0.0) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: "start_set",
        exercise_type: exerciseType,
        weight_kg: weight_kg
      }));
      setIsSetActive(true);
    }
  }, []);

  // End Workout Set (Phase 4)
  const endSet = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: "end_set"
      }));
    }
  }, []);

  // Stream pose coordinates at ~25 FPS
  const streamPoseCoordinates = useCallback(
    ({ keyJoints, rawLandmarks, worldLandmarks, exerciseType = "bicep_curl", weight_kg = 0.0 }) => {
      const now = performance.now();

      if (now - lastSendTimeRef.current < sendIntervalMs) {
        return false;
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      lastSendTimeRef.current = now;
      frameIndexRef.current += 1;
      sentCountInSecRef.current += 1;

      if (now - fpsTimerRef.current >= 1000) {
        const streamFps = Math.round(
          (sentCountInSecRef.current * 1000) / (now - fpsTimerRef.current)
        );
        setStreamStats((prev) => ({
          ...prev,
          streamFps,
        }));
        sentCountInSecRef.current = 0;
        fpsTimerRef.current = now;
      }

      const payload = {
        frame_index: frameIndexRef.current,
        client_timestamp_ms: Date.now(),
        exercise_type: exerciseType,
        weight_kg: weight_kg || 0.0,
        key_joints: keyJoints,
        world_landmarks: worldLandmarks ? worldLandmarks.slice(0, 33) : null,
      };

      try {
        wsRef.current.send(JSON.stringify(payload));
        setStreamStats((prev) => ({
          ...prev,
          sentFrames: prev.sentFrames + 1,
        }));
        return true;
      } catch (err) {
        return false;
      }
    },
    [sendIntervalMs]
  );

  return {
    connectionStatus,
    latestFeedback,
    rttMs,
    streamStats,
    isSetActive,
    activeSessionUuid,
    reconnect: connect,
    startSet,
    endSet,
    streamPoseCoordinates,
  };
}
