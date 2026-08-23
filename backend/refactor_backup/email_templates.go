package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/resend/resend-go/v2"
)

var (
	TemplateMinimalist = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Did you forget something?</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hi %s,</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">We noticed you left some great items in your cart. They are still waiting for you, but they might sell out soon!</p>
        <div style="margin: 30px 0;">
            <a href="%s" style="background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Return to Checkout</a>
        </div>
        <p style="color: #999999; font-size: 14px;">If you have any questions, reply to this email. We're here to help.</p>
    </div>
</body>
</html>`

	TemplateFOMO = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your cart is expiring soon!</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #111111; margin: 0; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; text-align: center;">
        <h1 style="color: #e53e3e; margin-top: 0; font-size: 28px;">⏳ Don't Miss Out!</h1>
        <p style="color: #333333; font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
            Hi %s,<br>
            The items in your cart are in high demand and we can't guarantee they will stay in stock much longer.
        </p>
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p style="color: #4a5568; font-weight: bold; margin: 0;">Cart Total: %s%.2f</p>
        </div>
        <a href="%s" style="background-color: #e53e3e; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">Secure My Items</a>
    </div>
</body>
</html>`

	TemplateDiscount = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Here's 10%% off to finish your order!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0fdf4; margin: 0; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <span style="background-color: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">Special Offer Just For You</span>
        </div>
        <h2 style="color: #111827; text-align: center; margin-top: 0;">Let's make it a deal, %s.</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
            We'd love to see you complete your order. Use the code below at checkout to get <strong>10%% OFF</strong> your entire cart!
        </p>
        <div style="background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <code style="font-size: 24px; font-weight: bold; color: #111827;">COMEBACK10</code>
        </div>
        <div style="text-align: center;">
            <a href="%s" style="background-color: #16a34a; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Claim My 10%% Off</a>
        </div>
    </div>
</body>
</html>`
)

type RecoverCartRequest struct {
	TemplateID string `json:"template_id"` // "minimalist", "fomo", "discount"
}

func handleRecoverAbandonedCart(c *gin.Context) {
	// Context extracted below
	cartID := c.Param("cart_id")
	var req RecoverCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	shopID := shop.ID
	_ = shopID

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var cart AbandonedCart
	if err := tenantDB.First(&cart, cartID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cart not found"})
		return
	}

	// Prepare Email Content
	checkoutURL := fmt.Sprintf("http://%s.localhost:5174/checkout", shop.Subdomain) // Assuming 5174 is the storefront port in dev
	var htmlBody string
	var subject string

	customerName := cart.CustomerEmail // We don't have name in AbandonedCart, use email
	
	switch req.TemplateID {
	case "fomo":
		subject = "Your cart is expiring soon! ⏳"
		htmlBody = fmt.Sprintf(TemplateFOMO, customerName, shop.Currency, cart.Value, checkoutURL)
	case "discount":
		subject = "Here's 10% off to finish your order! 🎁"
		htmlBody = fmt.Sprintf(TemplateDiscount, customerName, checkoutURL) // Note: Need to make sure discount code COMEBACK10 exists or is auto-generated
	case "minimalist":
		fallthrough
	default:
		subject = "Did you forget something?"
		htmlBody = fmt.Sprintf(TemplateMinimalist, customerName, checkoutURL)
	}

	// Send via Resend
	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <orders@resend.dev>", shop.Name),
		To:      []string{cart.CustomerEmail},
		Subject: subject,
		Html:    htmlBody,
	}

	if resendClient != nil {
		_, err = resendClient.Emails.Send(params)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email via Resend"})
			return
		}
	} else {
		// If resend is not configured, just mock success for dev
		log.Printf("[Mock] Sent %s recovery email to %s", req.TemplateID, cart.CustomerEmail)
	}

	// Update Cart Status
	cart.Status = "RecoveryEmailSent"
	tenantDB.Save(&cart)

	// Broadcast SSE Update
	if GlobalBroker != nil {
		GlobalBroker.BroadcastEvent(shop.ID, EventCartAbandoned, cart) // Send the updated cart
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recovery email sent successfully", "cart": cart})
}
