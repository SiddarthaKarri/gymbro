import React, { useState, useEffect, useCallback } from "react";
import { History, BarChart2, Dumbbell, Calendar, RotateCcw, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { PostWorkoutDashboard } from "./PostWorkoutDashboard";

const DEMO_SESSIONS = [
  {
    id: 1, session_uuid: "demo-001", created_at: new Date(Date.now() - 86400000).toISOString(),
    ended_at: new Date(Date.now() - 86400000 + 1200000).toISOString(),
    exercise_type: "bicep_curl", total_reps: 8, overall_avg_quality: 88.5,
    duration_seconds: 42.0, weight_kg: 40.0,
    repetitions: [
      { rep_number: 1, quality_score: 96, peak_depth_angle: 72.4, avg_symmetry_delta: 2.1, mean_velocity_mps: 0.72, power_watts: 282, estimated_1rm_kg: 59.8, velocity_loss_pct: 0, reps_in_reserve: 4, duration_ms: 1850, feedback_notes: "Full ROM · Symmetric" },
      { rep_number: 2, quality_score: 90, peak_depth_angle: 74.0, avg_symmetry_delta: 3.0, mean_velocity_mps: 0.68, power_watts: 266, estimated_1rm_kg: 60.5, velocity_loss_pct: 5.6, reps_in_reserve: 3, duration_ms: 1900, feedback_notes: "Full ROM · Symmetric" },
    ]
  },
  {
    id: 2, session_uuid: "demo-002", created_at: new Date(Date.now() - 172800000).toISOString(),
    ended_at: new Date(Date.now() - 172800000 + 900000).toISOString(),
    exercise_type: "squat", total_reps: 5, overall_avg_quality: 82.0,
    duration_seconds: 38.5, weight_kg: 80.0,
    repetitions: [
      { rep_number: 1, quality_score: 92, peak_depth_angle: 88.0, avg_symmetry_delta: 2.5, mean_velocity_mps: 0.45, power_watts: 354, estimated_1rm_kg: 108.0, velocity_loss_pct: 0, reps_in_reserve: 3, duration_ms: 2800, feedback_notes: "Full depth · Symmetric" },
    ]
  },
];

export function SessionHistoryView({ onLaunchLive, onLaunchSimulation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true); setError(null); setUsingDemo(false);
    try {
      const res = await fetch("/api/sessions?limit=20");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadDemo = () => {
    setSessions(DEMO_SESSIONS);
    setUsingDemo(true);
    setError(null);
  };

  if (selectedSession) {
    return (
      <PostWorkoutDashboard
        initialSession={selectedSession}
        onStartNewSet={() => setSelectedSession(null)}
      />
    );
  }

  const totalReps     = sessions.reduce((s, se) => s + (se.total_reps || 0), 0);
  const avgQuality    = sessions.length > 0 ? (sessions.reduce((s, se) => s + (se.overall_avg_quality || 0), 0) / sessions.length).toFixed(1) : "--";
  const uniqueEx      = new Set(sessions.map(s => s.exercise_type)).size;

  return (
    <div className="history-view-container">
      {/* Header */}
      <div className="history-header-banner">
        <div className="history-header-left">
          <div className="history-pill-tag"><History size={13} /> Session history</div>
          <h1 className="history-page-title">Your Workouts</h1>
          <p className="history-page-desc">
            All completed sets stored locally. Click any session to view detailed analytics.
          </p>
        </div>
        <div className="history-header-actions">
          {usingDemo && <span style={{ fontSize: "0.72rem", color: "var(--c-amber)", background: "var(--c-amber-dim)", padding: "4px 10px", borderRadius: "var(--r-full)", border: "1px solid rgba(245,158,11,0.3)" }}>Demo data</span>}
          <button className="btn-refresh-history" onClick={loadSessions} disabled={loading}>
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="btn-hero-primary" onClick={onLaunchLive}>
            <BarChart2 size={13} /> New Session
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="history-kpis-grid">
        <div className="history-kpi-card">
          <div className="kpi-icon-wrap bg-violet-alpha"><History size={18} className="text-violet" /></div>
          <div className="kpi-info">
            <span className="kpi-val text-violet">{sessions.length}</span>
            <span className="kpi-lbl">Total sessions</span>
          </div>
        </div>
        <div className="history-kpi-card">
          <div className="kpi-icon-wrap bg-emerald-alpha"><BarChart2 size={18} className="text-emerald" /></div>
          <div className="kpi-info">
            <span className="kpi-val text-emerald">{totalReps}</span>
            <span className="kpi-lbl">Total reps logged</span>
          </div>
        </div>
        <div className="history-kpi-card">
          <div className="kpi-icon-wrap bg-cyan-alpha"><Dumbbell size={18} className="text-cyan" /></div>
          <div className="kpi-info">
            <span className="kpi-val text-cyan">{sessions.length > 0 ? avgQuality + "%" : "--"}</span>
            <span className="kpi-lbl">Avg form quality</span>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="history-loading-box">
          <div className="loading-spinner" />
          Loading sessions…
        </div>
      )}

      {!loading && error && (
        <div className="history-error-box">
          <AlertCircle size={16} className="text-rose" />
          <span>Couldn't reach the backend: {error}</span>
          <button className="btn-retry" onClick={loadSessions}>Retry</button>
          <button className="btn-retry" style={{ borderColor: "rgba(99,102,241,0.4)", color: "var(--c-brand-light)" }} onClick={loadDemo}>
            <Sparkles size={12} /> Load demo
          </button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="history-empty-box">
          <History size={36} color="var(--t-disabled)" />
          <div>
            <div style={{ fontWeight: 600, color: "var(--t-secondary)", marginBottom: 4 }}>No sessions yet</div>
            <div style={{ fontSize: "0.82rem" }}>Complete your first workout to see results here.</div>
          </div>
          <div className="empty-actions">
            <button className="btn-hero-primary" onClick={onLaunchLive}><Dumbbell size={13} /> Start first session</button>
            <button className="btn-hero-secondary" onClick={loadDemo}><Sparkles size={13} /> Load demo data</button>
          </div>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="history-sessions-list">
          {sessions.map(session => {
            const exName = (session.exercise_type || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            const qColor = session.overall_avg_quality >= 85 ? "var(--c-green)" : session.overall_avg_quality >= 70 ? "var(--c-amber)" : "var(--c-red)";
            return (
              <div className="history-session-card" key={session.id}>
                <div className="session-card-left">
                  <div className="session-card-header">
                    <span className="session-badge">{exName}</span>
                    <span className="session-date">
                      <Calendar size={11} />
                      {new Date(session.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {new Date(session.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="session-metrics-row">
                    <div className="session-metric">
                      <span className="sess-lbl">Reps</span>
                      <span className="sess-val">{session.total_reps}</span>
                    </div>
                    <div className="session-metric">
                      <span className="sess-lbl">Form</span>
                      <span className="sess-val" style={{ color: qColor }}>{session.overall_avg_quality?.toFixed(1)}%</span>
                    </div>
                    {session.weight_kg > 0 && (
                      <div className="session-metric">
                        <span className="sess-lbl">Load</span>
                        <span className="sess-val">{session.weight_kg} kg</span>
                      </div>
                    )}
                    {session.duration_seconds && (
                      <div className="session-metric">
                        <span className="sess-lbl">Duration</span>
                        <span className="sess-val">{session.duration_seconds.toFixed(0)}s</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="session-card-right">
                  <button
                    className="btn-inspect-session"
                    onClick={() => setSelectedSession(session)}
                  >
                    View report <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
