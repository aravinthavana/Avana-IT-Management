# Microsoft 365 (Azure AD) Setup Guide

This guide will walk you through registering your application in the Microsoft Entra ID (formerly Azure AD) portal and configuring the Avana IT Management system to use it for SSO.

## Step 1: Register the Application in Azure

1.  **Sign in** to the [Microsoft Entra admin center](https://entra.microsoft.com/) or the [Azure Portal](https://portal.azure.com/).
2.  Navigate to **Identity > Applications > App registrations**.
3.  Click **+ New registration**.
4.  **Name**: Enter `Avana IT Management`.
5.  **Supported account types**: Select "Accounts in this organizational directory only (Single tenant)" for maximum security.
6.  **Redirect URI**:
    *   Select **Single-page application (SPA)** from the dropdown.
    *   Enter: `http://localhost:5173/` (for development).
7.  Click **Register**.

## Step 2: Get your IDs

Once registered, copy the following values from the **Overview** page:
-   **Application (client) ID**
-   **Directory (tenant) ID**

## Step 3: Configure API Permissions

1.  Go to **API permissions**.
2.  By default, `User.Read` should be present. This is enough for basic login.
3.  If you want to support group-based roles later, click **+ Add a permission** > **Microsoft Graph** > **Delegated permissions** > Search for `GroupMember.Read.All`.

## Step 4: Update Your Project Configuration

You need to update the environment variables in both the **Frontend** and **Backend**.

### 1. Update Frontend Environment (`.env`)
Create or update the `.env` file in the **root directory**:
```env
VITE_AZURE_CLIENT_ID=your_client_id_here
VITE_AZURE_TENANT_ID=your_tenant_id_here
VITE_API_URL=http://localhost:8080
```

### 2. Update Backend Environment (`backend/.env`)
Update the `.env` file in the **backend directory**:
```env
AZURE_CLIENT_ID=your_client_id_here
AZURE_TENANT_ID=your_tenant_id_here
JWT_SECRET=your_local_secret_here
```

## Step 5: Bulk User Sync (Optional)

If you want to import all users from your tenant into the app:

1.  **Generate a Client Secret**:
    *   Go to **Certificates & secrets** > **Client secrets**.
    *   Click **+ New client secret** > Name: `BulkSync` > **Add**.
    *   **Copy the "Value"** (this is only shown once).
2.  **Add Application Permissions**:
    *   Go to **API permissions** > **+ Add a permission** > **Microsoft Graph**.
    *   Select **Application permissions**.
    *   Search for and check `User.Read.All`.
    *   Click **Add permissions**.
    *   Click **Grant admin consent for [Your Org]** (Status must show green).
3.  **Update Backend Environment**:
    *   Add `AZURE_CLIENT_SECRET=your_secret_value_here` to `backend/.env`.

---

## Troubleshooting

### "Redirect URI mismatch"
Ensure that the Redirect URI in Azure perfectly matches `http://localhost:5173/` (including the trailing slash).

### "Interaction required"
This usually happens if you haven't granted "Admin Consent" for the permissions. In the **API permissions** tab, click **Grant admin consent for [Your Org]**.

### Backend ERR_CONNECTION_REFUSED
Ensure your backend is running (`npm run dev` in the `backend` folder) and that the `VITE_API_URL` in your frontend matches the backend address.
