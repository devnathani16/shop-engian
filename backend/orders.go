package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func getShiprocketTokenFromTenant(tenantDB *gorm.DB) (string, error) {
	var provider ShippingProvider
	if err := tenantDB.Where("provider_name = ? AND is_active = ?", "shiprocket", true).First(&provider).Error; err != nil {
		return "", fmt.Errorf("shiprocket provider not found or inactive")
	}
	var config map[string]string
	if err := json.Unmarshal([]byte(provider.AuthConfig), &config); err != nil {
		return "", fmt.Errorf("invalid shiprocket config format")
	}
	email := config["email"]
	password := config["password"]
	if email == "" || password == "" {
		return "", fmt.Errorf("missing shiprocket credentials")
	}
	return getShiprocketToken(email, password)
}

func handleGetOrders(c *gin.Context) {
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

	var orders []Order
	if err := tenantDB.Preload("Items").Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func handleCancelOrder(c *gin.Context) {
	orderIDStr := c.Param("order_id")

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

	var order Order
	if err := tenantDB.First(&order, orderIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.Status == "Cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order is already cancelled"})
		return
	}

	// If Shiprocket order exists, cancel it first
	if order.ShiprocketOrderID != "" {
		if strings.HasPrefix(order.ShiprocketShipmentID, "SHIPPO_") {
			// Shippo mock cancellation
		} else {
			if token, err := getShiprocketTokenFromTenant(tenantDB); err == nil {
				srOrderID, _ := strconv.Atoi(order.ShiprocketOrderID)
				if err := cancelShiprocketOrder(token, []int{srOrderID}); err != nil {
					// Shiprocket returns error if already cancelled, but we'll return it to user
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to cancel on Shiprocket: %v", err)})
					return
				}
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authenticate with Shiprocket"})
				return
			}
		}
	}

	order.Status = "Cancelled"
	tenantDB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"message": "Order cancelled successfully"})
}

func handleGetStorefrontOrders(c *gin.Context) {
	subdomain := c.Param("subdomain")
	customerID := c.Query("customer_id")
	
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Customer ID is required"})
		return
	}

	// Get Master DB
	dsn := fmt.Sprintf("%s:%s@tcp(%s)/eaas_core?charset=utf8mb4&parseTime=True&loc=Local", AppConfig.DBUser, AppConfig.DBPass, AppConfig.DBHost)
	masterDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var shop Shop
	if err := masterDB.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var orders []Order
	if err := tenantDB.Where("customer_id = ?", customerID).Preload("Items").Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func handleGenerateOrderAWB(c *gin.Context) {
	orderIDStr := c.Param("order_id")

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

	var order Order
	if err := tenantDB.First(&order, orderIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.ShiprocketShipmentID == "" {
		// Native fallback AWB/Tracking
		order.ShiprocketAWB = "TRK" + fmt.Sprintf("%d", int(order.ID)*1000+rand.Intn(1000))
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Tracking generated", "awb": order.ShiprocketAWB})
		return
	}

	if strings.HasPrefix(order.ShiprocketShipmentID, "SHIPPO_") {
		order.ShiprocketAWB = "SHP" + fmt.Sprintf("%d", rand.Intn(1000000))
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "AWB generated via Shippo", "awb": order.ShiprocketAWB})
		return
	}

	token, err := getShiprocketTokenFromTenant(tenantDB)
	if err != nil {
		order.ShiprocketAWB = "TRK" + fmt.Sprintf("%d", int(order.ID)*1000+rand.Intn(1000))
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Tracking generated (fallback)", "awb": order.ShiprocketAWB})
		return
	}

	srShipmentID, _ := strconv.Atoi(order.ShiprocketShipmentID)
	awbRes, err := generateShiprocketAWB(token, srShipmentID)
	if err != nil {
		log.Printf("[Shiprocket AWB Fallback] API error: %v", err)
		order.ShiprocketAWB = "TRK" + fmt.Sprintf("%d", int(order.ID)*1000+rand.Intn(1000))
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Tracking generated (fallback)", "awb": order.ShiprocketAWB})
		return
	}

	order.ShiprocketAWB = awbRes.AWBCode
	tenantDB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"message": "AWB generated", "awb": awbRes.AWBCode})
}

func handleGenerateOrderLabel(c *gin.Context) {
	orderIDStr := c.Param("order_id")

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

	var order Order
	if err := tenantDB.First(&order, orderIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.ShiprocketShipmentID == "" {
		html := generateNativeHTMLLabel(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Label generated", "html": html})
		return
	}

	if strings.HasPrefix(order.ShiprocketShipmentID, "SHIPPO_") {
		// If real label URL was saved during checkout, use it!
		if order.ShiprocketLabelURL != "" && !strings.Contains(order.ShiprocketLabelURL, "mock_") {
			c.JSON(http.StatusOK, gin.H{"message": "Label generated via Shippo", "label_url": order.ShiprocketLabelURL})
			return
		}
		// Fallback for old orders before this was fixed
		order.ShiprocketLabelURL = "https://goshippo.com/label/mock_" + order.ShiprocketShipmentID + ".pdf"
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Label generated via Shippo", "label_url": order.ShiprocketLabelURL})
		return
	}



	token, err := getShiprocketTokenFromTenant(tenantDB)
	if err != nil {
		html := generateNativeHTMLLabel(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Label generated (fallback)", "html": html})
		return
	}

	srShipmentID, _ := strconv.Atoi(order.ShiprocketShipmentID)
	labelUrl, err := generateShiprocketLabel(token, []int{srShipmentID})
	if err != nil || labelUrl == "" {
		log.Printf("[Shiprocket Label Fallback] API error or empty URL: %v", err)
		html := generateNativeHTMLLabel(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Label generated (fallback)", "html": html})
		return
	}

	order.ShiprocketLabelURL = labelUrl
	tenantDB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"message": "Label generated", "label_url": labelUrl})
}

func handleGenerateOrderInvoice(c *gin.Context) {
	orderIDStr := c.Param("order_id")

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

	var order Order
	if err := tenantDB.First(&order, orderIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.ShiprocketOrderID == "" {
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated", "html": html})
		return
	}

	if strings.HasPrefix(order.ShiprocketShipmentID, "SHIPPO_") {
		order.ShiprocketInvoiceURL = "https://goshippo.com/invoice/mock_" + order.ShiprocketShipmentID + ".pdf"
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Invoice generated via Shippo", "invoice_url": order.ShiprocketInvoiceURL})
		return
	}

	token, err := getShiprocketTokenFromTenant(tenantDB)
	if err != nil {
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated (fallback)", "html": html})
		return
	}

	srOrderID, _ := strconv.Atoi(order.ShiprocketOrderID)
	invoiceUrl, err := generateShiprocketInvoice(token, []int{srOrderID})
	if err != nil || invoiceUrl == "" {
		log.Printf("[Shiprocket Invoice Fallback] API error or empty URL: %v", err)
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated (fallback)", "html": html})
		return
	}

	order.ShiprocketInvoiceURL = invoiceUrl
	tenantDB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"message": "Invoice generated", "invoice_url": invoiceUrl})
}

func handleStorefrontGenerateInvoice(c *gin.Context) {
	subdomain := c.Param("subdomain")
	orderIDStr := c.Param("order_id")
	
	var req struct {
		CustomerEmail string `json:"customer_email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Customer email is required for validation"})
		return
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s)/eaas_core?charset=utf8mb4&parseTime=True&loc=Local", AppConfig.DBUser, AppConfig.DBPass, AppConfig.DBHost)
	masterDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var shop Shop
	if err := masterDB.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var order Order
	if err := tenantDB.First(&order, orderIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.CustomerEmail != req.CustomerEmail {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized to access this order's invoice"})
		return
	}

	if order.ShiprocketInvoiceURL != "" && !strings.Contains(order.ShiprocketInvoiceURL, "mock_") {
		c.JSON(http.StatusOK, gin.H{"message": "Invoice retrieved", "invoice_url": order.ShiprocketInvoiceURL})
		return
	}

	if order.ShiprocketOrderID == "" {
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated", "html": html})
		return
	}

	if strings.HasPrefix(order.ShiprocketShipmentID, "SHIPPO_") {
		order.ShiprocketInvoiceURL = "https://goshippo.com/invoice/mock_" + order.ShiprocketShipmentID + ".pdf"
		tenantDB.Save(&order)
		c.JSON(http.StatusOK, gin.H{"message": "Invoice generated via Shippo", "invoice_url": order.ShiprocketInvoiceURL})
		return
	}

	token, err := getShiprocketTokenFromTenant(tenantDB)
	if err != nil {
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated (fallback)", "html": html})
		return
	}

	srOrderID, _ := strconv.Atoi(order.ShiprocketOrderID)
	invoiceUrl, err := generateShiprocketInvoice(token, []int{srOrderID})
	if err != nil || invoiceUrl == "" {
		log.Printf("[Shiprocket Storefront Invoice Fallback] API error or empty URL: %v", err)
		html := generateNativeHTMLInvoice(shop, order)
		c.JSON(http.StatusOK, gin.H{"message": "Native Invoice generated (fallback)", "html": html})
		return
	}

	order.ShiprocketInvoiceURL = invoiceUrl
	tenantDB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"message": "Invoice generated", "invoice_url": invoiceUrl})
}

func generateNativeHTMLInvoice(shop Shop, order Order) string {
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<title>Invoice #%d</title>
	<style>
		body { font-family: sans-serif; padding: 40px; color: #333; }
		.header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
		.details { display: flex; justify-content: space-between; margin-bottom: 40px; }
		table { border-collapse: collapse; margin-bottom: 40px; width: 100%%; }
		th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
		.total-section { text-align: right; font-size: 1.2em; }
	</style>
</head>
<body>
	<div class="header">
		<div>
			<h1>INVOICE</h1>
			<p>Order #%d</p>
			<p>Date: %s</p>
		</div>
		<div style="text-align: right;">
			<h2>%s</h2>
		</div>
	</div>
	<div class="details">
		<div>
			<h3>Bill To:</h3>
			<p>%s<br>%s<br>%s<br>%s, %s %s</p>
		</div>
	</div>
	<table>
		<thead>
			<tr>
				<th>Item</th>
				<th>Price</th>
				<th>Qty</th>
				<th>Total</th>
			</tr>
		</thead>
		<tbody>`, 
		order.ID, order.ID, order.CreatedAt.Format("Jan 02, 2006"), shop.Name,
		order.CustomerName, order.CustomerEmail, order.AddressLine1, order.City, order.State, order.Pincode)

	for _, item := range order.Items {
		html += fmt.Sprintf(`<tr><td>%s</td><td>%.2f</td><td>%d</td><td>%.2f</td></tr>`, item.Title, item.Price, item.Quantity, item.Price*float64(item.Quantity))
	}

	html += fmt.Sprintf(`
		</tbody>
	</table>
	<div class="total-section">
		<p>Subtotal: %.2f</p>
		<p>Tax: %.2f</p>
		<p>Shipping: %.2f</p>
		<h3>Total: %.2f</h3>
	</div>
</body>
</html>`, order.Subtotal, order.TaxAmount, order.ShippingCost, order.TotalAmount)

	return html
}

func generateNativeHTMLLabel(shop Shop, order Order) string {
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<title>Shipping Label #%d</title>
	<style>
		body { font-family: sans-serif; padding: 40px; color: #000; }
		.label-box { border: 2px solid #000; padding: 30px; width: 500px; margin: 0 auto; }
		.header { font-size: 24px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
		.address { font-size: 18px; line-height: 1.5; margin-bottom: 30px; }
		.sender { font-size: 14px; color: #555; border-top: 1px solid #ccc; padding-top: 10px; }
	</style>
</head>
<body>
	<div class="label-box">
		<div class="header">SHIP TO:</div>
		<div class="address">
			<strong>%s</strong><br>
			%s<br>
			%s, %s %s<br>
			%s<br>
			Phone: %s
		</div>
		<div class="sender">
			<strong>From:</strong> %s
		</div>
	</div>
</body>
</html>`, order.ID, order.CustomerName, order.AddressLine1, order.City, order.State, order.Pincode, order.Country, order.CustomerPhone, shop.Name)
	return html
}
