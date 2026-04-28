import { Configuration, PublicClientApplication } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: "a60e8ece-f54c-4aa0-b192-fd11fa09e219",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "https://crm.ts-connect.cloud/settings/email-accounts",
    postLogoutRedirectUri: "https://crm.ts-connect.cloud/settings/email-accounts",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["Mail.Send", "email", "User.Read", "offline_access"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
