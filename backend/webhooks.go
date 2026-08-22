package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func handlePaymentWebhook(c *gin.Context) {
	providerName := c.Param("provider")
	subdomain := c.Param("subdomain")

	// 1. Get Master DB & Shop
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

	// 2. Get Tenant DB
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tenant DB error"})
		return
	}

	// 3. Get Provider Config
	var providerConfig TenantPaymentConfig
	if err := tenantDB.Where("provider_name = ? AND is_active = ?", providerName, true).First(&providerConfig).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment provider not found or inactive"})
		return
	}

	provider := GetPaymentProvider(providerName, providerConfig.AuthConfig)
	if provider == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Provider implementation not found"})
		return
	}

	// 4. Read Payload & Signature
	payload, _ := ioutil.ReadAll(c.Request.Body)
	log.Printf("[Webhook] Provider: %s, Body Length: %d, Body: %s", providerName, len(payload), string(payload))
	
	signature := c.GetHeader("Stripe-Signature") // Standardize or adapt based on provider
	if providerName == "razorpay" {
		signature = c.GetHeader("X-Razorpay-Signature")
	} else if providerName == "cashfree" {
		// Cashfree requires both timestamp and signature for verification
		ts := c.GetHeader("X-Webhook-Timestamp")
		sig := c.GetHeader("X-Webhook-Signature")
		signature = ts + "|" + sig
		log.Printf("[Webhook Cashfree] Timestamp: %s, Signature: %s", ts, sig)
	} else if providerName == "paypal" {
		algo := c.GetHeader("PAYPAL-AUTH-ALGO")
		cert := c.GetHeader("PAYPAL-CERT-URL")
		txId := c.GetHeader("PAYPAL-TRANSMISSION-ID")
		txSig := c.GetHeader("PAYPAL-TRANSMISSION-SIG")
		txTime := c.GetHeader("PAYPAL-TRANSMISSION-TIME")
		signature = fmt.Sprintf("%s|%s|%s|%s|%s", algo, cert, txId, txSig, txTime)
	}

	// 5. Verify Webhook
	event, err := provider.VerifyWebhook(payload, signature)
	if err != nil {
		log.Printf("[Webhook Error] Verification failed for %s: %v", providerName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signature"})
		return
	}

	// 6. Handle Event
	if event.Status == "Paid" {
		var order Order
		if err := tenantDB.First(&order, event.OrderID).Error; err == nil {
			if order.Status == "Pending Payment" {
				order.Status = "Paid"
				tenantDB.Save(&order)
				
				log.Printf("[Webhook Success] Order %d marked as Paid!", order.ID)

				// 6.5 Deduct Stock & Trigger AI Inventory Insights
				var items []OrderItem
				tenantDB.Where("order_id = ?", order.ID).Find(&items)
				for _, item := range items {
					var variant ProductVariant
					if err := tenantDB.First(&variant, item.VariantID).Error; err == nil {
						variant.StockQuantity -= item.Quantity
						if variant.StockQuantity < 0 {
							variant.StockQuantity = 0
						}
						tenantDB.Save(&variant)
						
						// Trigger AI insight for low stock
						triggerAIInventoryInsight(tenantDB, shop, variant, variant.StockQuantity)
					}
				}

				// 7. Auto-Fulfillment for Prepaid Orders
				triggerAutoFulfillment(tenantDB, shop, order)
			}
		}
	}

	// PayU expects a browser redirect since it posts directly to the webhook URL from the user's browser
	if providerName == "payu" {
		redirectURL := fmt.Sprintf("http://%s.localhost:5174/orders?success=true", shop.Subdomain)
		if event.Status != "Paid" {
			redirectURL = fmt.Sprintf("http://%s.localhost:5174/checkout?canceled=true", shop.Subdomain)
		}
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// Extracted from checkout logic so it can be called by webhook
func triggerAutoFulfillment(tenantDB *gorm.DB, shop Shop, order Order) {
	// Re-load order items
	var orderItems []OrderItem
	tenantDB.Where("order_id = ?", order.ID).Find(&orderItems)

	if strings.HasPrefix(order.ShippingRateID, "shiprocket_") { // Or based on tracking prefix if saved differently
		var provider ShippingProvider
		if err := tenantDB.Where("provider_name = ? AND is_active = ?", "shiprocket", true).First(&provider).Error; err == nil {
			var config map[string]string
			if err := json.Unmarshal([]byte(provider.AuthConfig), &config); err == nil {
				if token, err := getShiprocketToken(config["email"], config["password"]); err == nil {
					
					var srItems []map[string]interface{}
					var packItems []PackItem
					for _, item := range orderItems {
						srItems = append(srItems, map[string]interface{}{
							"name": item.Title,
							"sku": item.Title,
							"units": item.Quantity,
							"selling_price": item.Price,
						})
						
						var variant ProductVariant
						if err := tenantDB.First(&variant, item.VariantID).Error; err == nil {
							packItems = append(packItems, PackItem{
								Length: 10, Width: 10, Height: 10, Weight: 0.5, Quantity: item.Quantity, // Simplified for brevity in webhook
							})
						}
					}
					
					boxDims := CalculatePackedDimensions(packItems)
					pickupLoc := config["pickup_location"]
					if pickupLoc == "" { pickupLoc = "Home" }
					
					srPayload := ShiprocketOrderRequest{
						OrderID: fmt.Sprintf("%s-%d", shop.ID[:8], order.ID),
						OrderDate: order.CreatedAt.Format("2006-01-02 15:04"),
						PickupLocation: pickupLoc,
						BillingCustomer: "Customer",
						BillingLastName: "Name",
						BillingAddress: order.AddressLine1,
						BillingCity: order.City,
						BillingPincode: order.Pincode,
						BillingState: order.State,
						BillingCountry: order.Country,
						BillingEmail: order.CustomerEmail,
						BillingPhone: order.CustomerPhone,
						ShippingIsBilling: true,
						OrderItems: srItems,
						PaymentMethod: "Prepaid", // Important: Tell Shiprocket it's prepaid!
						SubTotal: order.Subtotal,
						Length: boxDims.Length, Breadth: boxDims.Width, Height: boxDims.Height, Weight: boxDims.Weight,
					}
					
					srRes, err := createShiprocketOrder(token, srPayload)
					if err == nil {
						order.ShiprocketOrderID = fmt.Sprintf("%d", srRes.OrderID)
						order.ShiprocketShipmentID = fmt.Sprintf("%d", srRes.ShipmentID)
						tenantDB.Save(&order)
						log.Printf("[Webhook Fulfillment] Pushed to Shiprocket successfully")
					}
				}
			}
		}
	} else if strings.HasPrefix(order.ShippingRateID, "shippo_") {
		var provider ShippingProvider
		if err := tenantDB.Where("provider_name = ? AND is_active = ?", "shippo", true).First(&provider).Error; err == nil {
			carrier := GetShippingCarrier("shippo", provider.AuthConfig)
			if carrier != nil {
				var packItems []PackItem
				for _, item := range orderItems {
					var variant ProductVariant
					if err := tenantDB.First(&variant, item.VariantID).Error; err == nil {
						w := variant.Weight
						var prod Product
						tenantDB.First(&prod, variant.ProductID)
						if w == 0 { w = prod.Weight }
						if w == 0 { w = 0.5 }
						packItems = append(packItems, PackItem{Length: prod.Length, Width: prod.Width, Height: prod.Height, Weight: w, Quantity: item.Quantity})
					}
				}
				boxDims := CalculatePackedDimensions(packItems)

				shippoRateID := strings.TrimPrefix(order.ShippingRateID, "shippo_")
				if strings.HasPrefix(shippoRateID, "mock") {
					shippoRateID = ""
				}

				spPayload := ShipmentPayload{
					OrderID:        fmt.Sprintf("%s-%d", shop.ID[:8], order.ID),
					BillingName:    order.CustomerEmail,
					BillingAddress: order.AddressLine1,
					BillingCity:    order.City,
					BillingPincode: order.Pincode,
					BillingState:   order.State,
					BillingCountry: order.Country,
					BillingEmail:   order.CustomerEmail,
					BillingPhone:   order.CustomerPhone,
					Weight:         boxDims.Weight,
					Length:         boxDims.Length,
					Breadth:        boxDims.Width,
					Height:         boxDims.Height,
					ShippoRateID:   shippoRateID,
				}
				
				res, err := carrier.CreateShipment(context.Background(), spPayload)
				if err == nil {
					log.Printf("[Shippo Webhook Success] Order pushed to Shippo! Shipment ID: %s", res.ShipmentID)
					order.ShiprocketShipmentID = res.ShipmentID
					order.ShiprocketAWB = res.AWBCode
					order.ShiprocketLabelURL = res.LabelURL
					tenantDB.Save(&order)
				} else {
					log.Printf("[Shippo Webhook Error] Failed to create order: %v", err)
				}
			}
		}
	}
}
