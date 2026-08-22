# Shop.me Production Deployment — Services & Costs

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GoDaddy Domain                       │
│              shopme.in / shopme.com                      │
└──────────────────────┬──────────────────────────────────┘
                       │ DNS (point nameservers to Cloudflare)
┌──────────────────────┴──────────────────────────────────┐
│                   Cloudflare (Free)                      │
│  • DDoS Protection  • WAF  • SSL  • Caching            │
│  • Wildcard DNS (*.shopme.in)                           │
│  • Cloudflare Tunnel (replaces ngrok for webhooks)      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│              AWS EC2 (t3.small / t3.medium)              │
│  ┌───────────────────────────────────────────────┐      │
│  │  Nginx (Reverse Proxy + SSL Termination)      │      │
│  │  Port 80/443 → internal services              │      │
│  └───────┬───────────┬──────────┬────────────────┘      │
│          │           │          │                        │
│   Go Backend   Next.js SSR   Python AI/ML               │
│    :8080        :3000         :50051 (gRPC)              │
│          │                                               │
│   ┌──────┴──────┐                                       │
│   │ AWS RDS     │  MySQL 8.0                             │
│   │ (db.t3.micro)│  Multi-tenant databases               │
│   └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│              ImageKit (Free / Paid)                      │
│  • Product image CDN + optimization                     │
│  • Auto WebP/AVIF conversion                            │
│  • Lazy loading + responsive images                     │
└─────────────────────────────────────────────────────────┘
```

---

## Services Breakdown

### 1. GoDaddy — Domain

| What to Buy | Cost | Notes |
|:---|---:|:---|
| `.in` domain | ₹499-799/yr | Cheapest for India |
| `.com` domain | ₹899-1199/yr | Better for global reach |
| Wildcard SSL | ❌ Not needed | Cloudflare gives free SSL |

> [!TIP]
> Buy ONLY the domain from GoDaddy. Don't buy their hosting, SSL, or email — all are overpriced. Point the nameservers to Cloudflare immediately after purchase.

---

### 2. Cloudflare — CDN + Security + DNS

| Plan | Cost | What You Get |
|:---|---:|:---|
| **Free Plan** | ₹0 | DDoS protection, WAF, SSL, DNS, basic caching |
| **Pro Plan** (optional later) | ~₹1,500/mo | Advanced WAF rules, image optimization, better analytics |

**What to configure:**
- Wildcard DNS: `*.yourdomain.in` → your EC2 IP
- Cloudflare Tunnel (free) → replaces ngrok for webhooks
- SSL Mode: **Full (Strict)**
- Page Rules: cache static assets

> [!IMPORTANT]
> Cloudflare Free Plan supports **wildcard DNS records** but NOT **wildcard SSL on subdomains** in the free tier. For `store1.yourdomain.in` to work with SSL, you need either:
> - **Option A**: Cloudflare for SaaS (Advanced Certificate Manager) — $10/mo for unlimited custom hostnames
> - **Option B**: Use path-based routing instead (`yourdomain.in/store1`)

---

### 3. AWS — Hosting

#### Option A: Budget Setup (~₹2,500-3,500/mo)

| Service | Instance | Cost/mo | Purpose |
|:---|:---|---:|:---|
| **EC2** | t3.small (2 vCPU, 2GB RAM) | ~₹1,500 | Go backend + Nginx + Python AI/ML |
| **RDS MySQL** | db.t3.micro (1 vCPU, 1GB) | ~₹1,200 | Multi-tenant MySQL |
| **EBS Storage** | 30GB gp3 | ~₹250 | EC2 disk |
| **Elastic IP** | 1 static IP | ₹0 (if attached) | Fixed IP for Cloudflare DNS |
| **S3** (optional) | 5GB | ~₹10 | Backups |

#### Option B: Growth Setup (~₹5,000-7,000/mo)

| Service | Instance | Cost/mo | Purpose |
|:---|:---|---:|:---|
| **EC2** | t3.medium (2 vCPU, 4GB RAM) | ~₹3,000 | More headroom for traffic |
| **RDS MySQL** | db.t3.small (2 vCPU, 2GB) | ~₹2,500 | Handles 50+ tenant DBs smoothly |
| **EBS Storage** | 50GB gp3 | ~₹400 | More disk space |
| **Elastic IP** | 1 static IP | ₹0 | Fixed IP |
| **S3** | 20GB | ~₹30 | Backups + static assets |

> [!TIP]
> **Save money**: Use **AWS Free Tier** for the first 12 months — you get `t2.micro` EC2 + `db.t2.micro` RDS for FREE. Start there, upgrade when you get real traffic.

#### AWS Services you DON'T need:
- ❌ Route 53 (use Cloudflare DNS instead — free)
- ❌ CloudFront (use Cloudflare CDN instead — free)
- ❌ ACM/SSL (Cloudflare handles SSL — free)
- ❌ ELB/ALB (Nginx on EC2 is enough for now)
- ❌ Lambda (your Go backend handles everything)

---

### 4. ImageKit — Image CDN

| Plan | Cost | Storage | Bandwidth | Best For |
|:---|---:|:---|:---|:---|
| **Free** | ₹0 | 20GB | 20GB/mo | Starting out, <10 stores |
| **Standard** | ~₹2,500/mo | 200GB | 200GB/mo | 10-100 stores |
| **Business** | ~₹6,000/mo | 500GB | 500GB/mo | 100+ stores |

**What ImageKit gives you:**
- Auto WebP/AVIF conversion (50-70% smaller images)
- URL-based transformations (`?tr=w-300,h-300`)
- Global CDN (faster image loading worldwide)
- Lazy loading support

> [!TIP]
> Start with the **Free plan**. 20GB bandwidth handles thousands of product images easily for a new platform.

---

### 5. MySQL (via AWS RDS)

Already covered in AWS section above. Key settings:

| Setting | Value |
|:---|:---|
| Engine | MySQL 8.0 |
| Multi-AZ | No (save money, enable later) |
| Backup | Automated, 7-day retention |
| Storage | gp3, auto-scaling |
| Security Group | Only allow EC2's private IP |

---

## Total Monthly Cost Summary

### Starter (0-10 stores)

| Service | Monthly Cost |
|:---|---:|
| GoDaddy domain | ₹50 (₹599/yr) |
| Cloudflare Free | ₹0 |
| AWS EC2 t3.small | ₹1,500 |
| AWS RDS db.t3.micro | ₹1,200 |
| AWS EBS 30GB | ₹250 |
| ImageKit Free | ₹0 |
| **Total** | **~₹3,000/mo** |

### Growth (10-100 stores)

| Service | Monthly Cost |
|:---|---:|
| GoDaddy domain | ₹50 |
| Cloudflare Pro | ₹1,500 |
| AWS EC2 t3.medium | ₹3,000 |
| AWS RDS db.t3.small | ₹2,500 |
| AWS EBS 50GB | ₹400 |
| ImageKit Standard | ₹2,500 |
| **Total** | **~₹10,000/mo** |

---

## Deployment Checklist

- [ ] Buy domain on GoDaddy
- [ ] Create Cloudflare account, add domain, change nameservers
- [ ] Set up wildcard DNS `*.domain.in` → EC2 Elastic IP
- [ ] Launch EC2 instance (Ubuntu 22.04 LTS)
- [ ] Install: Go, Node.js, Python, Nginx, MySQL client
- [ ] Launch RDS MySQL instance (same VPC as EC2)
- [ ] Configure security groups (RDS only accepts EC2, EC2 only accepts Cloudflare IPs)
- [ ] Set up Nginx with wildcard subdomain routing
- [ ] Set up Cloudflare Tunnel for webhooks (replaces ngrok)
- [ ] Create ImageKit account, get API keys
- [ ] Deploy Go backend as systemd service
- [ ] Deploy Python AI/ML as systemd service
- [ ] Deploy Next.js storefront with `pm2`
- [ ] Deploy Admin dashboard as static files via Nginx
- [ ] Update all `.env` files with production credentials
- [ ] Test all payment webhooks via Cloudflare Tunnel
- [ ] Set up automated MySQL backups to S3
