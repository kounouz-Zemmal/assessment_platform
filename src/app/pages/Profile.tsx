import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { getCurrentUser } from "../mockData";
import { toast } from "sonner";

export default function Profile() {
  const user = getCurrentUser();

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with backend change-password endpoint
    toast.success("Password change request submitted (demo only).");
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">View your account information and update your password</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500">Full Name</p>
              <p className="text-sm text-gray-900">{user.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Email</p>
              <p className="text-sm text-gray-900">{user.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500">Role</p>
                <p className="text-sm capitalize text-gray-900">{user.role}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Member Since</p>
                <p className="text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" placeholder="Enter current password" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" placeholder="Enter new password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" placeholder="Re-enter new password" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                For demo purposes, this form does not change any real credentials. In a real system,
                this would call a secure backend API.
              </p>
              <div className="flex justify-end">
                <Button type="submit">Update Password</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

