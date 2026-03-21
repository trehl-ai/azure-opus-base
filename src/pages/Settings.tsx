import { Routes, Route, Navigate } from "react-router-dom";
import SettingsLayout from "@/components/settings/SettingsLayout";
import ProfileSettings from "@/pages/settings/ProfileSettings";
import SecuritySettings from "@/pages/settings/SecuritySettings";
import PlaceholderSettings from "@/pages/settings/PlaceholderSettings";

export default function SettingsPage() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfileSettings />} />
        <Route path="security" element={<SecuritySettings />} />
        <Route path="general" element={<PlaceholderSettings title="Allgemein" />} />
        <Route path="users" element={<PlaceholderSettings title="Benutzerverwaltung" />} />
        <Route path="roles" element={<PlaceholderSettings title="Rollen & Rechte" />} />
        <Route path="pipelines" element={<PlaceholderSettings title="Pipelines" />} />
        <Route path="tags" element={<PlaceholderSettings title="Tags" />} />
        <Route path="deal-fields" element={<PlaceholderSettings title="Deal-Felder" />} />
      </Route>
    </Routes>
  );
}
