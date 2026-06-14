import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { apiGet } from "../../apiClient";
import { useAuth } from "../../contexts/AuthContext";

const injectStyles = () => {
  if (document.getElementById("tm-styles")) return;
  const s = document.createElement("style");
  s.id = "tm-styles";
  s.textContent = `
    @keyframes tm-fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes tm-bg-pan {
      from { background-position: 0% 0%; }
      to { background-position: 100% 100%; }
    }

    .tm-root {
      background-size: 180% 180%;
      animation: tm-bg-pan 18s ease-in-out infinite alternate;
    }

    .tm-shell {
      width: 100%;
      max-width: 1320px;
      margin: 0 auto;
      padding: clamp(16px, 2.4vw, 32px);
    }

    .tm-hero {
      border-radius: 20px;
      background: #fff;
      border: 1px solid rgba(0,0,0,.07);
      box-shadow: 0 2px 12px rgba(0,0,0,.06);
      padding: clamp(18px, 2.4vw, 28px);
      margin-bottom: 20px;
      animation: tm-fade-up .45s ease both;
    }

    .tm-search {
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,.08);
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(3px);
      padding: 12px;
      margin-bottom: 18px;
      animation: tm-fade-up .45s .06s ease both;
    }

    .tm-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      gap: 16px;
      align-items: stretch;
    }

    .tm-card {
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,.07);
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
      animation: tm-fade-up .45s ease both;
    }
    .tm-card:hover {
      transform: translateY(-2px);
      border-color: rgba(99,102,241,.2);
      box-shadow: 0 10px 24px rgba(79,70,229,.1);
    }

    .tm-empty {
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,.07);
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      animation: tm-fade-up .45s ease both;
    }
  `;
  document.head.appendChild(s);
};

export default function TeacherModules() {
  injectStyles();

  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      description: string;
      teachingRole: string;
      topics: Array<{ id: string; name: string }>;
    }>
  >([]);

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiGet<{ modules: Array<{ id: string; code: string; name: string; description: string; teachingRole: string; topics: Array<{ id: string; name: string }> }> }>("teacher/modules")
      .then((data) => setModules(data.modules))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load modules"))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(
    () =>
      modules.filter(
        (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [modules, searchQuery]
  );

  return (
    <div
      className="tm-root"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f8f7ff 0%, #fafaf9 50%, #f0fdf4 100%)",
      }}
    >
      <div className="tm-shell">
        <div className="tm-hero">
          <h1 className="text-3xl font-bold text-gray-900">My Modules & Topics</h1>
          <p className="text-gray-500 mt-1">
            View the modules and topics you are assigned to.
          </p>
        </div>

        <div className="tm-search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <Card className="tm-empty">
            <CardContent className="py-12 text-center text-gray-500">
              Loading modules...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="tm-empty">
            <CardContent className="py-12 text-center text-red-600">
              {error}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="tm-empty">
            <CardContent className="py-12 text-center text-gray-500">
              {modules.length === 0
                ? "You are not currently assigned to any modules."
                : "No modules match your search."}
            </CardContent>
          </Card>
        ) : (
          <div className="tm-grid">
            {filtered.map((module) => {
              return (
                <Card key={module.id} className="tm-card">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-lg truncate">{module.code}</CardTitle>
                          <p className="text-sm text-gray-500 truncate">{module.name}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{module.teachingRole}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      {module.description || "No description provided."}
                    </p>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        Topics ({module.topics.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {module.topics.map((topic) => (
                          <Badge key={topic.id} variant="outline" className="text-xs">
                            {topic.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

