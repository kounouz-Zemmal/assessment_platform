import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  FileQuestion,
  ClipboardList,
  GraduationCap,
  Clock,
  Plus,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet } from "../../apiClient";
import { useAuth } from "../../contexts/AuthContext";

/* ─── tiny keyframe injection ─────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById("td-styles")) return;
  const s = document.createElement("style");
  s.id = "td-styles";
  s.textContent = `
    
    
    @keyframes td-fade-up {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes td-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes td-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes td-pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(99,102,241,.35); }
      70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
      100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    }

    .td-animate-1 { animation: td-fade-up .5s ease both; }
    .td-animate-2 { animation: td-fade-up .5s .08s ease both; }
    .td-animate-3 { animation: td-fade-up .5s .16s ease both; }
    .td-animate-4 { animation: td-fade-up .5s .24s ease both; }
    .td-animate-5 { animation: td-fade-up .5s .32s ease both; }
    .td-animate-6 { animation: td-fade-up .5s .40s ease both; }
    .td-animate-7 { animation: td-fade-up .5s .48s ease both; }

    .td-stat-card {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,.07);
      background: #fff;
      padding: 22px 24px;
      transition: transform .2s ease, box-shadow .2s ease;
      cursor: default;
    }
    .td-stat-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0,0,0,.09);
    }
    .td-stat-card::before {
      content: '';
      position: absolute;
      inset: 0;
      opacity: .04;
      pointer-events: none;
    }

    .td-stat-card.blue::before  { background: radial-gradient(circle at 80% 20%, #3b82f6, transparent 70%); }
    .td-stat-card.indigo::before{ background: radial-gradient(circle at 80% 20%, #6366f1, transparent 70%); }
    .td-stat-card.amber::before { background: radial-gradient(circle at 80% 20%, #f59e0b, transparent 70%); }
    .td-stat-card.green::before { background: radial-gradient(circle at 80% 20%, #10b981, transparent 70%); }

    .td-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
    }
    .td-icon-wrap.blue   { background: #eff6ff; }
    .td-icon-wrap.indigo { background: #eef2ff; }
    .td-icon-wrap.amber  { background: #fffbeb; }
    .td-icon-wrap.green  { background: #ecfdf5; }

    .td-action-btn {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 11px 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: #111;
      background: #f8f8fa;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease, transform .15s ease;
      text-align: left;
      gap: 10px;
    }
    .td-action-btn:hover {
      background: #f1f1f7;
      border-color: rgba(99,102,241,.2);
      transform: translateX(2px);
    }
    .td-action-btn.primary {
      background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
      color: #fff;
      border-color: transparent;
    }
    .td-action-btn.primary:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      transform: translateX(2px);
    }
    .td-action-btn .ml-auto { margin-left: auto; }

    .td-assessment-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f8f8fa;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
      gap: 12px;
    }
    .td-assessment-row:hover {
      background: #f1f1f7;
      border-color: rgba(99,102,241,.18);
    }

    .td-pending-banner {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fffbeb, #fef3c7);
      border: 1px solid #fde68a;
    }

    .td-hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #eef2ff, #e0e7ff);
      color: #4f46e5;
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .td-card {
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,.07);
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
    }
    .td-card-header {
      padding: 20px 22px 0;
    }
    .td-card-title {
      
      font-size: 18px;
      color: #111;
    }
    .td-card-body {
      padding: 16px 22px 22px;
    }

    .td-number {
      
      font-size: 36px;
      line-height: 1;
      color: #0a0a0a;
      margin: 10px 0 4px;
    }

    .td-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0,0,0,.08) 30%, rgba(0,0,0,.08) 70%, transparent);
      margin: 6px 0 14px;
    }

    .td-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity .15s ease, transform .15s ease;
    }
    .td-btn-primary:hover { opacity: .9; transform: translateY(-1px); }

    .td-btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 8px;
      background: #fff;
      color: #374151;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid #e5e7eb;
      transition: border-color .15s ease, background .15s ease, transform .15s ease;
    }
    .td-btn-outline:hover {
      border-color: #a5b4fc;
      background: #f5f3ff;
      transform: translateY(-1px);
    }

    .td-empty {
      text-align: center;
      padding: 36px 0;
      color: #9ca3af;
      font-size: 14px;
    }
    .td-empty svg {
      margin: 0 auto 10px;
      opacity: .35;
    }
  `;
  document.head.appendChild(s);
};

/* ─── component ────────────────────────────────────────────────────────────── */
export default function TeacherDashboard() {
  injectStyles();

  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    stats: {
      questionsCreated: number;
      totalAssessments: number;
      pendingGrading: number;
      totalSubmissions: number;
    };
    activeAssessments: Array<{
      id: string;
      title: string;
      status: string;
      duration: number;
      startTime: string | null;
    }>;
  } | null>(null);

  useEffect(() => {
    if (!user || user.role !== "teacher") { setLoading(false); return; }
    setLoading(true);
    setError(null);
    apiGet<typeof dashboardData>("teacher/dashboard")
      .then((data) => setDashboardData(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = dashboardData?.stats ?? {
    questionsCreated: 0,
    totalAssessments: 0,
    pendingGrading: 0,
    totalSubmissions: 0,
  };
  const activeAssessments = dashboardData?.activeAssessments ?? [];

  const statCards = [
    {
      label: "Questions Created",
      value: stats.questionsCreated,
      sub: "In your question bank",
      icon: <FileQuestion size={18} color="#3b82f6" />,
      color: "blue",
    },
    {
      label: "Total Assessments",
      value: stats.totalAssessments,
      sub: "Created and assigned",
      icon: <ClipboardList size={18} color="#6366f1" />,
      color: "indigo",
    },
    {
      label: "Pending Grading",
      value: stats.pendingGrading,
      sub: "Needs teacher review",
      icon: <Clock size={18} color="#f59e0b" />,
      color: "amber",
    },
    {
      label: "Total Submissions",
      value: stats.totalSubmissions,
      sub: "Student attempts",
      icon: <GraduationCap size={18} color="#10b981" />,
      color: "green",
    },
  ];

  return (
    <div
      className="td-root"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f8f7ff 0%, #fafaf9 50%, #f0fdf4 100%)",
        padding: "32px 28px",
      }}
    >
      {/* ── Hero header ── */}
      <div
        className="td-animate-1"
        style={{
          borderRadius: 20,
          background: "#fff",
          border: "1px solid rgba(0,0,0,.07)",
          boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          padding: "28px 32px",
          marginBottom: 28,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <div className="td-hero-badge">
            <Sparkles size={10} />
            Teaching Workspace
          </div>
          <h1
            style={{
              
              fontSize: 32,
              fontWeight: 400,
              color: "#0a0a0a",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Teacher Dashboard
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
            Real-time overview of your question bank, assessments, and grading queue.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="td-btn-primary" onClick={() => navigate("/teacher/questions/create")}>
            <Plus size={15} />
            New Question
          </button>
          <button className="td-btn-outline" onClick={() => navigate("/teacher/assessments/create")}>
            <Plus size={15} />
            New Assessment
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`td-stat-card ${card.color} td-animate-${i + 2}`}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{card.label}</p>
              <div className={`td-icon-wrap ${card.color}`}>{card.icon}</div>
            </div>
            <p className="td-number">{card.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column section ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Quick Actions */}
        <div className="td-card td-animate-6">
          <div className="td-card-header">
            <p className="td-card-title">Quick Actions</p>
          </div>
          <div className="td-divider" style={{ margin: "14px 22px 0" }} />
          <div className="td-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="td-action-btn primary"
              onClick={() => navigate("/teacher/questions/create")}
            >
              <Plus size={15} />
              Create New Question
            </button>
            <button
              className="td-action-btn primary"
              onClick={() => navigate("/teacher/assessments/create")}
              style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)" }}
            >
              <Plus size={15} />
              Create New Assessment
            </button>
            <button
              className="td-action-btn"
              onClick={() => navigate("/teacher/questions")}
            >
              <FileQuestion size={15} color="#6366f1" />
              View Question Bank
              <ArrowRight size={13} className="ml-auto" color="#9ca3af" />
            </button>
            <button
              className="td-action-btn"
              onClick={() => navigate("/teacher/analytics")}
            >
              <TrendingUp size={15} color="#10b981" />
              View Analytics
              <ArrowRight size={13} className="ml-auto" color="#9ca3af" />
            </button>
          </div>
        </div>

        {/* Active Assessments */}
        <div className="td-card td-animate-7">
          <div className="td-card-header">
            <p className="td-card-title">Active & Scheduled Assessments</p>
          </div>
          <div className="td-divider" style={{ margin: "14px 22px 0" }} />
          <div className="td-card-body">
            {loading && (
              <div className="td-empty">
                <p>Loading assessments…</p>
              </div>
            )}
            {!loading && error && (
              <div className="td-empty" style={{ color: "#ef4444" }}>
                <AlertCircle size={28} style={{ margin: "0 auto 8px", display: "block", opacity: .5 }} />
                <p>{error}</p>
              </div>
            )}
            {!loading && !error && activeAssessments.length === 0 && (
              <div className="td-empty">
                <BookOpen size={28} />
                <p>No active or scheduled assessments</p>
              </div>
            )}
            {!loading && !error && activeAssessments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeAssessments.map((a) => (
                  <div
                    key={a.id}
                    className="td-assessment-row"
                    onClick={() => navigate(`/teacher/assessments/${a.id}/submissions`)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#111",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.title}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af" }}>
                        {a.startTime
                          ? new Date(a.startTime).toLocaleDateString()
                          : "No start date"}{" "}
                        · {a.duration} min
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending grading banner ── */}
      {stats.pendingGrading > 0 && (
        <div className="td-pending-banner td-animate-7">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#fef3c7",
              border: "1px solid #fde68a",
              flexShrink: 0,
            }}
          >
            <Clock size={18} color="#d97706" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#92400e" }}>
              {stats.pendingGrading} submission{stats.pendingGrading !== 1 ? "s" : ""} pending review
            </p>
            <p style={{ margin: "3px 0 10px", fontSize: 13, color: "#b45309" }}>
              Head to Assessments to review and grade outstanding student work.
            </p>
            <button
              className="td-btn-primary"
              style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", fontSize: 13 }}
              onClick={() => navigate("/teacher/assessments")}
            >
              Open Assessments
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}