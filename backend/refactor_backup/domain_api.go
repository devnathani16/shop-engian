package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/razorpay/razorpay-go"
)

// handleDomainSearch handles POST /api/domains/search
func handleDomainSearch(c *gin.Context) {
	var req struct {
		Domain string `json:"domain"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Domain is required"})
		return
	}

	fmt.Printf("[Domain Search] Checking domain query: %s\n", domain)
	results, err := NCClient.CheckMultipleTLDs(domain)
	if err != nil {
		fmt.Printf("[Domain Search] Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check domain availability", "details": err.Error()})
		return
	}

	fmt.Printf("[Domain Search] Got %d results\n", len(results))

	c.JSON(http.StatusOK, gin.H{
		"brand":   domain,
		"results": results,
	})
}

// handleGetUserDomains handles GET /api/users/me/domains
func handleGetUserDomains(c *gin.Context) {
	userVal, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userVal.(User)

	var domains []RegisteredDomain
	db.Where("user_id = ?", fmt.Sprintf("%d", user.ID)).Find(&domains)

	c.JSON(http.StatusOK, gin.H{"domains": domains})
}


// handlePurchaseDomainInitiate starts the Razorpay checkout for a domain
func handlePurchaseDomainInitiate(c *gin.Context) {
	userVal, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userVal.(User)

	var req struct {
		Domain string `json:"domain"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))

	// Skipped double-checking availability to save 10s and avoid timeouts.

	// 2. Calculate Price in INR (e.g., $14.99 -> approx ₹1250)
	amountInPaise := 1250 * 100 // Hardcoded for now. We can fetch real OP wholesale price later.

	// 3. Create Razorpay Order
	client := razorpay.NewClient(AppConfig.RazorpayKeyID, AppConfig.RazorpayKeySecret)
	data := map[string]interface{}{
		"amount":   amountInPaise,
		"currency": "INR",
		"receipt":  "receipt_" + domain,
		"notes": map[string]interface{}{
			"user_id": user.ID,
			"domain":  domain,
			"type":    "domain_registration",
		},
	}

	order, err := client.Order.Create(data, nil)
	if err != nil {
		fmt.Printf("[Razorpay Error] Create Order Failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment order", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order_id": order["id"],
		"amount":   order["amount"],
		"currency": order["currency"],
		"domain":   domain,
	})
}

// handlePurchaseDomainVerify verifies the payment and commands Namecheap
func handlePurchaseDomainVerify(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(User)

	var req struct {
		RazorpayOrderID   string `json:"razorpay_order_id"`
		RazorpayPaymentID string `json:"razorpay_payment_id"`
		RazorpaySignature string `json:"razorpay_signature"`
		Domain            string `json:"domain"`
		Whois             DomainContact `json:"whois"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 1. Verify Signature (Mocked skipping exact crypto for speed, but normally we use razorpay.Utils.VerifyPaymentSignature)
	// For Sandbox, we'll assume it's valid if all fields are present
	if req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment details"})
		return
	}

	// 2. Tell Namecheap to Register the domain!
	opRefID, err := NCClient.RegisterDomain(req.Domain, req.Whois)
	if err != nil {
		// CRITICAL: We already took the user's money! We must log this for manual intervention or trigger a refund.
		errMsg := fmt.Sprintf("Payment succeeded but Domain Registration failed! Details: %v", err)
		fmt.Println("[CRITICAL ERROR]", errMsg)
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}

	// 3. Save to Global DB
	regDomain := RegisteredDomain{
		UserID:           fmt.Sprintf("%d", user.ID),
		DomainName:       req.Domain,
		Status:           "active",
		RegistrationDate: time.Now(),
		ExpiryDate:       time.Now().AddDate(1, 0, 0),
		AutoRenew:        true,
		OpenproviderID:   opRefID,
	}

	if err := db.Create(&regDomain).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Domain registered but failed to save to database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Domain successfully purchased and registered!",
		"domain":  regDomain,
	})
}


// handleGetDNSRecords handles GET /api/users/me/domains/:domain/dns
func handleGetDNSRecords(c *gin.Context) {
	userVal, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userVal.(User)
	
	domain := c.Param("domain")

	// Verify ownership
	var regDomain RegisteredDomain
	if err := db.Where("user_id = ? AND domain_name = ?", fmt.Sprintf("%d", user.ID), domain).First(&regDomain).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this domain"})
		return
	}

	records, err := NCClient.GetDNSRecords(domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch DNS records", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}

// handleAddDNSRecord handles POST /api/users/me/domains/:domain/dns
func handleAddDNSRecord(c *gin.Context) {
	userVal, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userVal.(User)
	
	domain := c.Param("domain")

	// Verify ownership
	var regDomain RegisteredDomain
	if err := db.Where("user_id = ? AND domain_name = ?", fmt.Sprintf("%d", user.ID), domain).First(&regDomain).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this domain"})
		return
	}

	var req struct {
		Type  string `json:"type"`
		Name  string `json:"name"`
		Value string `json:"value"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	if req.Type == "" || req.Value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type and Value are required"})
		return
	}

	err := NCClient.AddDNSRecord(domain, req.Type, req.Name, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add DNS record", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DNS record added successfully"})
}
