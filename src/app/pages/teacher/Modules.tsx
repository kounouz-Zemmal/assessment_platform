import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { apiGet } from "../../apiClient";
import { useAuth } from "../../contexts/AuthContext";

export default function TeacherModules() {
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Modules & Topics</h1>
        <p className="text-gray-500 mt-1">
          View the modules and topics you are assigned to.
        </p>
      </div>

      <div className="mb-6">
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
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading modules...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {modules.length === 0
              ? "You are not currently assigned to any modules."
              : "No modules match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((module) => {
            return (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{module.code}</CardTitle>
                        <p className="text-sm text-gray-500">{module.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{module.teachingRole}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{module.description}</p>

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
  );
}

