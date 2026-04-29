const ADMIN_CONSENT_URL =
  "https://login.microsoftonline.com/common/adminconsent" +
  "?client_id=a60e8ece-f54c-4aa0-b192-fd11fa09e219" +
  "&redirect_uri=" + encodeURIComponent("https://ts-connect.cloud/settings/email-accounts") +
  "&state=admin_consent";

export default function OutlookAdminConsent() {
  return (
    <div className="p-8 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Outlook Administrator-Genehmigung</h1>
      <p className="text-sm text-muted-foreground">
        Dieser Schritt muss einmalig von einem IT-Administrator der eo-ipso.com
        Organisation durchgeführt werden. Danach können alle @eo-ipso.com
        Mitarbeiter ihr Outlook-Konto selbstständig verbinden.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm">
        <strong>Nur für IT-Administratoren:</strong> Bitte melden Sie sich mit
        Ihrem Administrator-Account an und erteilen Sie die Genehmigung.
      </div>
      <a
        href={ADMIN_CONSENT_URL}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 inline-block font-medium"
      >
        Als Administrator genehmigen →
      </a>
      <p className="text-xs text-muted-foreground">
        App: eo ipso Boost CRM | Client ID: a60e8ece-f54c-4aa0-b192-fd11fa09e219
      </p>
    </div>
  );
}
