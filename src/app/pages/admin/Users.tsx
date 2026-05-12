import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, UserPlus, Upload, Users, GraduationCap } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { apiGet, apiPost, apiDelete } from "../../apiClient";
import { toast } from "sonner";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ImportResult {
  created: { id: number; email: string; name: string }[];
  skipped: string[];
  errors: string[];
}

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [teacherFile, setTeacherFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "student" as 'admin' | 'teacher' | 'student',
  });

  const loadUsers = async (page = 1, search = "", role = "") => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pagination.pageSize };
      if (search) params.search = search;
      if (role && role !== "all") params.role = role;

      const response = await apiGet<UsersResponse>("admin/users", params);
      const usersWithName = response.users.map(user => ({
        ...user,
        name: `${user.firstName} ${user.lastName}`.trim(),
      }));
      setUsers(usersWithName);
      setPagination(response.pagination);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = () => {
    loadUsers(1, searchQuery, roleFilter);
  };

  const handleCreateUser = async () => {
    try {
      await apiPost("admin/users/create", formData);
      toast.success("User created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      toast.error("Failed to create user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiDelete(`admin/users/${userId}/delete`);
      toast.success("User deleted successfully");
      loadUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const uploadCsv = async (file: File, endpoint: string): Promise<ImportResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Import failed");
    return json.data as ImportResult;
  };

  const handleCsvImport = async (type: "students" | "teachers") => {
    const file = type === "students" ? studentFile : teacherFile;
    if (!file) return;

    setCsvImporting(true);
    setImportResult(null);
    try {
      const endpoint =
        type === "students"
          ? "admin/users/import-csv"
          : "admin/users/import-teachers-csv";

      const result = await uploadCsv(file, endpoint);
      setImportResult(result);

      if (result.created.length > 0)
        toast.success(`${result.created.length} ${type} imported`);
      if (result.skipped.length > 0)
        toast.info(`${result.skipped.length} already existed, skipped`);
      if (result.errors.length > 0)
        toast.warning(`${result.errors.length} rows had errors`);

      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setCsvImporting(false);
    }
  };

  const resetForm = () => {
    setFormData({ firstName: "", lastName: "", email: "", password: "", role: "student" });
  };

  const closeCsvDialog = () => {
    setIsCsvDialogOpen(false);
    setStudentFile(null);
    setTeacherFile(null);
    setImportResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <div className="flex gap-2">

          {/* ── CSV Import Dialog ── */}
          <Dialog open={isCsvDialogOpen} onOpenChange={(open) => { if (!open) closeCsvDialog(); else setIsCsvDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Users from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV exported from Progres. Passwords are auto-generated from the matricule / teacher abbreviation.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="students">
                <TabsList className="w-full">
                  <TabsTrigger value="students" className="flex-1">
                    <GraduationCap className="h-4 w-4 mr-1" /> Students
                  </TabsTrigger>
                  <TabsTrigger value="teachers" className="flex-1">
                    <Users className="h-4 w-4 mr-1" /> Teachers
                  </TabsTrigger>
                </TabsList>

                {/* Students tab */}
                <TabsContent value="students" className="space-y-3 pt-2">
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p className="font-medium">Expected columns (Progres format):</p>
                    <code className="text-xs text-muted-foreground block">
                      Mat. Etudiant · Nom · Prénom · Email · Situation · Group · Section · Niveau 2024-2025
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Default password = matricule number. Students already in the system are skipped.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="student-csv">CSV File</Label>
                    <Input
                      id="student-csv"
                      type="file"
                      accept=".csv"
                      onChange={(e) => { setStudentFile(e.target.files?.[0] || null); setImportResult(null); }}
                    />
                  </div>
                  {importResult && (
                    <div className="text-sm space-y-1 border rounded p-2">
                      <p className="text-green-600">✓ {importResult.created.length} created</p>
                      {importResult.skipped.length > 0 && <p className="text-yellow-600">⊘ {importResult.skipped.length} skipped (already exist)</p>}
                      {importResult.errors.length > 0 && (
                        <details>
                          <summary className="text-red-600 cursor-pointer">✗ {importResult.errors.length} errors</summary>
                          <ul className="mt-1 text-xs text-red-500 space-y-0.5 max-h-24 overflow-y-auto">
                            {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={closeCsvDialog}>Cancel</Button>
                    <Button onClick={() => handleCsvImport("students")} disabled={!studentFile || csvImporting}>
                      {csvImporting ? "Importing…" : "Import Students"}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                {/* Teachers tab */}
                <TabsContent value="teachers" className="space-y-3 pt-2">
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p className="font-medium">Expected columns (Progres format):</p>
                    <code className="text-xs text-muted-foreground block">
                      Faculty Member · AbvEns · Grade · Email · Département
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Default password = teacher abbreviation (AbvEns). Teachers already in the system are skipped.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="teacher-csv">CSV File</Label>
                    <Input
                      id="teacher-csv"
                      type="file"
                      accept=".csv"
                      onChange={(e) => { setTeacherFile(e.target.files?.[0] || null); setImportResult(null); }}
                    />
                  </div>
                  {importResult && (
                    <div className="text-sm space-y-1 border rounded p-2">
                      <p className="text-green-600">✓ {importResult.created.length} created</p>
                      {importResult.skipped.length > 0 && <p className="text-yellow-600">⊘ {importResult.skipped.length} skipped (already exist)</p>}
                      {importResult.errors.length > 0 && (
                        <details>
                          <summary className="text-red-600 cursor-pointer">✗ {importResult.errors.length} errors</summary>
                          <ul className="mt-1 text-xs text-red-500 space-y-0.5 max-h-24 overflow-y-auto">
                            {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={closeCsvDialog}>Cancel</Button>
                    <Button onClick={() => handleCsvImport("teachers")} disabled={!teacherFile || csvImporting}>
                      {csvImporting ? "Importing…" : "Import Teachers"}
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* ── Add User Dialog ── */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateUser}>Create User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}><Search className="h-4 w-4" /></Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell><StatusBadge status={user.isActive ? "active" : "inactive"} /></TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction asChild>
                                  <Button variant="destructive" onClick={() => handleDeleteUser(user.id)}>Delete</Button>
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Showing {users.length} of {pagination.total} users
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1, searchQuery, roleFilter)}>
                    Previous
                  </Button>
                  <span className="px-3 py-2">Page {pagination.page} of {pagination.totalPages}</span>
                  <Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => loadUsers(pagination.page + 1, searchQuery, roleFilter)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
