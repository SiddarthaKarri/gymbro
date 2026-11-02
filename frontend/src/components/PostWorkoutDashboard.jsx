import React, { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Trophy, Dumbbell, Timer, Activity, ArrowLeft, RotateCcw,
  Zap, Download, Printer, AlertTriangle, Info
} from "lucide-react";

const BENCHMARK = {
  id: 999, session_uuid: "benchmark-demo", created_at: new Date().toISOString(),
  ended_at: new Date().toISOString(), exercise_type: "bicep_curl",
  total_reps: 4, overall_avg_quality: 88.5, duration_seconds: 18.4, weight_kg: 40.0,
  repetitions: [
    { rep_number: 1, peak_depth_angle: 72.4, avg_symmetry_delta: 2.1, quality_score: 96.0, duration_ms: 1850, mean_velocity_mps: 0.72, peak_velocity_mps: 0.95, velocity_loss_pct: 0.0, power_watts: 282.4, estimated_1rm_kg: 59.8, reps_in_reserve: 4, feedback_notes: "Full ROM (72.4°) · Symmetric" },
    { rep_number: 2, peak_depth_angle: 74.1, avg_symmetry_delta: 3.4, quality_score: 93.5, duration_ms: 1920, mean_velocity_mps: 0.68, peak_velocity_mps: 0.89, velocity_loss_pct: 5.6,  power_watts: 266.7, estimated_1rm_kg: 60.5, reps_in_reserve: 3, feedback_notes: "Full ROM (74.1°) · Symmetric" },
    { rep_number: 3, peak_depth_angle: 78.5, avg_symmetry_delta: 5.8, quality_score: 84.0, duration_ms: 2200, mean_velocity_mps: 0.60, peak_velocity_mps: 0.79, velocity_loss_pct: 16.7, power_watts: 235.4, estimated_1rm_kg: 62.2, reps_in_reserve: 2, feedback_notes: "Partial ROM (78.5°) · Slight right lag" },
    { rep_number: 4, peak_depth_angle: 83.2, avg_symmetry_delta: 7.2, quality_score: 74.5, duration_ms: 2500, mean_velocity_mps: 0.54, peak_velocity_mps: 0.71, velocity_loss_pct: 25.0, power_watts: 211.8, estimated_1rm_kg: 64.0, reps_in_reserve: 1, feedback_notes: "Partial ROM · Asymmetry · 25% velocity drop (fatigue)" },
  ]
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--c-surface-3)", border: "1px solid var(--c-border-med)", borderRadius: "var(--r-sm)", padding: "8px 12px", fontSize: "0.75rem" }}>
      <div style={{ color: "var(--t-muted)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</div>
      ))}
    </div>
  );
};

export function PostWorkoutDashboard({ onStartNewSet, initialSession = null }) {
  const [session, setSession] = useState(initialSession);
  const [loading, setLoading] = useState(!initialSession);
  const [error, setError] = useState(null);

  const fetchLatest = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/sessions/latest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSession(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!initialSession) fetchLatest(); else setSession(initialSession); }, [initialSession]);

  const handleExportCsv = () => {
    if (!session || !reps.length) return;
    const headers = ["Rep", "Quality %", "Depth °", "Velocity m/s", "Power W", "1RM kg", "Notes"];
    const rows = reps.map(r => [r.rep_number, r.quality_score, r.peak_depth_angle, r.mean_velocity_mps || 0, r.power_watts ? Math.round(r.power_watts) : "N/A", r.estimated_1rm_kg || "N/A", `"${(r.feedback_notes || "").replace(/"/g, '""')}"`]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = `formcheck_${session.exercise_type}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Loading session data…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="dashboard-error-state">
        <AlertTriangle size={36} color="var(--c-amber)" />
        <h3>No session data available</h3>
        <p style={{ maxWidth: 380 }}>{error || "Complete a workout set in the studio, or load a demo session below."}</p>
        <div className="empty-state-buttons">
          <button className="btn btn-primary" onClick={onStartNewSet}><ArrowLeft size={14} /> Go to Studio</button>
          <button className="btn btn-secondary" onClick={() => { setSession(BENCHMARK); setError(null); }}><Zap size={14} /> Load Demo Session</button>
          <button className="btn btn-ghost" onClick={fetchLatest}><RotateCcw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  const reps = session.repetitions || [];
  const maxPower = Math.max(0, ...reps.map(r => r.power_watts || 0));
  const best1rm  = Math.max(0, ...reps.map(r => r.estimated_1rm_kg || 0));
  const avgQuality = session.overall_avg_quality ?? 0;
  const qualityColor = avgQuality >= 85 ? "var(--c-green)" : avgQuality >= 70 ? "var(--c-amber)" : "var(--c-red)";

  const lineData = reps.map(r => ({ rep: `#${r.rep_number}`, quality: r.quality_score, depth: r.peak_depth_angle }));
  const vbtData  = reps.map(r => ({ rep: `#${r.rep_number}`, velocity: r.mean_velocity_mps != null ? r.mean_velocity_mps : 0, loss: r.velocity_loss_pct || 0 }));

  return (
    <div className="post-workout-dashboard">
      {/* Nav */}
      <div className="dashboard-top-nav no-print">
        <button className="btn-back" onClick={onStartNewSet}>
          <ArrowLeft size={14} /> Back to Studio
        </button>
        <div className="dashboard-meta-tags">
          <span className="meta-pill"><Dumbbell size={12} /> {session.exercise_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
          {session.weight_kg > 0 && <span className="meta-pill">{session.weight_kg} kg</span>}
          <button className="btn-export-csv" onClick={handleExportCsv}><Download size={13} /> Export CSV</button>
          <button className="btn-export-pdf" onClick={() => window.print()}><Printer size={13} /> Print</button>
          <button className="btn-refresh" onClick={fetchLatest}><RotateCcw size={13} /></button>
        </div>
      </div>

      {/* Session info */}
      <div className="report-header">
        <div className="report-brand">
          <h2>Session Report</h2>
          <span className="report-sub">{new Date(session.created_at).toLocaleString()}</span>
        </div>
        <div className="report-session-info">
          <div><strong>ID:</strong> {session.session_uuid.slice(0, 12)}…</div>
          <div><strong>Duration:</strong> {session.duration_seconds ? `${session.duration_seconds.toFixed(1)}s` : "—"}</div>
          {session.weight_kg > 0 && <div><strong>Load:</strong> {session.weight_kg} kg</div>}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid kpi-grid-6">
        <div className="kpi-card">
          <div className="kpi-label"><Trophy size={13} /> Form Quality</div>
          <div className="kpi-value" style={{ color: qualityColor }}>{avgQuality.toFixed(1)}<span className="kpi-unit">%</span></div>
          <div className="kpi-sub">{avgQuality >= 85 ? "Excellent" : avgQuality >= 70 ? "Good" : "Needs work"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Activity size={13} /> Total Reps</div>
          <div className="kpi-value text-emerald">{session.total_reps}<span className="kpi-unit"> reps</span></div>
          <div className="kpi-sub">Completed set volume</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={13} /> VBT — Rep 1</div>
          <div className="kpi-value text-amber">{reps[0]?.mean_velocity_mps != null ? reps[0].mean_velocity_mps : "--"}<span className="kpi-unit"> m/s</span></div>
          <div className="kpi-sub">Max loss: {reps[reps.length - 1]?.velocity_loss_pct || 0}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={13} /> Peak Power</div>
          <div className="kpi-value text-emerald">{maxPower > 0 ? Math.round(maxPower) : "--"}<span className="kpi-unit"> W</span></div>
          <div className="kpi-sub">Mechanical output</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Dumbbell size={13} /> Predicted 1RM</div>
          <div className="kpi-value" style={{ color: "var(--c-violet)" }}>{best1rm > 0 ? best1rm : "--"}<span className="kpi-unit"> kg</span></div>
          <div className="kpi-sub">González-Badillo model</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Timer size={13} /> Duration</div>
          <div className="kpi-value">{session.duration_seconds ? session.duration_seconds.toFixed(1) : "--"}<span className="kpi-unit"> s</span></div>
          <div className="kpi-sub">Set time</div>
        </div>
      </div>

      {/* Charts */}
      {reps.length > 0 && (
        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-title">Form Quality per Rep</div>
            <div className="chart-sub">Tracks how form degrades over the set</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="rep" tick={{ fontSize: 11, fill: "var(--t-muted)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--t-muted)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={85} stroke="var(--c-green)" strokeDasharray="4 4" label={{ value: "Good", position: "right", fill: "var(--c-green)", fontSize: 10 }} />
                <Line dataKey="quality" stroke="var(--c-brand-light)" strokeWidth={2} dot={{ r: 3, fill: "var(--c-brand-light)" }} name="Quality %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <div className="chart-title">Bar Velocity per Rep</div>
            <div className="chart-sub">Velocity drop indicates neuromuscular fatigue</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={vbtData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="rep" tick={{ fontSize: 11, fill: "var(--t-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--t-muted)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0.5} stroke="var(--c-amber)" strokeDasharray="4 4" label={{ value: "Fatigue zone", position: "right", fill: "var(--c-amber)", fontSize: 10 }} />
                <Bar dataKey="velocity" fill="var(--c-cyan)" radius={[3, 3, 0, 0]} name="Velocity m/s" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rep breakdown */}
      {reps.length > 0 && (
        <div>
          <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1rem", fontWeight: 600, color: "var(--t-primary)" }}>Rep Breakdown</h3>
          <div className="reps-list">
            {reps.map(r => {
              const qColor = r.quality_score >= 85 ? "var(--c-green)" : r.quality_score >= 70 ? "var(--c-amber)" : "var(--c-red)";
              return (
                <div className="rep-card" key={r.rep_number}>
                  <div className="rep-card-num">{r.rep_number}</div>
                  <div>
                    <div className="rep-card-metrics">
                      <div className="rep-metric">
                        <span className="rep-metric-label">Depth</span>
                        <span className="rep-metric-val">{r.peak_depth_angle}°</span>
                      </div>
                      <div className="rep-metric">
                        <span className="rep-metric-label">Velocity</span>
                        <span className="rep-metric-val">{r.mean_velocity_mps || "--"} m/s</span>
                      </div>
                      <div className="rep-metric">
                        <span className="rep-metric-label">Power</span>
                        <span className="rep-metric-val">{r.power_watts ? `${Math.round(r.power_watts)} W` : "--"}</span>
                      </div>
                      <div className="rep-metric">
                        <span className="rep-metric-label">Symmetry</span>
                        <span className="rep-metric-val">Δ{r.avg_symmetry_delta}°</span>
                      </div>
                      <div className="rep-metric">
                        <span className="rep-metric-label">Duration</span>
                        <span className="rep-metric-val">{r.duration_ms ? (r.duration_ms / 1000).toFixed(1) : "--"}s</span>
                      </div>
                    </div>
                    {r.feedback_notes && (
                      <div className="rep-feedback">{r.feedback_notes}</div>
                    )}
                  </div>
                  <div className="rep-card-quality">
                    <span className="rep-quality-num" style={{ color: qColor }}>{r.quality_score}%</span>
                    {r.reps_in_reserve != null && (
                      <span style={{ fontSize: "0.68rem", color: "var(--t-muted)" }}>RIR {r.reps_in_reserve}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reps.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--t-muted)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-3)" }}>
          <Info size={16} />
          <span>No repetitions recorded in this session. Start a set and complete at least one rep.</span>
        </div>
      )}
    </div>
  );
}
