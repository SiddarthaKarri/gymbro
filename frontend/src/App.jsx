import React, { useState, useCallback } from "react";
import { usePoseDetection }         from "./hooks/usePoseDetection";
import { useKinematicWebSocket }    from "./hooks/useKinematicWebSocket";
import { extractKeyJoints }         from "./utils/drawing";
import { Navbar }                   from "./components/Navbar";
import { LandingPage }              from "./components/LandingPage";
import { PoseCanvas }               from "./components/PoseCanvas";
import { TelemetryHUD }             from "./components/TelemetryHUD";
import { ReferencePostureCoach }    from "./components/ReferencePostureCoach";
import { PostWorkoutDashboard }     from "./components/PostWorkoutDashboard";
import { ResearchGapsView }         from "./components/ResearchGapsView";
import { ExerciseLibraryView }      from "./components/ExerciseLibraryView";
import { SessionHistoryView }       from "./components/SessionHistoryView";
import { Columns, Camera, BookOpen } from "lucide-react";

export function App() {
  /* ─── Global state ────────────────────────────────────── */
  const [exerciseType,       setExerciseType]       = useState("bicep_curl");
  const [showWireframe,      setShowWireframe]       = useState(true);
  const [visualStyle,        setVisualStyle]         = useState("exoskeleton");
  const [isVoiceEnabled,     setIsVoiceEnabled]      = useState(true);
  const [isSoundEnabled,     setIsSoundEnabled]      = useState(true);
  const [weightKg,           setWeightKg]            = useState(40);
  const [activeTab,          setActiveTab]           = useState("overview");
  const [studioViewMode,     setStudioViewMode]      = useState("split");
  const [currentLandmarks,   setCurrentLandmarks]    = useState(null);
  const [completedSession,   setCompletedSession]    = useState(null);

  /* ─── Set completion handler ──────────────────────────── */
  const handleSetCompleted = useCallback((summary) => {
    setCompletedSession(summary);
    setActiveTab("analytics");
  }, []);

  /* ─── WebSocket pipeline ──────────────────────────────── */
  const {
    connectionStatus, latestFeedback, rttMs, streamStats,
    isSetActive, startSet, endSet, reconnect, streamPoseCoordinates,
  } = useKinematicWebSocket({ targetFps: 25, onSetCompleted: handleSetCompleted });

  /* ─── MediaPipe frame handler ─────────────────────────── */
  const handleFrame = useCallback(({ landmarks, worldLandmarks }) => {
    setCurrentLandmarks(landmarks);
    if (landmarks) {
      streamPoseCoordinates({
        keyJoints:      extractKeyJoints(landmarks),
        rawLandmarks:   landmarks,
        worldLandmarks,
        exerciseType,
        weight_kg:      weightKg,
      });
    }
  }, [streamPoseCoordinates, exerciseType, weightKg]);

  /* ─── Pose detection hook ─────────────────────────────── */
  const {
    videoRef, isLoadingModel, modelError, isCameraActive, cameraError,
    fps: clientFps, startCamera, stopCamera, flipCamera, facingMode,
    videoDimensions, isMockMode, setIsMockMode,
  } = usePoseDetection({ onFrame: handleFrame, exerciseType });

  const toggleMock = () => { if (isCameraActive) stopCamera(); setIsMockMode(p => !p); };

  /* ─── Navigation helpers ──────────────────────────────── */
  const handleLaunchLive = (targetEx = null) => {
    if (targetEx) setExerciseType(targetEx);
    if (isMockMode) setIsMockMode(false);
    startCamera();
    setActiveTab("live");
  };

  const handleLaunchSimulation = (targetEx = null) => {
    if (targetEx) setExerciseType(targetEx);
    if (isCameraActive) stopCamera();
    setIsMockMode(true);
    setActiveTab("live");
  };

  /* ─── Derived values ──────────────────────────────────── */
  const angles          = latestFeedback?.angles          || null;
  const vbt             = latestFeedback?.vbt             || null;
  const injuryRisk      = latestFeedback?.injury_risk     || "LOW";
  const visibilityError = Boolean(latestFeedback?.visibility_error);
  const compromisedJoints = latestFeedback?.compromised_joints || [];
  const repPhase        = latestFeedback?.rep_phase       ?? "LOCKOUT";
  const repCount        = latestFeedback?.rep_count       ?? 0;

  /* ─── Shared PoseCanvas props ─────────────────────────── */
  const poseCanvasProps = {
    videoRef, landmarks: currentLandmarks, isCameraActive, isLoadingModel,
    isMockMode, exerciseType, showWireframe, visualStyle, setVisualStyle,
    isVoiceEnabled, setIsVoiceEnabled, isSoundEnabled, setIsSoundEnabled,
    angles, vbt, injuryRisk, visibilityError, compromisedJoints,
    repPhase, repCount, isSetActive,
    videoDimensions, facingMode, onFlipCamera: flipCamera,
    onStartCamera: startCamera, onStopCamera: stopCamera, onToggleMock: toggleMock,
  };

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionStatus={connectionStatus}
        streamStats={streamStats}
        rttMs={rttMs}
        onLaunchSimulation={() => handleLaunchSimulation()}
        onLaunchLive={() => handleLaunchLive()}
      />

      <div className="app-main-content">

        {/* HOME */}
        {activeTab === "overview" && (
          <main>
            <LandingPage
              onLaunchLive={() => handleLaunchLive()}
              onLaunchSimulation={() => handleLaunchSimulation()}
              onSelectExercise={ex => setExerciseType(ex)}
              onNavigateToResearch={() => setActiveTab("research")}
              onNavigateToExercises={() => setActiveTab("exercises")}
              onNavigateToAnalytics={() => setActiveTab("analytics")}
              onNavigateToHistory={() => setActiveTab("history")}
            />
          </main>
        )}

        {/* LIVE STUDIO */}
        {activeTab === "live" && (
          <div className="live-studio-container">

            {/* Toolbar */}
            <div className="studio-toolbar">
              <div className="toolbar-left">
                <div className="view-mode-group">
                  <button
                    className={`view-mode-btn ${studioViewMode === "split" ? "active" : ""}`}
                    onClick={() => setStudioViewMode("split")}
                    title="Reference guide + your camera side-by-side"
                  >
                    <Columns size={13} /> Guide &amp; Camera
                  </button>
                  <button
                    className={`view-mode-btn ${studioViewMode === "user" ? "active" : ""}`}
                    onClick={() => setStudioViewMode("user")}
                    title="Full-screen camera view"
                  >
                    <Camera size={13} /> Camera only
                  </button>
                  <button
                    className={`view-mode-btn ${studioViewMode === "reference" ? "active" : ""}`}
                    onClick={() => setStudioViewMode("reference")}
                    title="Full-screen reference guide"
                  >
                    <BookOpen size={13} /> Guide only
                  </button>
                </div>
              </div>

              <div className="coaching-ticker">
                <span className="ticker-dot" />
                <span className="ticker-label">Coach:</span>
                <span className="ticker-message">
                  {latestFeedback?.message || latestFeedback?.last_rep?.feedback_notes || "Brace your core and maintain full range of motion."}
                </span>
              </div>

              <div className="toolbar-right">
                {modelError && (
                  <span style={{ fontSize: "0.72rem", color: "var(--c-red)" }}>{modelError}</span>
                )}
                {cameraError && (
                  <span style={{ fontSize: "0.72rem", color: "var(--c-amber)" }}>Camera unavailable — try Demo mode</span>
                )}
              </div>
            </div>

            {/* Main workspace */}
            <div className="workspace-layout">
              <section className="viewport-section">

                {/* Split: reference + camera */}
                {studioViewMode === "split" && (
                  <div className="dual-viewport-grid">
                    <div className="dual-col-reference">
                      <ReferencePostureCoach
                        exerciseType={exerciseType}
                        userAngles={angles}
                        userRepPhase={repPhase}
                        isVoiceEnabled={isVoiceEnabled}
                        onToggleVoice={() => setIsVoiceEnabled(v => !v)}
                      />
                    </div>
                    <div className="dual-col-user">
                      <div className="viewport-header">
                        <div className="viewport-label">
                          <span className={`live-dot ${isCameraActive ? "active" : isMockMode ? "active" : ""}`} />
                          {isCameraActive ? "Your camera" : isMockMode ? "Demo stream" : "No source"}
                        </div>
                        <span className="rep-counter-badge">Rep {String(repCount).padStart(2, "0")}</span>
                      </div>
                      <PoseCanvas {...poseCanvasProps} />
                    </div>
                  </div>
                )}

                {/* Camera only */}
                {studioViewMode === "user" && (
                  <PoseCanvas {...poseCanvasProps} />
                )}

                {/* Reference only */}
                {studioViewMode === "reference" && (
                  <ReferencePostureCoach
                    exerciseType={exerciseType}
                    userAngles={angles}
                    userRepPhase={repPhase}
                    isVoiceEnabled={isVoiceEnabled}
                    onToggleVoice={() => setIsVoiceEnabled(v => !v)}
                  />
                )}
              </section>

              {/* Telemetry sidebar */}
              <section className="telemetry-section">
                <TelemetryHUD
                  connectionStatus={connectionStatus}
                  latestFeedback={latestFeedback}
                  rttMs={rttMs}
                  streamStats={streamStats}
                  exerciseType={exerciseType}
                  setExerciseType={setExerciseType}
                  isCameraActive={isCameraActive}
                  isMockMode={isMockMode}
                  showWireframe={showWireframe}
                  setShowWireframe={setShowWireframe}
                  visualStyle={visualStyle}
                  setVisualStyle={setVisualStyle}
                  isVoiceEnabled={isVoiceEnabled}
                  setIsVoiceEnabled={setIsVoiceEnabled}
                  isSoundEnabled={isSoundEnabled}
                  setIsSoundEnabled={setIsSoundEnabled}
                  weightKg={weightKg}
                  setWeightKg={setWeightKg}
                  isSetActive={isSetActive}
                  onStartSet={() => startSet(exerciseType, weightKg)}
                  onEndSet={endSet}
                  onViewAnalytics={() => setActiveTab("analytics")}
                  onStartCamera={startCamera}
                  onStopCamera={stopCamera}
                  onToggleMock={toggleMock}
                  onReconnectWs={reconnect}
                />
              </section>
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <main className="analytics-layout">
            <PostWorkoutDashboard
              key={completedSession?.id || "latest"}
              onStartNewSet={() => setActiveTab("live")}
              initialSession={completedSession}
            />
          </main>
        )}

        {/* EXERCISES */}
        {activeTab === "exercises" && (
          <main className="exercises-layout">
            <ExerciseLibraryView
              onSelectExercise={ex => setExerciseType(ex)}
              onLaunchLive={() => handleLaunchLive()}
              onLaunchSimulation={() => handleLaunchSimulation()}
            />
          </main>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <main className="history-layout">
            <SessionHistoryView
              onLaunchLive={() => handleLaunchLive()}
              onLaunchSimulation={() => handleLaunchSimulation()}
            />
          </main>
        )}

        {/* RESEARCH */}
        {activeTab === "research" && (
          <main className="research-layout">
            <ResearchGapsView
              onLaunchStudio={() => handleLaunchLive()}
              onLaunchSimulation={() => handleLaunchSimulation()}
            />
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
