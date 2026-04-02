import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useMinimumSkeletonTime } from "../hooks/useMinimumSkeletonTime";
import { getCurrentUser } from "../mockData";
import { toast } from "sonner";
import { apiGet } from "../apiClient";

const namePrefixes = new Set([
  "dr.",
  "dr",
  "prof.",
  "prof",
  "mr.",
  "mr",
  "ms.",
  "ms",
  "mrs.",
  "mrs",
]);

function getUserNames(fullName: string) {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  const cleanedTokens = tokens.filter(
    (token) => !namePrefixes.has(token.toLowerCase()),
  );

  if (cleanedTokens.length === 0) {
    return { firstName: "N/A", lastName: "N/A" };
  }

  if (cleanedTokens.length === 1) {
    return { firstName: cleanedTokens[0], lastName: "N/A" };
  }

  return {
    firstName: cleanedTokens[0],
    lastName: cleanedTokens.slice(1).join(" "),
  };
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const [user, setUser] = useState(currentUser);
  const [apiAssignments, setApiAssignments] = useState<
    Array<{
      id: string;
      moduleCode: string;
      moduleName: string;
      teachingRole: string;
    }>
  >([]);
  const [loading, setLoading] = useState(currentUser.role === "teacher");
  const [loadError, setLoadError] = useState<string | null>(null);
  const showLoadingSkeleton = useMinimumSkeletonTime(loading);

  useEffect(() => {
    if (currentUser.role !== "teacher") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    apiGet<{
      user: {
        id: string;
        firstName?: string;
        lastName?: string;
        name: string;
        email: string;
        role: "admin" | "teacher" | "student";
        status: "active" | "inactive";
        createdAt: string;
      };
      teacherAssignments: Array<{
        id: string;
        moduleCode: string;
        moduleName: string;
        teachingRole: string;
      }>;
    }>("teacher/profile", { user_id: currentUser.id })
      .then((data) => {
        setUser(data.user);
        setApiAssignments(data.teacherAssignments);
      })
      .catch(() => {
        setLoadError("Could not load profile from backend.");
        toast.error("Could not load profile from backend.");
      })
      .finally(() => setLoading(false));
  }, [currentUser.id, currentUser.role]);

  const parsedNames = getUserNames(user.name);
  const firstName = user.firstName ?? parsedNames.firstName;
  const lastName = user.lastName ?? parsedNames.lastName;

  const teacherModuleAssignments = useMemo(
    () => apiAssignments,
    [apiAssignments],
  );
  const accountAgeDays = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with backend change-password endpoint
    toast.success("Password change request submitted (demo only).");
  };

  if (showLoadingSkeleton) {
    return (
      <div className="p-3 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-5 w-80" />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (currentUser.role === "teacher" && loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              Profile data not available.
            </p>
            <p className="text-sm text-gray-500 mt-1">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <Badge variant="outline" className="mb-2 bg-white">
          Account Center
        </Badge>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          My Profile
        </h1>
        <p className="text-gray-500 mt-1">
          View your account information and update your password
        </p>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold">
                {firstName.charAt(0)}
                {lastName !== "N/A" ? lastName.charAt(0) : ""}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {firstName} {lastName !== "N/A" ? lastName : ""}
                </p>
                <p className="text-sm text-gray-500 break-all">{user.email}</p>
              </div>
              <Badge
                variant="outline"
                className="sm:ml-auto self-start sm:self-auto capitalize"
              >
                {user.role}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">
                Active for {accountAgeDays} days
              </Badge>
              {user.role === "teacher" && (
                <Badge variant="secondary">
                  Assigned modules: {teacherModuleAssignments.length}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  First Name
                </p>
                <p className="text-sm text-gray-900">{firstName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Last Name</p>
                <p className="text-sm text-gray-900">{lastName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Role</p>
                <p className="text-sm capitalize text-gray-900">{user.role}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Member Since
                </p>
                <p className="text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              This page displays only the currently authenticated account
              information.
            </p>
          </CardContent>
        </Card>

        {user.role === "teacher" && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Assigned Modules</CardTitle>
            </CardHeader>
            <CardContent>
              {teacherModuleAssignments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No module assignments found.
                </p>
              ) : (
                <div className="space-y-3">
                  {teacherModuleAssignments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.moduleCode} - {item.moduleName}
                        </p>
                      </div>
                      <Badge variant="outline">{item.teachingRole}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                For demo purposes, this form does not change any real
                credentials. In a real system, this would call a secure backend
                API.
              </p>
              <div className="flex justify-end">
                <Button type="submit" className="w-full sm:w-auto">
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
