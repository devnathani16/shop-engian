# Email Guidance — Shop.me Platform (Powered by Resend)

## How It Works

```
Store owner connects "mystore.com" to your platform
                    │
                    ▼
         ┌──────────────────────┐
         │  1. Domain Verified  │  Store owner adds DNS records
         │     via Resend API   │  (SPF + DKIM + DMARC)
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         │  2. Platform Sends   │  Order confirmations, OTPs,
         │     Emails FROM      │  shipping updates
         │  orders@mystore.com  │  via Resend Go SDK
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         │  3. Store Owner Gets │  SMTP credentials to add
         │     Credentials      │  in Gmail / Outlook
         │                      │  Send personal emails as
         │                      │  hello@mystore.com
         └──────────────────────┘
```

---

## Roles & Responsibilities

| Service | Job | Involved in Email? |
|:---|:---|:---|
| **Resend** | Sends all emails, verifies domains, manages SMTP | ✅ Yes — the engine |
| **Your Platform** | Decides FROM address, triggers emails via Resend SDK | ✅ Yes — the brain |
| **Store Owner** | Adds DNS records, uses SMTP credentials | ✅ Yes — connects domain |
| **Cloudflare** | Protects website, serves DNS | ❌ No — not involved |
| **GoDaddy** | Domain registrar | ❌ No — just where domain was bought |
| **ImageKit** | Image CDN | ❌ No — not involved |

---

## Store Owner Setup Flow

### Step 1: Connect Domain in Admin Dashboard

Store owner enters their domain name:

```
┌─────────────────────────────────────────┐
│  ⚙️ Email Settings                      │
│                                         │
│  Domain: [ mystore.com          ]       │
│                                         │
│  [Verify Domain]                        │
└─────────────────────────────────────────┘
```

### Step 2: Add DNS Records

After clicking "Verify Domain", your platform calls the Resend API (`POST /domains`) and shows:

```
┌─────────────────────────────────────────────────────────┐
│  Add these DNS records at your domain registrar:        │
│                                                         │
│  Type    Name              Value                        │
│  ─────   ────              ─────                        │
│  TXT     resend._domainkey "p=MIGfMA0GCSqGSIb3DQEBAQU..."│
│                                                         │
│  MX      bounces           feedback-smtp.us-east-1...   │
│                                                         │
│  TXT     bounces           "v=spf1 include:amazons..."  │
│                                                         │
│  [Check Verification Status]                            │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Domain Verified ✅

```
┌─────────────────────────────────────────────────────────┐
│  ✅ mystore.com — Verified                              │
│                                                         │
│  Email Addresses:                                       │
│  ┌───────────────────────────────────────────────┐      │
│  │  📧 orders@mystore.com     — Order updates    │      │
│  │  📧 noreply@mystore.com    — OTP / Auth       │      │
│  │  📧 hello@mystore.com      — General          │      │
│  │  [+ Add Email Address]                        │      │
│  └───────────────────────────────────────────────┘      │
│                                                         │
│  SMTP Credentials (for Gmail/Outlook):                  │
│  ┌───────────────────────────────────────────────┐      │
│  │  Host:     smtp.resend.com                    │      │
│  │  Port:     587 (TLS)                          │      │
│  │  Username: resend                             │      │
│  │  Password: re_12345_XXXXXX (Domain Key)       │      │
│  │  [Copy All]  [Regenerate Password]            │      │
│  └───────────────────────────────────────────────┘      │
│                                                         │
│  📋 How to add in Gmail →                               │
│  📋 How to add in Outlook →                             │
└─────────────────────────────────────────────────────────┘
```

---

## What Your Platform Sends Automatically

| Email Type | FROM Address | When |
|:---|:---|:---|
| Order Confirmation | `orders@mystore.com` | Customer places order |
| OTP / Verification | `noreply@mystore.com` | Customer signs up / logs in |
| Shipping Update | `orders@mystore.com` | Order shipped / delivered |
| Payment Receipt | `orders@mystore.com` | Payment successful |
| Abandoned Cart | `hello@mystore.com` | Customer left items in cart |
| Welcome Email | `hello@mystore.com` | New customer signs up |

All emails appear to come from the **store's domain**, not from your platform.

---

## How Store Owner Uses Credentials in Gmail

```
Gmail → Settings (⚙️) → Accounts → "Send mail as"

  → Add another email address
  → Name: "My Store"
  → Email: hello@mystore.com

  → SMTP Server: smtp.resend.com
  → Port: 587
  → Username: resend  
  → Password: <their-domain-restricted-api-key>
  → TLS: Yes

  → Done ✅

Now they can compose emails in Gmail
and choose "From: hello@mystore.com"
```

---

## DNS Records Explained

```
DKIM Record (TXT)  
├── Digital signature on every email
├── Proves email wasn't tampered with
├── Without this: emails may be rejected
└── Value: Generated by Resend API per domain

SPF / Return-Path Records (MX / TXT)
├── Tells email servers who is allowed to send for this domain
├── Handles bounces automatically
└── Values: Generated by Resend API

DMARC Record (TXT)
├── Policy for what to do with failed emails
├── Helps build domain reputation
└── Value: "v=DMARC1; p=none;"
```

---

## Technical Architecture

With Resend, we do **not** need to build and secure our own SMTP Relay Server. Resend provides direct SMTP endpoints, and we simply provision domain-restricted API keys for the merchants.

```
┌─────────────────────────────────────────────────────┐
│                  Your Go Backend                     │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │ Email Service│    │ Resend Go SDK            │   │
│  │              │───▶│                          │   │
│  │ SendOrderMail│    │ resend.Emails.Send({     │   │
│  │ SendOTPMail  │    │   From: orders@store.com │   │
│  │ SendShipMail │    │   To: customer@gmail.com │   │
│  │              │    │   Subject: "Order #123"  │   │
│  └─────────────┘    │   Html: "<html>...</html>"│   │
│                      │ })                       │   │
│                      └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 Merchant Direct Flow                │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │ Gmail/      │    │ Resend SMTP Servers      │   │
│  │ Outlook App │───▶│ (smtp.resend.com)        │   │
│  │             │    │ Authenticates using      │   │
│  │             │    │ Domain-Restricted API Key│   │
│  └─────────────┘    └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Store email domains
CREATE TABLE store_email_domains (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    shop_id     VARCHAR(36) NOT NULL,
    domain      VARCHAR(255) NOT NULL,
    resend_domain_id VARCHAR(255), -- ID returned from Resend POST /domains
    status      VARCHAR(50),       -- "pending", "verified", "failed"
    dns_records JSON,              -- Store the records Resend tells us to display
    smtp_api_key_id VARCHAR(255),  -- ID of the Resend API key generated for them
    smtp_api_key VARCHAR(255),     -- The actual key (shown once, or we re-generate)
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store email addresses  
CREATE TABLE store_email_addresses (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    domain_id   INT NOT NULL,
    address     VARCHAR(255) NOT NULL,  -- e.g. "orders"
    purpose     VARCHAR(50),            -- "transactional", "marketing", "general"
    is_default  BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (domain_id) REFERENCES store_email_domains(id)
);

-- Email logs
CREATE TABLE store_email_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    shop_id     VARCHAR(36) NOT NULL,
    from_addr   VARCHAR(255),
    to_addr     VARCHAR(255),
    subject     VARCHAR(500),
    status      VARCHAR(20),
    resend_id   VARCHAR(255),
    sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Cost Breakdown

### Resend Pricing

| Volume | Cost | Per 1,000 Emails |
|:---|---:|---:|
| First 3,000/mo (100/day) | **$0** | Free |
| Pro Plan (Up to 50,000/mo) | **$20/mo** | $0.40 |
| Additional volume (over 50k) | **+$4/10,000** | $0.40 |

### Example: 500 stores, each sending ~200 emails/month

```
500 stores × 200 emails = 100,000 emails/month
Cost = $20 (Base Pro Plan for 50k) + $20 (for the extra 50k)
Total Cost = $40 / month (~₹3,300/mo)

$40 for 500 stores is extremely cost-effective, especially considering the 
massive amount of developer time saved by not building an SMTP relay!
```

---

## Implementation Checklist

- [ ] Create Resend Account & generate Master API Key
- [ ] Build domain verification API (calls Resend `POST /domains`)
- [ ] Build DNS record display in Admin Dashboard (reads `dns_records` JSON)
- [ ] Build verification status checker (calls Resend `GET /domains/{id}`)
- [ ] Build SMTP credential generator (calls Resend `POST /api-keys` restricted to the domain)
- [ ] Install `resend-go` SDK in the backend
- [ ] Create React Email templates (Order, OTP, Shipping, Welcome) and compile to HTML
- [ ] Integrate email sending into existing checkout flow
- [ ] Build email logs view in Admin Dashboard
- [ ] Add "How to configure Gmail/Outlook" help docs in Admin
