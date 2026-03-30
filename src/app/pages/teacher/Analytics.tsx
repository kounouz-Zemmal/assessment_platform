import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { assessments, submissions, questions, getCurrentUser } from "../../mockData";

export default function TeacherAnalytics() {
  const currentUser = getCurrentUser();
  const myAssessments = assessments.filter((a) => a.createdBy === currentUser.id);

  // Mock analytics data
  const scoreDistribution = [
    { range: "0-20", count: 2 },
    { range: "21-40", count: 5 },
    { range: "41-60", count: 8 },
    { range: "61-80", count: 12 },
    { range: "81-100", count: 6 },
  ];

  const assessmentScores = myAssessments.slice(0, 5).map((assessment) => ({
    name: assessment.title.slice(0, 15) + "...",
    average: Math.floor(Math.random() * 40) + 60,
  }));

  const questionDifficulty = [
    { name: "Easy", value: 45, color: "#10b981" },
    { name: "Medium", value: 35, color: "#f59e0b" },
    { name: "Hard", value: 20, color: "#ef4444" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Performance insights and statistics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Number of Students" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Assessment Average Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Average Scores by Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assessmentScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="average" fill="#10b981" name="Average Score (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Question Difficulty */}
        <Card>
          <CardHeader>
            <CardTitle>Question Difficulty Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={questionDifficulty}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {questionDifficulty.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <span className="text-gray-700">Total Assessments</span>
                <span className="text-2xl font-bold text-blue-600">{myAssessments.length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="text-gray-700">Total Submissions</span>
                <span className="text-2xl font-bold text-green-600">
                  {submissions.filter((s) => myAssessments.some((a) => a.id === s.assessmentId)).length}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <span className="text-gray-700">Average Class Score</span>
                <span className="text-2xl font-bold text-purple-600">72%</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                <span className="text-gray-700">Questions in Bank</span>
                <span className="text-2xl font-bold text-orange-600">
                  {questions.filter((q) => q.createdBy === currentUser.id).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
