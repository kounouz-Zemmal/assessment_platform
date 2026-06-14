import { Users, BookOpen, GraduationCap, UserCog, Activity } from "lucide-react";
import { StatCard } from "../../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { users, modules, teacherAssignments, studentEnrollments } from "../../mockData";

export default function AdminDashboard() {
  const totalUsers = users.length;
  const totalTeachers = users.filter((u) => u.role === "teacher").length;
  const totalStudents = users.filter((u) => u.role === "student").length;
  const totalModules = modules.length;

  // Recent activity (mock data)
  const recentActivity = [
    { id: 1, action: "New student enrolled", details: "Alice Johnson enrolled in CS101", time: "2 hours ago" },
    { id: 2, action: "Teacher assigned", details: "Dr. John Doe assigned to CS201 as Lecturer", time: "5 hours ago" },
    { id: 3, action: "New module created", details: "Database Systems (CS301) created", time: "1 day ago" },
    { id: 4, action: "User account activated", details: "Bob Williams account activated", time: "2 days ago" },
    { id: 5, action: "Assessment published", details: "Python Basics Quiz published", time: "3 days ago" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your university assessment platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          description="All registered users"
        />
        <StatCard
          title="Teachers"
          value={totalTeachers}
          icon={UserCog}
          description="Active teaching staff"
        />
        <StatCard
          title="Students"
          value={totalStudents}
          icon={GraduationCap}
          description="Enrolled students"
        />
        <StatCard
          title="Modules"
          value={totalModules}
          icon={BookOpen}
          description="Active modules"
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
              >
                <div className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{activity.details}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
