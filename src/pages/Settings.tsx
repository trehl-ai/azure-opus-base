import { Routes, Route, Navigate } from "react-router-dom";
import SettingsLayout from "@/components/settings/SettingsLayout";
import ProfileSettings from "@/pages/settings/ProfileSettings";
import SecuritySettings from "@/pages/settings/SecuritySettings";
import UsersSettings from "@/pages/settings/UsersSettings";
import RolesSettings from "@/pages/settings/RolesSettings";
import GeneralSettings from "@/pages/settings/GeneralSettings";
import PipelinesSettings from "@/pages/settings/PipelinesSettings";
import TaskStatusesSettings from "@/pages/settings/TaskStatusesSettings";
import TagsSettings from "@/pages/settings/TagsSettings";
import EmailAccountsSettings from "@/pages/settings/EmailAccountsSettings";
import PlaceholderSettings from "@/pages/settings/PlaceholderSettings";
import SignatureSettings from "@/pages/settings/SignatureSettings";
import SignatureTemplateSettings from "@/pages/settings/SignatureTemplateSettings";

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
        <Route path="pipelines" element={<PipelinesSettings />} />
        <Route path="task-statuses" element={<TaskStatusesSettings />} />
        <Route path="tags" element={<TagsSettings />} />
        <Route path="email-accounts" element={<EmailAccountsSettings />} />
        <Route path="signature" element={<SignatureSettings />} />
        <Route path="signature-template" element={<SignatureTemplateSettings />} />
        <Route path="deal-fields" element={<PlaceholderSettings title="Deal-Felder" />} />
      </Route>
    </Routes>
  );
}
