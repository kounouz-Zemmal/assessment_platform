import { Outlet, useNavigate, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  ClipboardList, 
  History, 
  User,
  LogOut 
} from "lucide-react";
import { Button } from "../components/ui/button";
import { getCurrentUser } from "../mockData";
import Unauthorized from "../pages/Unauthorized";

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  if (user.role !== "student") {
    return <Unauthorized />;
  }

  const navigation = [
    { name: "Dashboard", href: "/student", icon: LayoutDashboard },
    { name: "My Assessments", href: "/student/assessments", icon: ClipboardList },
    { name: "History", href: "/student/history", icon: History },
    { name: "Profile", href: "/student/profile", icon: User },
  ];

  const handleLogout = () => {
    navigate("/");
  };

  // Hide sidebar when taking exam
  const isExamPage = location.pathname.includes("/take");

  if (isExamPage) {
    return (
      <div className="h-screen bg-gray-50">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">University Assessment</h1>
          <p className="text-sm text-gray-500 mt-1">Student Portal</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
