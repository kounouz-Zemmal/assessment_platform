import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { apiGet, apiPost, apiDelete } from "../../apiClient";
import { TeacherAssignment, TeachingRole, User, Module } from "../../types";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";

type TeacherApiResponse = {
  teachers: Array<{ id: string | number; userId: string | number; name: string; roleInModule: string; isResponsible: boolean }>;
};

type AssignmentApiResponse = {
  assignment: { id: string | number; userId: string | number; name: string; roleInModule: string; isResponsible: boolean };
};

type ModuleListApiResponse = {
  modules: Array<{ id: string; code: string; name: string }>;
};

type UsersApiResponse = {
  users: User[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function AdminTeacherAssignment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    teacherId: "",
    moduleId: "",
    teachingRole: "LECTURER" as TeachingRole,
  });

  const filteredAssignments = assignments.filter((assignment) => {
    const teacher = teachers.find((u) => u.id === assignment.teacherId);
    const module = modules.find((m) => m.id === assignment.moduleId);
    const searchLower = searchQuery.toLowerCase();

    const teacherMatches = teacher?.name
      ? teacher.name.toLowerCase().includes(searchLower)
      : false;
    const moduleCodeMatches = module?.code
      ? module.code.toLowerCase().includes(searchLower)
      : false;
    const moduleNameMatches = module?.name
      ? module.name.toLowerCase().includes(searchLower)
      : false;

    return (
      teacherMatches ||
      moduleCodeMatches ||
      moduleNameMatches ||
      assignment.teachingRole.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateAssignment = async () => {
    if (!formData.teacherId || !formData.moduleId) {
      toast.error("Please select both teacher and module");
      return;
    }

    try {
      const response = await apiPost<AssignmentApiResponse>(`admin/modules/${formData.moduleId}/assign-teacher`, {
        userId: formData.teacherId,
        roleInModule: formData.teachingRole,
      });

      if (!response || !response.assignment) {
        throw new Error("Invalid response from server");
      }

      const newAssignment: TeacherAssignment = {
        id: response.assignment.id,
        teacherId: response.assignment.userId,
        moduleId: formData.moduleId,
        teachingRole: response.assignment.roleInModule as TeachingRole,
      };

      setAssignments([...assignments, newAssignment]);
      toast.success("Teacher assigned successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to assign teacher";
      console.error("Error assigning teacher:", error);
      toast.error(errorMsg);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string, moduleId: string) => {
    try {
      await apiDelete(`admin/modules/${moduleId}/assign-teacher/${assignmentId}`);
      setAssignments(assignments.filter((a) => a.id !== assignmentId));
      toast.success("Teacher assignment removed");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to remove assignment";
      console.error("Error removing assignment:", error);
      toast.error(errorMsg);
    }
  };

  const resetForm = () => {
    setFormData({
      teacherId: "",
      moduleId: "",
      teachingRole: "LECTURER",
    });
  };

  const loadAssignments = async (moduleList: Module[]) => {
    try {
      const assignmentsByModule = await Promise.all(
        moduleList.map(async (module) => {
          const response = await apiGet<TeacherApiResponse>(`admin/modules/${module.id}/teachers`);
          if (!response || !response.teachers) return [];
          return response.teachers.map((teacher) => ({
            id: teacher.id,
            teacherId: teacher.userId,
            moduleId: module.id,
            teachingRole: teacher.roleInModule as TeachingRole,
          }));
        })
      );
      setAssignments(assignmentsByModule.flat());
    } catch (error) {
      console.error("Error loading assignments:", error);
      toast.error("Failed to load assignments");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [moduleResponse, userResponse] = await Promise.all([
        apiGet<ModuleListApiResponse>("admin/modules"),
        apiGet<UsersApiResponse>("admin/users?role=teacher&page=1&page_size=100"),
      ]);

      const loadedModules = moduleResponse.modules.map((module) => ({ ...module, topics: [] }));
      setModules(loadedModules);
      setTeachers(
        userResponse.users.map((user) => ({
          ...user,
          name:
            user.name ||
            `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
            user.email,
        }))
      );
      await loadAssignments(loadedModules);
    } catch (error) {
      console.error('Failed to load teacher assignments:', error);
      toast.error("Failed to load teacher assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group assignments by module
  const assignmentsByModule = modules.map((module) => ({
    module,
    assignments: assignments.filter((a) => a.moduleId === module.id),
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Assignment</h1>
          <p className="text-gray-500 mt-1">Assign teachers to modules with specific roles</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign Teacher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Teacher to Module</DialogTitle>
              <DialogDescription>
                Select a teacher, module, and teaching role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teacher">Teacher</Label>
                <Select value={formData.teacherId} onValueChange={(value) => setFormData({ ...formData, teacherId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="module">Module</Label>
                <Select value={formData.moduleId} onValueChange={(value) => setFormData({ ...formData, moduleId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={String(module.id)}>
                        {module.code} - {module.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Teaching Role</Label>
                <Select value={formData.teachingRole} onValueChange={(value) => setFormData({ ...formData, teachingRole: value as TeachingRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LECTURER">Lecturer</SelectItem>
                    <SelectItem value="LAB_TEACHER">Lab Instructor</SelectItem>
                    <SelectItem value="TD_TEACHER">Tutorial Instructor</SelectItem>
                    <SelectItem value="ASSISTANT">Assistant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by teacher, module, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading teacher assignments...</div>
      ) : (
        <div className="space-y-6">
          {assignmentsByModule.map((entry) => {
            const { module, assignments: moduleAssignments } = entry;
            return (
              <Card key={module.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <span className="text-lg">{module.code}</span>
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        {module.name}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {moduleAssignments.length} {moduleAssignments.length === 1 ? "teacher" : "teachers"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {moduleAssignments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No teachers assigned to this module
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teacher Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Teaching Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {moduleAssignments.map((assignment) => {
                          const teacher = teachers.find((u) => u.id === assignment.teacherId);
                          return (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">{teacher?.name}</TableCell>
                              <TableCell>{teacher?.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{assignment.teachingRole}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAssignment(String(assignment.id), String(module.id))}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
