import { Outlet, useNavigate, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  FileQuestion,
  ClipboardList,
  GraduationCap,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { getCurrentUser } from "../mockData";
import Unauthorized from "../pages/Unauthorized";

export default function TeacherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (user.role !== "teacher") {
    return <Unauthorized />;
  }

  const navigation = [
    { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { name: "Question Bank", href: "/teacher/questions", icon: FileQuestion },
    { name: "Modules & Topics", href: "/teacher/modules", icon: BookOpen },
    { name: "Assessments", href: "/teacher/assessments", icon: ClipboardList },
    { name: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
    {
      name: "Result Visibility",
      href: "/teacher/results-visibility",
      icon: Settings,
    },
    { name: "Profile", href: "/teacher/profile", icon: GraduationCap },
  ];

  const handleLogout = () => {
    setMobileMenuOpen(false);
    navigate("/");
  };

  const handleNavigate = (href: string) => {
    setMobileMenuOpen(false);
    navigate(href);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[300px] p-0 sm:w-[340px]">
          <SheetHeader className="p-4 border-b border-gray-200 text-left">
            <SheetTitle>Teacher Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Navigation menu for teacher pages.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-lg font-bold text-gray-900">
                University Assessment
              </h1>
              <p className="text-sm text-gray-500 mt-1">Teacher Portal</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/teacher" &&
                    location.pathname.startsWith(item.href));
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigate(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left ${
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">
            University Assessment
          </h1>
          <p className="text-sm text-gray-500 mt-1">Teacher Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/teacher" &&
                location.pathname.startsWith(item.href));
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
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                Teacher Portal
              </p>
              <p className="text-xs text-gray-500 truncate">{user.name}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
