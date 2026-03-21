import { Routes, Route, Navigate } from "react-router-dom";
import SettingsLayout from "@/components/settings/SettingsLayout";
import ProfileSettings from "@/pages/settings/ProfileSettings";
import SecuritySettings from "@/pages/settings/SecuritySettings";
import UsersSettings from "@/pages/settings/UsersSettings";
import RolesSettings from "@/pages/settings/RolesSettings";
import GeneralSettings from "@/pages/settings/GeneralSettings";
import PlaceholderSettings from "@/pages/settings/PlaceholderSettings";

export default function SettingsPage() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfileSettings />} />
        <Route path="security" element={<SecuritySettings />} />
        <Route path="general" element={<GeneralSettings />} />
        <Route path="users" element={<UsersSettings />} />
        <Route path="roles" element={<RolesSettings />} />
        <Route path="pipelines" element={<PlaceholderSettings title="Pipelines" />} />
        <Route path="tags" element={<PlaceholderSettings title="Tags" />} />
        <Route path="deal-fields" element={<PlaceholderSettings title="Deal-Felder" />} />
      </Route>
    </Routes>
  );
}
