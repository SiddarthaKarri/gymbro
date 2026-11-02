import React, { useEffect, useRef } from "react";
import {
  drawKinematicExoskeleton,
  drawDirectionalCues,
  drawTargetFormGhost,
  drawBarPathTrajectory
} from "../utils/drawing";
import { analyzeFormCorrections } from "../utils/coachingEngine";
import { playRepCompletionChime, playFormWarningBeep } from "../utils/soundEffects";
import {
  Camera, AlertTriangle, Sparkles, Shield, Compass,
  Volume2, VolumeX, SwitchCamera, Maximize2
} from "lucide-react";

export function PoseCanvas({
  videoRef, landmarks, isCameraActive, isLoadingModel, isMockMode,
  exerciseType = "bicep_curl", angles = null, vbt = null,
  injuryRisk = "LOW", visibilityError = false, compromisedJoints = [],
  repPhase = "LOCKOUT", repCount = 0,
  showWireframe = true, visualStyle = "exoskeleton", setVisualStyle,
  isVoiceEnabled = true, setIsVoiceEnabled, isSoundEnabled = true,
  videoDimensions = { width: 1280, height: 720 },
  facingMode = "user", onFlipCamera, onStartCamera, onStopCamera, onToggleMock,
}) {
  const canvasRef         = useRef(null);
  const containerRef      = useRef(null);
  const lastSpokenRef     = useRef({ text: "", time: 0 });
  const coachingStateRef  = useRef({ mainCue: "", cueSeverity: "info", targetCorrections: [] });
  const barTrajectoryRef  = useRef([]);
  const prevRepCountRef   = useRef(repCount);
  const prevInjuryRef     = useRef(injuryRisk);

  // Sound effects
  useEffect(() => {
    if (!isSoundEnabled) return;
    if (repCount > prevRepCountRef.current && repCount > 0) playRepCompletionChime();
    prevRepCountRef.current = repCount;
  }, [repCount, isSoundEnabled]);

  useEffect(() => {
    if (!isSoundEnabled) return;
    if (injuryRisk === "HIGH" && prevInjuryRef.current !== "HIGH") playFormWarningBeep();
    prevInjuryRef.current = injuryRisk;
  }, [injuryRisk, isSoundEnabled]);

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  const handleToggleVoice = () => {
    setIsVoiceEnabled?.(v => {
      const next = !v;
      if (next && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance("Voice coach active");
          u.rate = 1.1;
          window.speechSynthesis.speak(u);
        } catch (_) {}
      }
      return next;
    });
  };

  // Bar path tracking
  useEffect(() => {
    if (!landmarks || landmarks.length < 17) { barTrajectoryRef.current = []; return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas;

    if (repPhase === "LOCKOUT" && barTrajectoryRef.current.length > 60) {
      barTrajectoryRef.current = [];
    }

    const lWrs = landmarks[15], rWrs = landmarks[16];
    if (lWrs && rWrs) {
      let midX = (lWrs.x + rWrs.x) / 2;
      if (isCameraActive && !isMockMode && facingMode === "user") midX = 1.0 - midX;
      barTrajectoryRef.current.push({ x: midX * width, y: ((lWrs.y + rWrs.y) / 2) * height, time: performance.now() });
      if (barTrajectoryRef.current.length > 45) barTrajectoryRef.current.shift();
    }
  }, [landmarks, repPhase, isCameraActive, isMockMode, facingMode]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w   = videoDimensions?.width  || 1280;
    const h   = videoDimensions?.height || 720;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    ctx.clearRect(0, 0, w, h);

    // Draw background / camera feed
    if (isCameraActive && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.save();
      if (facingMode === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.02)";
      ctx.fillRect(0, 0, w, h);
    } else if (isMockMode) {
      ctx.fillStyle = "#080c14";
      ctx.fillRect(0, 0, w, h);
      // Subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.font = "500 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(99,102,241,0.4)";
      ctx.fillText("DEMO — Synthetic pose stream", 20, 30);
    } else {
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, w, h);
    }

    // Mirror landmarks for live camera
    let lmDraw = landmarks;
    if (landmarks && isCameraActive && !isMockMode && facingMode === "user") {
      lmDraw = landmarks.map(lm => ({ ...lm, x: 1.0 - lm.x }));
    }

    if (lmDraw) {
      const coaching = analyzeFormCorrections({ angles, repPhase, exerciseType, landmarks: lmDraw, width: w, height: h, vbt, injuryRisk });
      coachingStateRef.current = coaching;

      // Voice coaching
      if (isVoiceEnabled && coaching.voiceCue && window.speechSynthesis) {
        const now  = performance.now();
        const diff = now - lastSpokenRef.current.time;
        if ((coaching.voiceCue !== lastSpokenRef.current.text && diff > 2200) || diff > 3800) {
          lastSpokenRef.current = { text: coaching.voiceCue, time: now };
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(coaching.voiceCue);
            u.rate = 1.05; u.pitch = 1.02; u.lang = "en-US";
            window.speechSynthesis.speak(u);
          } catch (_) {}
        }
      }

      if (showWireframe) {
        drawBarPathTrajectory(ctx, barTrajectoryRef.current);
        if (visualStyle === "ghost" || visualStyle === "exoskeleton") {
          drawTargetFormGhost(ctx, lmDraw, w, h, exerciseType);
        }
        drawKinematicExoskeleton(ctx, lmDraw, w, h, { repPhase, angles, compromisedJoints, showAngles: true, exerciseType });
        drawDirectionalCues(ctx, coaching.targetCorrections);
      }
    }
  }, [landmarks, isCameraActive, isMockMode, showWireframe, videoRef, compromisedJoints, angles, exerciseType, repPhase, visualStyle, isVoiceEnabled, videoDimensions, facingMode]);

  const coaching    = coachingStateRef.current;
  const isWarning   = coaching.cueSeverity === "warn";
  const isSuccess   = coaching.cueSeverity === "success";
  const isStreaming = isCameraActive || isMockMode;

  return (
    <div className="canvas-wrapper full-view-mode" ref={containerRef}>
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />

      <canvas
        ref={canvasRef}
        width={videoDimensions.width}
        height={videoDimensions.height}
        className="kinematic-canvas full-camera-canvas"
      />

      {/* Corner accents */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />

      {/* Top bar */}
      <div className="canvas-top-bar">
        <div className="stream-badge">
          <span className={`status-dot ${isCameraActive ? "status-active" : isMockMode ? "status-sim" : "status-idle"}`} />
          <span className="badge-text">
            {isCameraActive ? "Camera live" : isMockMode ? "Demo mode" : "Standby"}
          </span>
        </div>

        {isStreaming && (
          <div className="canvas-rep-telemetry">
            <div className={`canvas-phase-tag phase-${repPhase.toLowerCase()}`}>{repPhase}</div>
            <div className="canvas-rep-badge">Rep {String(repCount).padStart(2, "0")}</div>
            {injuryRisk === "HIGH" && (
              <div className="injury-risk-pill-active">⚠ Form alert</div>
            )}
          </div>
        )}

        <div className="canvas-mode-controls">
          {isCameraActive && (
            <button className="canvas-mode-btn" onClick={onFlipCamera} title="Flip camera">
              <SwitchCamera size={13} />
              <span className="hide-on-mobile">{facingMode === "user" ? "Front" : "Rear"}</span>
            </button>
          )}
          <button
            className={`canvas-mode-btn ${visualStyle === "exoskeleton" ? "mode-active" : ""}`}
            onClick={() => setVisualStyle?.("exoskeleton")} title="Skeleton overlay"
          >
            <Shield size={13} />
            <span className="hide-on-mobile">Skeleton</span>
          </button>
          <button
            className={`canvas-mode-btn ${visualStyle === "ghost" ? "mode-active" : ""}`}
            onClick={() => setVisualStyle?.("ghost")} title="Target ghost overlay"
          >
            <Compass size={13} />
            <span className="hide-on-mobile">Ghost</span>
          </button>
          <button className="canvas-mode-btn" onClick={handleToggleVoice} title="Toggle voice coaching">
            {isVoiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="hide-on-mobile">{isVoiceEnabled ? "Voice on" : "Voice off"}</span>
          </button>
          <button className="canvas-mode-btn" onClick={handleFullscreen} title="Fullscreen">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Coaching ribbon */}
      {isStreaming && coaching.mainCue && (
        <div className="canvas-coaching-ribbon">
          <div className={`coaching-pill ${isWarning ? "pill-warning" : isSuccess ? "pill-success" : "pill-info"}`}>
            <span className="pill-tag">{isWarning ? "Correction" : isSuccess ? "Form ✓" : "Tip"}</span>
            <span className="pill-message">{coaching.mainCue}</span>
          </div>
        </div>
      )}

      {/* Visibility/confidence alert */}
      {visibilityError && (
        <div className="confidence-gate-overlay">
          <div className="gate-alert-pill">
            <AlertTriangle className="gate-icon" size={15} />
            <div>
              <div className="gate-title">Tracking limited</div>
              <div className="gate-desc">
                Can't see: <span className="gate-highlight">{compromisedJoints.map(j => j.replace("_", " ")).join(", ")}</span>. Scoring paused.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isCameraActive && !isMockMode && (
        <div className="canvas-empty-state">
          <div className="empty-state-card">
            <div className="empty-icon-circle">
              <Camera size={28} />
            </div>
            <h3>No active session</h3>
            <p>Start your camera to begin tracking, or run the demo to see how it works without a camera.</p>
            <div className="empty-state-actions">
              <button className="btn btn-primary" onClick={onStartCamera} disabled={isLoadingModel}>
                <Camera size={14} />
                {isLoadingModel ? "Loading model…" : "Start Camera"}
              </button>
              <button className="btn btn-secondary" onClick={onToggleMock}>
                <Sparkles size={14} /> Run Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
