import { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { generateSyntheticPose } from "../utils/mockPose";

export function usePoseDetection({ onFrame, exerciseType = "bicep_curl" }) {
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [facingMode, setFacingMode] = useState("user"); // 'user' | 'environment' (mobile support)
  const [fps, setFps] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });

  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameId = useRef(null);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(performance.now());

  // 1. Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    let isCancelled = false;

    async function initMediaPipe() {
      setIsLoadingModel(true);
      setModelError(null);

      try {
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks(`${window.location.origin}/wasm`);
        } catch (localWasmErr) {
          vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
        }

        if (isCancelled) return;

        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `${window.location.origin}/models/pose_landmarker_lite.task`,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch (localModelErr) {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        if (isCancelled) return;

        landmarkerRef.current = landmarker;
        setIsLoadingModel(false);
      } catch (err) {
        console.error("Failed to initialize MediaPipe PoseLandmarker:", err);
        if (!isCancelled) {
          setModelError(err.message || "Failed to load MediaPipe Pose model");
          setIsLoadingModel(false);
        }
      }
    }

    initMediaPipe();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  // 2. Camera Controls (with full resolution and mobile front/back camera support)
  const startCamera = useCallback(
    async (targetFacing = facingMode) => {
      setCameraError(null);
      try {
        if (isMockMode) {
          setIsCameraActive(true);
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Webcam API not supported in this browser environment.");
        }

        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            facingMode: targetFacing,
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setVideoDimensions({
                width: videoRef.current.videoWidth || 1280,
                height: videoRef.current.videoHeight || 720,
              });
            }
          };
          await videoRef.current.play();
        }
        setIsCameraActive(true);
        setFacingMode(targetFacing);
      } catch (err) {
        console.warn("Webcam access error:", err);
        setCameraError(err.name === "NotAllowedError" ? "Camera permission denied" : err.message);
        setIsCameraActive(false);
      }
    },
    [isMockMode, facingMode]
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const flipCamera = useCallback(() => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    if (isCameraActive) {
      startCamera(nextFacing);
    } else {
      setFacingMode(nextFacing);
    }
  }, [facingMode, isCameraActive, startCamera]);

  // 3. Pose Detection & Continuous Animation Loop
  useEffect(() => {
    let isRunning = true;

    const renderLoop = (time) => {
      if (!isRunning) return;

      frameCountRef.current += 1;
      const now = performance.now();
      if (now - fpsTimerRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - fpsTimerRef.current)));
        frameCountRef.current = 0;
        fpsTimerRef.current = now;
      }

      let detectedLandmarks = null;
      let detectedWorldLandmarks = null;

      if (isMockMode) {
        detectedLandmarks = generateSyntheticPose(now, exerciseType);
        detectedWorldLandmarks = detectedLandmarks;
      } else if (
        isCameraActive &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        landmarkerRef.current &&
        !videoRef.current.paused
      ) {
        try {
          const results = landmarkerRef.current.detectForVideo(videoRef.current, now);
          if (results && results.landmarks && results.landmarks.length > 0) {
            detectedLandmarks = results.landmarks[0];
            detectedWorldLandmarks = results.worldLandmarks?.[0] || null;
          }
        } catch (e) {}
      }

      if (onFrame) {
        onFrame({
          landmarks: detectedLandmarks,
          worldLandmarks: detectedWorldLandmarks,
          videoElement: isMockMode ? null : videoRef.current,
          timestamp: now,
          isMock: isMockMode,
        });
      }

      animFrameId.current = requestAnimationFrame(renderLoop);
    };

    if (isCameraActive || isMockMode) {
      animFrameId.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      isRunning = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isCameraActive, isMockMode, onFrame, exerciseType]);

  return {
    videoRef,
    isLoadingModel,
    modelError,
    isCameraActive,
    cameraError,
    fps,
    startCamera,
    stopCamera,
    flipCamera,
    facingMode,
    videoDimensions,
    isMockMode,
    setIsMockMode,
  };
}
