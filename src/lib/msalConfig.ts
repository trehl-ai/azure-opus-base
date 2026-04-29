import { Configuration, PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
const REDIRECT_URI =
  import.meta.env.VITE_MICROSOFT_REDIRECT_URI ??
  "https://ts-connect.cloud/settings/email-accounts";

if (!CLIENT_ID) {
  console.warn("[MSAL] VITE_MICROSOFT_CLIENT_ID not set — Outlook auth will fail");
}

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["Mail.Send", "email", "User.Read", "offline_access"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
