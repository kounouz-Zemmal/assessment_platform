import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Plus, Sparkles, Wand2, X, BookOpen, Tag, Settings2, CheckSquare } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { QuestionType } from "../../types";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "../../apiClient";

/* ─── styles ───────────────────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById("cq-styles")) return;
  const s = document.createElement("style");
  s.id = "cq-styles";
  s.textContent = `
    @keyframes cq-fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes cq-spin { to { transform: rotate(360deg); } }

    .cq-a1 { animation: cq-fade-up .4s ease both; }
    .cq-a2 { animation: cq-fade-up .4s .07s ease both; }
    .cq-a3 { animation: cq-fade-up .4s .14s ease both; }
    .cq-a4 { animation: cq-fade-up .4s .21s ease both; }
    .cq-a5 { animation: cq-fade-up .4s .28s ease both; }
    .cq-a6 { animation: cq-fade-up .4s .35s ease both; }

    /* ── section card ── */
    .cq-section {
      background: #fff;
      border: 1px solid rgba(0,0,0,.07);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,.05);
    }
    .cq-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 18px 22px 16px;
      border-bottom: 1px solid #f3f4f6;
    }
    .cq-section-title {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 17px;
      color: #111;
      font-weight: 400;
    }
    .cq-section-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
    }
    .cq-section-body { padding: 20px 22px; }

    /* ── form controls ── */
    .cq-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .cq-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: 9px;
      border: 1px solid #e5e7eb;
      background: #fafafa;
      font-size: 14px;
      color: #111;
      outline: none;
      transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
    }
    .cq-input:focus {
      border-color: #a5b4fc;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(165,180,252,.18);
    }
    .cq-input::placeholder { color: #c1c5cf; }

    .cq-textarea {
      width: 100%;
      padding: 10px 12px;
      border-radius: 9px;
      border: 1px solid #e5e7eb;
      background: #fafafa;
      font-size: 14px;
      color: #111;
      outline: none;
      resize: vertical;
      transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
      line-height: 1.6;
    }
    .cq-textarea:focus {
      border-color: #a5b4fc;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(165,180,252,.18);
    }
    .cq-textarea::placeholder { color: #c1c5cf; }

    /* ── difficulty / status badges as pill toggles ── */
    .cq-pill-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .cq-pill {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      border: 1.5px solid #e5e7eb;
      background: #fff;
      color: #6b7280;
      cursor: pointer;
      transition: all .15s ease;
    }
    .cq-pill:hover { border-color: #c7d2fe; color: #4f46e5; }
    .cq-pill.active-easy   { background: #f0fdf4; border-color: #6ee7b7; color: #059669; }
    .cq-pill.active-medium { background: #fffbeb; border-color: #fcd34d; color: #d97706; }
    .cq-pill.active-hard   { background: #fff1f2; border-color: #fda4af; color: #e11d48; }
    .cq-pill.active-type   { background: #eef2ff; border-color: #a5b4fc; color: #4f46e5; }
    .cq-pill.active-status { background: #f0fdf4; border-color: #6ee7b7; color: #059669; }

    /* ── AI assist button ── */
    .cq-ai-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 13px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      background: linear-gradient(135deg, #eef2ff, #e0e7ff);
      color: #4f46e5;
      border: 1px solid #c7d2fe;
      cursor: pointer;
      transition: opacity .15s ease, transform .15s ease;
      white-space: nowrap;
    }
    .cq-ai-btn:hover:not(:disabled) { opacity: .85; transform: translateY(-1px); }
    .cq-ai-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cq-ai-spin { animation: cq-spin .8s linear infinite; }

    /* ── option rows ── */
    .cq-option-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1.5px solid #e5e7eb;
      background: #fafafa;
      transition: border-color .15s ease, background .15s ease;
    }
    .cq-option-row:focus-within {
      border-color: #a5b4fc;
      background: #fff;
    }
    .cq-option-row.selected {
      border-color: #6ee7b7;
      background: #f0fdf4;
    }
    .cq-option-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 14px;
      color: #111;
      outline: none;
    }
    .cq-option-input::placeholder { color: #c1c5cf; }

    .cq-radio-custom {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #d1d5db;
      background: #fff;
      flex-shrink: 0;
      cursor: pointer;
      transition: border-color .15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cq-radio-custom.checked {
      border-color: #10b981;
      background: #10b981;
    }
    .cq-radio-custom.checked::after {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fff;
    }

    /* ── keyword chips ── */
    .cq-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px 5px 12px;
      border-radius: 999px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      font-size: 12px;
      color: #3730a3;
      font-weight: 500;
    }
    .cq-chip-weight {
      padding: 2px 6px;
      border-radius: 999px;
      background: #c7d2fe;
      color: #3730a3;
      font-size: 11px;
      font-weight: 700;
    }
    .cq-chip-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: #818cf8;
      cursor: pointer;
      transition: background .15s, color .15s;
      padding: 0;
    }
    .cq-chip-remove:hover { background: #fda4af; color: #fff; }

    /* ── keyword add row ── */
    .cq-keyword-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 640px) {
      .cq-keyword-row { grid-template-columns: 1fr 1fr; }
    }

    /* ── buttons ── */
    .cq-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 22px;
      border-radius: 9px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: opacity .15s ease, transform .15s ease;
    }
    .cq-btn-primary:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
    .cq-btn-primary:disabled { opacity: .6; cursor: not-allowed; }

    .cq-btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 9px;
      background: transparent;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      transition: background .15s ease, color .15s ease;
    }
    .cq-btn-ghost:hover { background: #f3f4f6; color: #111; }

    .cq-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      background: #f3f4f6;
      color: #374151;
      font-size: 13px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: background .15s ease;
    }
    .cq-back-btn:hover { background: #e5e7eb; }

    .cq-add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      border: none;
      cursor: pointer;
      transition: opacity .15s ease;
      flex-shrink: 0;
    }
    .cq-add-btn:hover { opacity: .88; }

    .cq-shell {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
    }

    .cq-form {
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .cq-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      gap: 16px;
    }

    .cq-option-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }

    .cq-mini-btn {
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #d1d5db;
      background: #fff;
      color: #374151;
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease;
    }
    .cq-mini-btn:hover {
      border-color: #a5b4fc;
      background: #eef2ff;
    }

    .cq-remove-option {
      padding: 5px 8px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid #fca5a5;
      background: #fff1f2;
      color: #be123c;
      cursor: pointer;
      transition: opacity .15s ease;
    }
    .cq-remove-option:hover { opacity: .85; }

    .cq-err { font-size: 11px; color: #ef4444; margin-top: 4px; }

    .cq-hint { font-size: 12px; color: #9ca3af; margin-top: 6px; }

    .cq-tf-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1.5px solid #e5e7eb;
      background: #fafafa;
      cursor: pointer;
      transition: all .15s ease;
      font-size: 15px;
      font-weight: 500;
      color: #374151;
    }
    .cq-tf-option.selected {
      border-color: #6ee7b7;
      background: #f0fdf4;
      color: #059669;
    }

    .cq-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 60vh;
      color: #9ca3af;
      font-size: 15px;
    }

    .cq-quick-topic-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .cq-points-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #f0fdf4;
      border: 1px solid #6ee7b7;
      color: #059669;
    }
  `;
  document.head.appendChild(s);
};

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "MCQ", label: "MCQ" },
  { value: "SCQ", label: "SCQ" },
  { value: "True/False", label: "True / False" },
  { value: "Descriptive", label: "Descriptive" },
];
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"];
const STATUS_OPTIONS = ["Draft", "Pending Review", "Approved", "Rejected"];

/* ─── component ────────────────────────────────────────────────────────────── */
export default function TeacherCreateQuestion() {
  injectStyles();

  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [topicCreating, setTopicCreating] = useState(false);
  const [showQuickTopicForm, setShowQuickTopicForm] = useState(false);
  const [quickTopicName, setQuickTopicName] = useState("");
  const [modules, setModules] = useState<Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }>>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    moduleId: "",
    topicId: "",
    type: "MCQ" as QuestionType,
    difficulty: "Medium",
    status: "Draft",
    text: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    referenceAnswer: "",
    keywords: [] as Array<{ text: string; weight: number; synonyms?: string[] }>,
  });

  const [newKeyword, setNewKeyword] = useState({ text: "", weight: 1, synonymsText: "" });
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ modules: Array<{ id: string; code: string; name: string; topics: Array<{ id: string; name: string }> }> }>("teacher/modules"),
      isEditing ? apiGet<{ question: any }>(`teacher/questions/${id}`) : Promise.resolve(null),
    ])
      .then(([modulesData, questionData]) => {
        setModules(modulesData.modules);
        if (questionData?.question) {
          setFormData({
            moduleId: questionData.question.moduleId || "",
            topicId: questionData.question.topicId || "",
            type: questionData.question.type || "MCQ",
            difficulty: questionData.question.difficulty || "Medium",
            status: questionData.question.status || "Draft",
            text: questionData.question.text || "",
            options: questionData.question.options?.length > 0 ? questionData.question.options : ["", "", "", ""],
            correctAnswer: questionData.question.correctAnswer || "",
            referenceAnswer: questionData.question.referenceAnswer || "",
            keywords: questionData.question.keywords || [],
          });
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load question form"))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const selectedModule = useMemo(() => modules.find((m) => m.id === formData.moduleId), [modules, formData.moduleId]);

  const handleAddKeyword = () => {
    if (!newKeyword.text.trim()) return;
    const synonyms = newKeyword.synonymsText.split(",").map((s) => s.trim()).filter(Boolean);
    setFormData({ ...formData, keywords: [...formData.keywords, { text: newKeyword.text, weight: newKeyword.weight, synonyms }] });
    setNewKeyword({ text: "", weight: 1, synonymsText: "" });
  };

  const handleRemoveKeyword = (index: number) => {
    setFormData({ ...formData, keywords: formData.keywords.filter((_, i) => i !== index) });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    const oldValue = newOptions[index];
    newOptions[index] = value;

    let nextCorrectAnswer = formData.correctAnswer;
    if (typeof formData.correctAnswer === "string" && formData.correctAnswer === oldValue) {
      nextCorrectAnswer = value;
    }

    setFormData({ ...formData, options: newOptions, correctAnswer: nextCorrectAnswer });
  };

  const handleAddOption = () => {
    setFormData((prev) => ({ ...prev, options: [...prev.options, ""] }));
  };

  const handleAddOtherOption = () => {
    const otherLabel = "Other (student writes free answer)";
    setFormData((prev) => {
      if (prev.options.some((o) => o.trim().toLowerCase() === otherLabel.toLowerCase())) {
        return prev;
      }
      return { ...prev, options: [...prev.options, otherLabel] };
    });
  };

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => {
      if (prev.options.length <= 2) return prev;
      const removed = prev.options[index];
      const nextOptions = prev.options.filter((_, i) => i !== index);

      let nextCorrect = prev.correctAnswer;
      if (typeof prev.correctAnswer === "string" && prev.correctAnswer === removed) {
        nextCorrect = "";
      }

      return {
        ...prev,
        options: nextOptions,
        correctAnswer: nextCorrect,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormErrors({});
    const payload = {
      moduleId: formData.moduleId,
      topicId: formData.topicId || null,
      type: formData.type,
      difficulty: formData.difficulty,
      status: formData.status,
      text: formData.text,
      options: formData.type === "MCQ" || formData.type === "SCQ" ? formData.options.filter((o) => o.trim()) : [],
      correctAnswer: formData.correctAnswer,
      referenceAnswer: formData.referenceAnswer,
      keywords: formData.keywords,
    };
    const request = isEditing
      ? apiPatch<{ question: { id: string } }>(`teacher/questions/${id}`, payload)
      : apiPost<{ question: { id: string } }>("teacher/questions", payload);
    request
      .then(() => { toast.success(isEditing ? "Question updated" : "Question created"); navigate("/teacher/questions"); })
      .catch((err: any) => {
        if (err?.errors) setFormErrors(err.errors as Record<string, string>);
        toast.error(err instanceof Error ? err.message : "Failed to save question");
      })
      .finally(() => setSubmitLoading(false));
  };

  const difficultyPoints = formData.difficulty === "Easy" ? 1 : formData.difficulty === "Hard" ? 3 : 2;

  const runAiAssist = async (flags: { improve?: boolean; answer?: boolean; keywords?: boolean }) => {
    if (!formData.text.trim()) { toast.error("Add question text first"); return; }
    setAiBusy(true);
    try {
      const res = await apiPost<{ improved_question?: string; answer?: string; keywords?: string[]; error?: string }>(
        "teacher/ai/generate",
        { question: formData.text, options: { improve: !!flags.improve, answer: !!flags.answer, keywords: !!flags.keywords } }
      );
      if (res.error) { toast.error(res.error); return; }
      setFormData((prev) => {
        let next = { ...prev };
        if (flags.improve && res.improved_question?.trim()) next = { ...next, text: res.improved_question.trim() };
        if (flags.answer && res.answer?.trim()) next = { ...next, referenceAnswer: res.answer.trim() };
        if (flags.keywords && Array.isArray(res.keywords) && res.keywords.length > 0) {
          const existing = new Set(next.keywords.map((k) => k.text.toLowerCase()));
          const toAdd = res.keywords.map((t) => String(t).trim()).filter(Boolean).filter((t) => !existing.has(t.toLowerCase())).map((text) => ({ text, weight: 1, synonyms: [] as string[] }));
          next = { ...next, keywords: [...next.keywords, ...toAdd] };
        }
        return next;
      });
      toast.success("AI suggestions applied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiBusy(false);
    }
  };

  const handleQuickCreateTopic = async () => {
    if (!formData.moduleId) { toast.error("Select a module first"); return; }
    if (!quickTopicName.trim()) { toast.error("Topic name is required"); return; }
    setTopicCreating(true);
    try {
      const created = await apiPost<{ topic: { id: string; name: string; moduleId: string } }>("teacher/topics", { moduleId: formData.moduleId, name: quickTopicName.trim() });
      setModules((prev) => prev.map((m) => m.id === formData.moduleId ? { ...m, topics: [...m.topics, { id: created.topic.id, name: created.topic.name }] } : m));
      setFormData((prev) => ({ ...prev, topicId: created.topic.id }));
      setQuickTopicName("");
      setShowQuickTopicForm(false);
      toast.success("Topic created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setTopicCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="cq-root cq-loading">
        <Loader2 size={20} className="cq-ai-spin" style={{ color: "#6366f1" }} />
        Loading question form…
      </div>
    );
  }

  return (
    <div
      className="cq-root"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f8f7ff 0%, #fafaf9 50%, #f0fdf4 100%)",
        padding: "clamp(16px, 2.4vw, 28px) clamp(16px, 2.4vw, 28px) 60px",
      }}
    >
      <div className="cq-shell">
      {/* ── Back + Header ── */}
      <div className="cq-a1" style={{ marginBottom: 24 }}>
        <button className="cq-back-btn" onClick={() => navigate("/teacher/questions")}>
          <ArrowLeft size={14} />
          Back to Question Bank
        </button>
        <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#6366f1", marginBottom: 4 }}>
              {isEditing ? "Editing Question" : "New Question"}
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 400, color: "#0a0a0a", margin: 0 }}>
              {isEditing ? "Edit Question" : "Create New Question"}
            </h1>
            <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>
              {isEditing ? "Update the details below and save." : "Fill in the details to add a question to your bank."}
            </p>
          </div>
          <span className="cq-points-badge">
            {difficultyPoints} {difficultyPoints === 1 ? "point" : "points"} · {formData.difficulty}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="cq-form">

        {/* ── Module & Topic ── */}
        <div className="cq-section cq-a2">
          <div className="cq-section-header">
            <div className="cq-section-title">
              <div className="cq-section-icon" style={{ background: "#eef2ff" }}>
                <BookOpen size={15} color="#6366f1" />
              </div>
              Module & Topic
            </div>
          </div>
          <div className="cq-section-body">
            <div className="cq-grid-2">
              <div>
                <label className="cq-label">Module *</label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) => { setFormData({ ...formData, moduleId: value, topicId: "" }); setFormErrors((p) => ({ ...p, moduleId: "" })); }}
                >
                  <SelectTrigger className="cq-input" style={{ height: "auto" }}>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} – {m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.moduleId && <p className="cq-err">{formErrors.moduleId}</p>}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label className="cq-label" style={{ margin: 0 }}>Topic</label>
                  <button
                    type="button"
                    className="cq-ai-btn"
                    onClick={() => setShowQuickTopicForm((v) => !v)}
                    disabled={!formData.moduleId}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                  >
                    <Sparkles size={11} />
                    Quick Create
                  </button>
                </div>
                <Select value={formData.topicId} onValueChange={(v) => setFormData({ ...formData, topicId: v })} disabled={!formData.moduleId}>
                  <SelectTrigger className="cq-input" style={{ height: "auto" }}>
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedModule?.topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {showQuickTopicForm && (
                  <div className="cq-quick-topic-row">
                    <input
                      className="cq-input"
                      placeholder="New topic name"
                      value={quickTopicName}
                      onChange={(e) => setQuickTopicName(e.target.value)}
                    />
                    <button type="button" className="cq-btn-primary" style={{ padding: "9px 16px", fontSize: 13 }} onClick={handleQuickCreateTopic} disabled={topicCreating}>
                      {topicCreating ? <Loader2 size={13} className="cq-ai-spin" /> : "Add"}
                    </button>
                  </div>
                )}
                
              </div>
            </div>
          </div>
        </div>

        {/* ── Question Details ── */}
        <div className="cq-section cq-a3">
          <div className="cq-section-header">
            <div className="cq-section-title">
              <div className="cq-section-icon" style={{ background: "#fef3c7" }}>
                <Settings2 size={15} color="#d97706" />
              </div>
              Question Details
            </div>
          </div>
          <div className="cq-section-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Type */}
            <div>
              <label className="cq-label">Question Type *</label>
              <div className="cq-pill-group">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cq-pill ${formData.type === opt.value ? "active-type" : ""}`}
                    onClick={() => setFormData({ ...formData, type: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty + Status */}
            <div className="cq-grid-2">
              <div>
                <label className="cq-label">Difficulty *</label>
                <div className="cq-pill-group">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`cq-pill ${formData.difficulty === d ? `active-${d.toLowerCase()}` : ""}`}
                      onClick={() => setFormData({ ...formData, difficulty: d })}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="cq-label">Status *</label>
                <div className="cq-pill-group" style={{ flexWrap: "wrap" }}>
                  {STATUS_OPTIONS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`cq-pill ${formData.status === st ? "active-status" : ""}`}
                      onClick={() => setFormData({ ...formData, status: st })}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Question text */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label className="cq-label" style={{ margin: 0 }}>Question Text *</label>
                <button
                  type="button"
                  className="cq-ai-btn"
                  disabled={aiBusy || !formData.text.trim()}
                  onClick={() => runAiAssist({ improve: true })}
                >
                  {aiBusy ? <Loader2 size={12} className="cq-ai-spin" /> : <Wand2 size={12} />}
                  Improve wording
                </button>
              </div>
              <textarea
                className="cq-textarea"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question here…"
                rows={4}
              />
              {formErrors.text && <p className="cq-err">{formErrors.text}</p>}
            </div>
          </div>
        </div>

        {/* ── MCQ / SCQ Options ── */}
        {(formData.type === "MCQ" || formData.type === "SCQ") && (
          <div className="cq-section cq-a4">
            <div className="cq-section-header">
              <div className="cq-section-title">
                <div className="cq-section-icon" style={{ background: "#ecfdf5" }}>
                  <CheckSquare size={15} color="#10b981" />
                </div>
                Answer Options
              </div>
            </div>
            <div className="cq-section-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {formData.options.map((option, index) => {
                const isSelected = formData.correctAnswer === option && option.trim() !== "";
                return (
                  <div
                    key={index}
                    className={`cq-option-row ${isSelected ? "selected" : ""}`}
                    onClick={() => { if (option.trim()) setFormData({ ...formData, correctAnswer: option }); }}
                  >
                    <div className={`cq-radio-custom ${isSelected ? "checked" : ""}`} />
                    <input
                      className="cq-option-input"
                      value={option}
                      onChange={(e) => { handleOptionChange(index, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`Option ${index + 1}`}
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        className="cq-remove-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveOption(index);
                        }}
                      >
                        Remove
                      </button>
                    )}
                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>✓ Correct</span>
                    )}
                  </div>
                );
              })}
              <div className="cq-option-actions">
                <button type="button" className="cq-mini-btn" onClick={handleAddOption}>
                  Add Option
                </button>
                <button type="button" className="cq-mini-btn" onClick={handleAddOtherOption}>
                  Add "Other" Option
                </button>
              </div>
              <p className="cq-hint">Click a row to mark it as the correct answer.</p>
              {formErrors.correctAnswer && <p className="cq-err">{formErrors.correctAnswer}</p>}
            </div>
          </div>
        )}

        {/* ── True / False ── */}
        {formData.type === "True/False" && (
          <div className="cq-section cq-a4">
            <div className="cq-section-header">
              <div className="cq-section-title">
                <div className="cq-section-icon" style={{ background: "#ecfdf5" }}>
                  <CheckSquare size={15} color="#10b981" />
                </div>
                Correct Answer
              </div>
            </div>
            <div className="cq-section-body" style={{ display: "flex", gap: 10 }}>
              {["True", "False"].map((val) => (
                <div
                  key={val}
                  className={`cq-tf-option ${formData.correctAnswer === val ? "selected" : ""}`}
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setFormData({ ...formData, correctAnswer: val })}
                >
                  <div className={`cq-radio-custom ${formData.correctAnswer === val ? "checked" : ""}`} />
                  {val}
                </div>
              ))}
            </div>
            {formErrors.correctAnswer && <p className="cq-err" style={{ padding: "0 22px 16px" }}>{formErrors.correctAnswer}</p>}
          </div>
        )}

        {/* ── Descriptive ── */}
        {formData.type === "Descriptive" && (
          <>
            {/* Reference Answer */}
            <div className="cq-section cq-a4">
              <div className="cq-section-header">
                <div className="cq-section-title">
                  <div className="cq-section-icon" style={{ background: "#f0f9ff" }}>
                    <BookOpen size={15} color="#0ea5e9" />
                  </div>
                  Reference Answer
                </div>
                <button
                  type="button"
                  className="cq-ai-btn"
                  disabled={aiBusy || !formData.text.trim()}
                  onClick={() => runAiAssist({ answer: true })}
                >
                  {aiBusy ? <Loader2 size={12} className="cq-ai-spin" /> : <Wand2 size={12} />}
                  Generate model answer
                </button>
              </div>
              <div className="cq-section-body">
                <textarea
                  className="cq-textarea"
                  value={formData.referenceAnswer}
                  onChange={(e) => setFormData({ ...formData, referenceAnswer: e.target.value })}
                  placeholder="Provide a model answer for reference…"
                  rows={5}
                />
              </div>
            </div>

            {/* Keywords */}
            <div className="cq-section cq-a5">
              <div className="cq-section-header">
                <div className="cq-section-title">
                  <div className="cq-section-icon" style={{ background: "#fdf4ff" }}>
                    <Tag size={15} color="#a855f7" />
                  </div>
                  Keywords for Auto-Grading
                </div>
                <button
                  type="button"
                  className="cq-ai-btn"
                  disabled={aiBusy || !formData.text.trim()}
                  onClick={() => runAiAssist({ keywords: true })}
                >
                  {aiBusy ? <Loader2 size={12} className="cq-ai-spin" /> : <Sparkles size={12} />}
                  Suggest keywords
                </button>
              </div>
              <div className="cq-section-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  Keywords must appear in student answers. Add comma-separated synonyms to handle wording variations.
                </p>

                {/* Add row */}
                <div className="cq-keyword-row">
                  <input
                    className="cq-input"
                    placeholder="Keyword"
                    value={newKeyword.text}
                    onChange={(e) => setNewKeyword({ ...newKeyword, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddKeyword(); } }}
                  />
                  <input
                    className="cq-input"
                    placeholder="Synonyms (comma-separated)"
                    value={newKeyword.synonymsText}
                    onChange={(e) => setNewKeyword({ ...newKeyword, synonymsText: e.target.value })}
                  />
                  <input
                    className="cq-input"
                    type="number"
                    min={1}
                    max={10}
                    placeholder="Wt"
                    value={newKeyword.weight}
                    onChange={(e) => setNewKeyword({ ...newKeyword, weight: parseInt(e.target.value || "1", 10) })}
                    style={{ width: 60 }}
                  />
                  <button type="button" className="cq-add-btn" onClick={handleAddKeyword}>
                    <Plus size={15} />
                  </button>
                </div>

                {/* Chips */}
                {formData.keywords.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {formData.keywords.map((kw, i) => (
                      <span key={i} className="cq-chip">
                        {kw.text}
                        {kw.synonyms && kw.synonyms.length > 0 && (
                          <span style={{ color: "#818cf8", fontWeight: 400 }}> ({kw.synonyms.join(", ")})</span>
                        )}
                        <span className="cq-chip-weight">{kw.weight}</span>
                        <button type="button" className="cq-chip-remove" onClick={() => handleRemoveKeyword(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {formData.keywords.length > 0 && (
                  <p className="cq-hint" style={{ margin: 0 }}>
                    Total weight: <strong>{formData.keywords.reduce((s, k) => s + k.weight, 0)}</strong> / {difficultyPoints} points
                  </p>
                )}
                {formErrors.keywords && <p className="cq-err">{formErrors.keywords}</p>}
              </div>
            </div>
          </>
        )}

        {/* ── Submit ── */}
        <div className="cq-a6" style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
          <button type="button" className="cq-btn-ghost" onClick={() => navigate("/teacher/questions")}>
            Cancel
          </button>
          <button type="submit" className="cq-btn-primary" disabled={submitLoading}>
            {submitLoading ? <Loader2 size={14} className="cq-ai-spin" /> : null}
            {isEditing ? "Update Question" : "Create Question"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}