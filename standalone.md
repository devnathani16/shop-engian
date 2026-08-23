# Shop Engine Ecosystem Strategy

This document outlines the three-pillar architecture of the platform. The goal is to build a unified B2B ecosystem where standalone services interlock to create massive value and stickiness for merchants.

## Phase 1: Core Pillars (Current Focus)

### 1. Store (Ecommerce-as-a-Service)
The foundational engine of the platform.
*   **Target Audience:** D2C brands, retailers, drop-shippers.
*   **Features:** Product management, theme customization, shipping calculation, tax engine, and Razorpay checkout.
*   **Status:** Active optimization.

### 2. Domains (Standalone but Connected)
A high-margin, standalone service that acts as an entry point for new users.
*   **Target Audience:** Anyone needing a web presence, seamlessly converting them to Store users.
*   **Features:** Live domain search, ICANN-compliant WHOIS registration, Namecheap API integration, dynamic pricing with 35% commission markup.
*   **Status:** Active optimization (Next step: Auto-DNS "Magic Connect").

---

## Phase 2: Enterprise Expansion (Future Focus)

### 3. B2B Billing & Clearinghouse
A standalone wholesale invoicing system that leverages the Store ecosystem.
*   **Target Audience:** Wholesale distributors and their retail buyers.
*   **How it Works:** 
    *   Wholesalers generate bills and push them to retailers.
    *   Retailers (using our Store platform or plugins for Shopify/WooCommerce) receive bills in a central dashboard.
    *   1-click payments using low-cost B2B rails (UPI/Virtual Accounts) with a highly lucrative 0.4% platform fee.
*   **Status:** Architecture defined; execution paused until Phase 1 is fully optimized.

---

## Development Roadmap
1.  **Freeze Phase 2:** B2B Billing is logged and documented here but development is on hold.
2.  **Optimize Domains:** Complete the end-to-end flow by implementing DNS auto-provisioning (Magic Connect).
3.  **Optimize Store:** Finalize checkout, taxes, and theme stability.
4.  **Transition:** Once the Store and Domain pillars are generating revenue and stable, begin development on the B2B Billing engine.
