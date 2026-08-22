# Analysis: Upgrading "EAAS Original" Authentication

You have made a strong architectural choice. By choosing to upgrade the proprietary **EAAS Original** authentication instead of relying on Clerk or Auth0, you maintain 100% data ownership, eliminate expensive third-party monthly fees, and retain absolute control over the user experience.

However, because Shop.me is a multi-tenant platform, upgrading the original auth is complex. We have two completely separate authentication domains:
1. **The Core Admin (Merchants):** Authenticates `User`s against the master `eaas_core` database.
2. **The Storefronts (Customers):** Authenticates `Customer`s against isolated tenant databases (e.g., `tenant_shop_123`).

Here is the technical analysis of what is required to add **Google** and **Telegram** to the original EAAS authentication system.

## 1. Database Schema Evolution
Currently, the `User` and `Customer` structs assume an email and a password hash. Social login users do not have passwords.
We must update the GORM models in `backend/models.go`:
```go
// Add to both User and Customer models
PasswordHash *string `json:"-"` // Make pointer so it can be null for social logins
AuthProvider string  `gorm:"default:'local'"` // 'local', 'google', 'telegram'
ProviderID   string  `gorm:"index"` // The unique ID from Google/Telegram
```

## 2. Google OAuth 2.0 Architecture
To implement Google securely without a third-party service:
1. **Google Console:** We need to create a Google Cloud Project and generate an OAuth Client ID and Secret.
2. **Admin Flow (Merchants):**
   - New Go route: `GET /api/auth/google/login` → Redirects merchant to Google.
   - New Go route: `GET /api/auth/google/callback` → Validates the code, fetches Google profile, creates/logs in the `User` in `eaas_core`, and issues the EAAS JWT token.
3. **Storefront Flow (Customers):**
   - New Go route: `GET /api/storefront/:subdomain/auth/google/login`
   - New Go route: `GET /api/storefront/:subdomain/auth/google/callback` → Validates code, creates/logs in the `Customer` in the specific `tenant` database, issues a customer JWT.

## 3. Telegram Login Architecture
Telegram does not use standard OAuth 2.0. It uses a JavaScript widget that passes a cryptographically signed payload directly to the frontend.
1. **BotFather:** We must create a Telegram Bot to get a Bot Token.
2. **Frontend:** Embed the Telegram JS script on both `Login.tsx` and `storefront/src/app/login/page.tsx`.
3. **Backend Validation:**
   - Create `POST /api/auth/telegram/verify`
   - The Go backend takes the payload from the frontend and hashes it with the Telegram Bot Token using SHA-256. If the signature matches, we trust the Telegram user ID and issue our standard JWT.

## 4. Required Next Steps
To proceed with this upgrade, we will need:
1. **Google Client ID & Secret** (You will need to create this in the Google Cloud Console).
2. **Telegram Bot Token** (You will need to create a bot via @BotFather on Telegram).
3. We will then rewrite the Go authentication controllers, update the database models, and completely redesign the React login screens for both the Admin and Storefront to include the new buttons.

---

> [!IMPORTANT]
> **User Feedback Required**
> Does this architectural analysis align with your vision for the "EAAS Original" auth upgrade? If you are ready, I will generate the technical implementation plan so we can start writing the Go handlers and React components.
