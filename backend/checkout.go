package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func handleGetCheckoutConfig(c *gin.Context) {
	subdomain := c.Param("subdomain")

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tenant DB error"})
		return
	}

	var paymentConfigs []TenantPaymentConfig
	tenantDB.Where("is_active = ?", true).Find(&paymentConfigs)

	stripeEnabled := false
	stripePubKey := ""
	razorpayEnabled := false
	razorpayKeyID := ""
	payuEnabled := false
	cashfreeEnabled := false
	cashfreeEnv := "sandbox"
	paypalEnabled := false
	paypalClientId := ""
	codEnabled := false

	for _, pc := range paymentConfigs {
		var auth map[string]interface{}
		if decrypted, err := DecryptAES([]byte(AppConfig.EncryptionMasterKey), pc.AuthConfig); err == nil {
			json.Unmarshal([]byte(decrypted), &auth)
		} else {
			json.Unmarshal([]byte(pc.AuthConfig), &auth)
		}
		
		if pc.ProviderName == "stripe" {
			stripeEnabled = true
			if pub, ok := auth["public_key"].(string); ok {
				stripePubKey = pub
			}
		} else if pc.ProviderName == "razorpay" {
			razorpayEnabled = true
			if kid, ok := auth["key_id"].(string); ok {
				razorpayKeyID = kid
			}
		} else if pc.ProviderName == "payu" {
			payuEnabled = true
		} else if pc.ProviderName == "cashfree" {
			cashfreeEnabled = true
			if env, ok := auth["environment"].(string); ok {
				cashfreeEnv = env
			}
		} else if pc.ProviderName == "paypal" {
			paypalEnabled = true
			if cid, ok := auth["client_id"].(string); ok {
				paypalClientId = cid
			}
		} else if pc.ProviderName == "cod" {
			codEnabled = true
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stripe_enabled": stripeEnabled,
		"stripe_public_key": stripePubKey,
		"razorpay_enabled": razorpayEnabled,
		"razorpay_key_id": razorpayKeyID,
		"payu_enabled": payuEnabled,
		"cashfree_enabled": cashfreeEnabled,
		"cashfree_environment": cashfreeEnv,
		"paypal_enabled": paypalEnabled,
		"paypal_client_id": paypalClientId,
		"cod_enabled": codEnabled,
		"custom_checkout_fields": shop.CustomCheckoutFields,
	})
}



type CartItem struct {
	VariantID uint `json:"variant_id"`
	Quantity  int  `json:"quantity"`
}

type CheckoutRatesRequest struct {
	Cart         []CartItem `json:"cart"`
	Pincode      string     `json:"pincode"`
	Country      string     `json:"country"`
	State        string     `json:"state"`
	City         string     `json:"city"`
	AddressLine1 string     `json:"address_line_1"`
	DiscountCode string     `json:"discount_code"`
}

type FinalRate struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Rate              float64 `json:"rate"`
	EstimatedDelivery string  `json:"estimated_delivery"`
}

func handleGetCheckoutRates(c *gin.Context) {
	subdomain := c.Param("subdomain")

	var req CheckoutRatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	log.Printf("[Checkout Rates] Received: pincode=%q country=%q state=%q city=%q address=%q", req.Pincode, req.Country, req.State, req.City, req.AddressLine1)

	req.Country = normalizeCountryCode(req.Country)

	finalRates, _, cartTotal := calculateShippingRatesForCart(tenantDB, shop, req.Cart, req.Pincode, req.Country, req.State, req.City, req.AddressLine1)

	var discountAmount float64
	var discountError string
	if req.DiscountCode != "" {
		amt, discount, err := CalculateDiscount(tenantDB, req.DiscountCode, cartTotal)
		if err != nil {
			discountError = err.Error()
		} else {
			discountAmount = amt
			if discount != nil && discount.Type == "free_shipping" {
				for i := range finalRates {
					finalRates[i].Rate = 0
				}
			}
		}
	}

	// Calculate tax
	var taxLineItems []TaxLineItem
	for _, item := range req.Cart {
		var variant ProductVariant
		if err := tenantDB.First(&variant, item.VariantID).Error; err != nil {
			continue
		}
		var product Product
		tenantDB.First(&product, variant.ProductID)
		taxLineItems = append(taxLineItems, TaxLineItem{
			ProductID:     product.ID,
			TaxCategoryID: product.TaxCategoryID,
			Amount:        variant.Price * float64(item.Quantity),
			Quantity:      item.Quantity,
		})
	}
	taxResult := calculateTaxForCart(tenantDB, shop.ID, taxLineItems, req.Country, req.State)

	c.JSON(http.StatusOK, gin.H{
		"rates":           finalRates,
		"discount_amount": discountAmount,
		"discount_error":  discountError,
		"tax_amount":      taxResult.TotalTax,
		"tax_rate":        taxResult.EffectiveRate,
		"tax_breakdown":   taxResult.Breakdown,
		"tax_inclusive":   taxResult.Inclusive,
	})
}



func handleCheckoutProcess(c *gin.Context) {
	subdomain := c.Param("subdomain")
	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var payload struct {
		Cart []struct {
			VariantID uint `json:"variant_id"`
			Quantity  int  `json:"quantity"`
			CustomFieldValues map[string]interface{} `json:"custom_field_values"`
		} `json:"cart"`
		Address struct {
			Lat          float64 `json:"lat"`
			Lon          float64 `json:"lon"`
			Postcode     string  `json:"postcode"`
			City         string  `json:"city"`
			State        string  `json:"state"`
			Country      string  `json:"country"`
			AddressLine1 string  `json:"address_line_1"`
			Phone        string  `json:"phone"`
		} `json:"address"`
		ShippingRate struct {
			ID   string  `json:"id"`
			Name string  `json:"name"`
			Rate float64 `json:"rate"`
		} `json:"shipping_rate"`
		CustomerEmail string `json:"customer_email"`
		CustomerName  string `json:"customer_name"`
		CustomerID    string `json:"customer_id"`
		PaymentMethod string `json:"payment_method"`
		DiscountCode  string `json:"discount_code"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	if len(payload.Cart) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cart is empty"})
		return
	}

	// Calculate subtotal and build order items
	var subtotal float64
	var orderItems []OrderItem

	for _, item := range payload.Cart {
		if item.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Item quantity must be greater than zero"})
			return
		}

		var variant ProductVariant
		if err := tenantDB.First(&variant, item.VariantID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Variant %d not found", item.VariantID)})
			return
		}
		
		if variant.StockQuantity < item.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Not enough stock for variant %s", variant.Title)})
			return
		}

		// Only decrement stock immediately for Cash on Delivery. 
		// Other payment methods will decrement upon webhook payment success.
		if payload.PaymentMethod == "COD" {
			variant.StockQuantity -= item.Quantity
			tenantDB.Save(&variant)
		}
		
		subtotal += variant.Price * float64(item.Quantity)
		
		
		var customFieldValuesStr string
		if len(item.CustomFieldValues) > 0 {
			b, _ := json.Marshal(item.CustomFieldValues)
			customFieldValuesStr = string(b)
		}

		orderItems = append(orderItems, OrderItem{
			VariantID: variant.ID,
			Title:     variant.Title,
			Price:     variant.Price,
			Quantity:  item.Quantity,
			ImageURL:  variant.ImageURL,
			CustomFieldValues: customFieldValuesStr,
		})
	}

	// Revalidate shipping rates server-side.
	// For live carrier rates (shippo_, shiprocket_) we trust the client-provided rate
	// because live rate IDs are ephemeral (Shippo object_id changes per API call).
	var reqCartItems []CartItem
	for _, item := range payload.Cart {
		reqCartItems = append(reqCartItems, CartItem{VariantID: item.VariantID, Quantity: item.Quantity})
	}

	var matchedRate *FinalRate

	if strings.HasPrefix(payload.ShippingRate.ID, "shippo_") || strings.HasPrefix(payload.ShippingRate.ID, "shiprocket_") {
		// Trust client rate for live carrier rates — IDs are ephemeral per API call
		if payload.ShippingRate.Rate <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid shipping rate amount"})
			return
		}
		matchedRate = &FinalRate{
			ID:   payload.ShippingRate.ID,
			Name: payload.ShippingRate.Name,
			Rate: payload.ShippingRate.Rate,
		}
	} else {
		validRates, _, _ := calculateShippingRatesForCart(tenantDB, shop, reqCartItems, payload.Address.Postcode, payload.Address.Country, payload.Address.State, payload.Address.City, payload.Address.AddressLine1)
		for _, r := range validRates {
			if r.ID == payload.ShippingRate.ID {
				matchedRate = &r
				break
			}
		}
	}

	if matchedRate == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Selected shipping rate is invalid or no longer available"})
		return
	}
	// Trust server calculated rate
	payload.ShippingRate.Rate = matchedRate.Rate

	var discountAmount float64
	var discountCodeUsed string
	if payload.DiscountCode != "" {
		amt, discount, err := CalculateDiscount(tenantDB, payload.DiscountCode, subtotal)
		if err == nil {
			discountAmount = amt
			discountCodeUsed = payload.DiscountCode
			
			if discount != nil && discount.Type == "free_shipping" {
				payload.ShippingRate.Rate = 0
			}

			// Increment uses atomically
			if discount != nil {
				tenantDB.Model(&DiscountCode{}).
					Where("id = ? AND (usage_limit IS NULL OR uses < usage_limit)", discount.ID).
					Update("uses", gorm.Expr("uses + 1"))
			}
		}
	}

	// Calculate tax server-side
	var taxLineItems []TaxLineItem
	for _, oi := range orderItems {
		var variant ProductVariant
		if err := tenantDB.First(&variant, oi.VariantID).Error; err == nil {
			var product Product
			tenantDB.First(&product, variant.ProductID)
			taxLineItems = append(taxLineItems, TaxLineItem{
				ProductID:     product.ID,
				TaxCategoryID: product.TaxCategoryID,
				Amount:        oi.Price * float64(oi.Quantity),
				Quantity:      oi.Quantity,
			})
		}
	}
	taxResult := calculateTaxForCart(tenantDB, shop.ID, taxLineItems, payload.Address.Country, payload.Address.State)

	// For inclusive tax, price already contains tax so don't add again
	taxToAdd := taxResult.TotalTax
	if taxResult.Inclusive {
		taxToAdd = 0
	}

	totalAmount := subtotal - discountAmount + payload.ShippingRate.Rate + taxToAdd

	// Default status
	status := "Pending Payment"
	if payload.PaymentMethod == "COD" {
		status = "Pending COD"
	}

	order := Order{
		CustomerID:      payload.CustomerID,
		CustomerName:    payload.CustomerName,
		CustomerEmail:   payload.CustomerEmail,
		CustomerPhone:   payload.Address.Phone,
		TotalAmount:     totalAmount,
		Subtotal:        subtotal,
		ShippingCost:    payload.ShippingRate.Rate,
		ShippingCourier: payload.ShippingRate.Name,
		ShippingRateID:  payload.ShippingRate.ID,
		TaxAmount:       taxResult.TotalTax,
		TaxRate:         taxResult.EffectiveRate,
		TaxBreakdown:    taxResult.BreakdownJSON,
		Status:          status,
		PaymentMethod:   payload.PaymentMethod,
		AddressLine1:    payload.Address.AddressLine1,
		Pincode:         payload.Address.Postcode,
		City:            payload.Address.City,
		State:           payload.Address.State,
		Country:         payload.Address.Country,
		Latitude:        payload.Address.Lat,
		Longitude:       payload.Address.Lon,
		DiscountCode:    discountCodeUsed,
		DiscountAmount:  discountAmount,
		Items:           orderItems,
	}

	if err := tenantDB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order"})
		return
	}

	if GlobalBroker != nil {
		GlobalBroker.BroadcastEvent(shop.ID, EventNewOrder, order)
	}

	// Mark cart as recovered
	tenantDB.Model(&AbandonedCart{}).Where("customer_email = ? AND status = ?", payload.CustomerEmail, "Abandoned").Update("status", "Recovered")

	// Auto-Fulfillment for COD orders
	if payload.PaymentMethod == "COD" {
		if strings.HasPrefix(payload.ShippingRate.ID, "shiprocket_") {
			var provider ShippingProvider
			if err := tenantDB.Where("provider_name = ? AND is_active = ?", "shiprocket", true).First(&provider).Error; err == nil {
				var config map[string]string
				if err := json.Unmarshal([]byte(provider.AuthConfig), &config); err == nil {
					email := config["email"]
					password := config["password"]
					pickupLoc := config["pickup_location"]
					
					if token, err := getShiprocketToken(email, password); err == nil {
						
						// Build Shiprocket Order Items
					var srItems []map[string]interface{}
					var packItems []PackItem
					for _, item := range orderItems {
						srItems = append(srItems, map[string]interface{}{
							"name": item.Title,
							"sku": item.Title, // generic fallback
							"units": item.Quantity,
							"selling_price": item.Price,
						})
						
						// Re-fetch dimensions to calculate box
						var variant ProductVariant
						if err := tenantDB.First(&variant, item.VariantID).Error; err == nil {
							w := variant.Weight
							var l, width, h float64
							var prod Product
							if tenantDB.First(&prod, variant.ProductID).Error == nil {
								if w == 0 { w = prod.Weight }
								l = prod.Length
								width = prod.Width
								h = prod.Height
							}
							if w == 0 { w = 0.5 }
							
							packItems = append(packItems, PackItem{
								Length: l, Width: width, Height: h, Weight: w, Quantity: item.Quantity,
							})
						}
					}
					
					boxDims := CalculatePackedDimensions(packItems)
					
					if pickupLoc == "" {
						pickupLoc = "Home" // Defaulting to Home since that's their registered location
					}
					
					srPayload := ShiprocketOrderRequest{
						OrderID: fmt.Sprintf("%s-%d", shop.ID[:8], order.ID),
						OrderDate: order.CreatedAt.Format("2006-01-02 15:04"),
						PickupLocation: pickupLoc,
						BillingCustomer: "Customer",
						BillingLastName: "Name", // required but dummy
						BillingAddress: order.AddressLine1,
						BillingCity: order.City,
						BillingPincode: order.Pincode,
						BillingState: order.State,
						BillingCountry: order.Country,
						BillingEmail: order.CustomerEmail,
						BillingPhone: order.CustomerPhone,
						ShippingIsBilling: true,
						OrderItems: srItems,
						PaymentMethod: order.PaymentMethod,
						SubTotal: order.Subtotal,
						Length: boxDims.Length,
						Breadth: boxDims.Width,
						Height: boxDims.Height,
						Weight: boxDims.Weight,
					}
					
					srRes, err := createShiprocketOrder(token, srPayload)
					if err != nil {
						log.Printf("[Shiprocket Error] Failed to create order: %v", err)
					} else {
						log.Printf("[Shiprocket Success] Order pushed to Shiprocket! SR Order ID: %d", srRes.OrderID)
						// Save Shiprocket IDs to our Order model
						order.ShiprocketOrderID = fmt.Sprintf("%d", srRes.OrderID)
						order.ShiprocketShipmentID = fmt.Sprintf("%d", srRes.ShipmentID)
						tenantDB.Save(&order)
					}
				}
			}
			}
		} else if strings.HasPrefix(payload.ShippingRate.ID, "shippo_") {
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

					// Extract Shippo rate object_id — strip the "shippo_" prefix
					shippoRateID := strings.TrimPrefix(payload.ShippingRate.ID, "shippo_")
					// Don't send mock IDs to Shippo API
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
						log.Printf("[Shippo Success] Order pushed to Shippo! Shipment ID: %s", res.ShipmentID)
						order.ShiprocketShipmentID = res.ShipmentID
						order.ShiprocketAWB = res.AWBCode
						order.ShiprocketLabelURL = res.LabelURL
						tenantDB.Save(&order)
					} else {
						log.Printf("[Shippo Error] Failed to create order: %v", err)
					}
				}
			}
		}
	}

	var paymentURL string
	var paymentOrderID string
	var clientSecret string

	// Validate the requested payment method is actually enabled
	var requestedProvider TenantPaymentConfig
	if err := tenantDB.Where("provider_name = ? AND is_active = ?", strings.ToLower(payload.PaymentMethod), true).First(&requestedProvider).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Payment method %s is not enabled for this store", payload.PaymentMethod)})
		return
	}

	if payload.PaymentMethod != "COD" {
		provider := GetPaymentProvider(requestedProvider.ProviderName, requestedProvider.AuthConfig)
		if provider != nil {
				sessionReq := PaymentSessionRequest{
					OrderID:       order.ID,
					Amount:        totalAmount,
					Currency:      shop.Currency,
					CustomerEmail: order.CustomerEmail,
					CustomerName:  "Customer",
					SuccessURL:    fmt.Sprintf("http://%s.localhost:5174/orders?success=true", shop.Subdomain),
					CancelURL:     fmt.Sprintf("http://%s.localhost:5174/checkout?canceled=true", shop.Subdomain),
				}
				sessionRes, err := provider.CreateSession(context.Background(), sessionReq)
				if err == nil {
					paymentURL = sessionRes.CheckoutURL
					paymentOrderID = sessionRes.TransactionID
					clientSecret = sessionRes.ClientSecret
				} else {
					log.Printf("[Payment Error] Failed to create session: %v", err)
					tenantDB.Unscoped().Delete(&order) // Rollback order creation to prevent duplicate abandoned orders
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Payment Gateway Error: %v", err)})
					return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Order created successfully",
		"order_id": order.ID,
		"status": order.Status,
		"payment_url": paymentURL,
		"payment_session_id": paymentOrderID,
		"client_secret": clientSecret,
	})
}

func calculateShippingRatesForCart(tenantDB *gorm.DB, shop Shop, cart []CartItem, destPincode, destCountry, destState, destCity, destStreet string) ([]FinalRate, BoxDimensions, float64) {
	var cartTotal float64 = 0
	var packItems []PackItem

	for _, item := range cart {
		if item.Quantity <= 0 {
			continue
		}
		
		var variant ProductVariant
		if err := tenantDB.First(&variant, item.VariantID).Error; err == nil {
			cartTotal += variant.Price * float64(item.Quantity)
			
			w := variant.Weight
			var length, width, height float64
			var prod Product
			if tenantDB.First(&prod, variant.ProductID).Error == nil {
				if w == 0 { w = prod.Weight }
				length = prod.Length
				width = prod.Width
				height = prod.Height
			}
			if w == 0 { w = 0.5 }
			
			packItems = append(packItems, PackItem{
				Length:   length,
				Width:    width,
				Height:   height,
				Weight:   w,
				Quantity: item.Quantity,
			})
		}
	}
	
	boxDims := CalculatePackedDimensions(packItems)
	totalWeight := boxDims.Weight

	var baseRates []FinalRate

	// 1. Find Matching Zone
	var zoneID uint
	var matchedZone ShippingZone

	// Try finding by exact country or fuzzy match
	var zCountry ShippingZoneCountry
	countrySearch := destCountry
	if strings.EqualFold(destCountry, "India") {
		countrySearch = "IN"
	} else if strings.EqualFold(destCountry, "United States") || strings.EqualFold(destCountry, "USA") {
		countrySearch = "US"
	} else if strings.EqualFold(destCountry, "United Kingdom") || strings.EqualFold(destCountry, "UK") {
		countrySearch = "GB"
	}
	
	if err := tenantDB.Where("country_code = ? OR country_code = ?", destCountry, countrySearch).First(&zCountry).Error; err == nil {
		zoneID = zCountry.ZoneID
	} else {
		// Fallback to Rest of World (IsDefault)
		if err := tenantDB.Where("is_default = ?", true).First(&matchedZone).Error; err == nil {
			zoneID = matchedZone.ID
		}
	}

	if zoneID != 0 {
		tenantDB.First(&matchedZone, zoneID)
		
		// Fetch Manual Rates
		var manualRates []ShippingZoneRate
		tenantDB.Where("zone_id = ? AND min_weight <= ? AND (max_weight = 0 OR max_weight >= ?) AND min_order_value <= ? AND (max_order_value = 0 OR max_order_value >= ?)", 
			zoneID, totalWeight, totalWeight, cartTotal, cartTotal).Find(&manualRates)

		for _, mr := range manualRates {
			baseRates = append(baseRates, FinalRate{
				ID:                fmt.Sprintf("manual_%d", mr.ID),
				Name:              mr.Name,
				Rate:              mr.Rate,
				EstimatedDelivery: mr.EstimatedDays,
			})
		}

		// Fetch Live Providers
		var zoneProviders []ShippingZoneProvider
		tenantDB.Where("zone_id = ?", zoneID).Find(&zoneProviders)

		// Create a context with timeout for ALL live rates
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		rateChan := make(chan []FinalRate, len(zoneProviders))

		for _, zp := range zoneProviders {
			var provider ShippingProvider
			if err := tenantDB.First(&provider, zp.ProviderID).Error; err == nil && provider.IsActive {
				go func(p ShippingProvider) {
					carrier := GetShippingCarrier(p.ProviderName, p.AuthConfig)
					if carrier != nil {
						originZip := shop.OriginPincode
						if originZip == "" {
							originZip = "10001"
						}
						payload := RateRequestPayload{
							OriginPincode:      originZip,
							OriginCountry:      "US",
							OriginState:        "NY",
							OriginCity:         "New York",
							OriginStreet:       "350 5th Ave",
							DestinationPincode: destPincode,
							DestinationCountry: destCountry,
							DestinationState:   destState,
							DestinationCity:    destCity,
							DestinationStreet:  destStreet,
							Weight:             totalWeight,
							BoxDimensions:      boxDims,
							ShopCurrency:       shop.Currency,
						}
						liveRates, err := carrier.GetLiveRates(ctx, payload)
						if err == nil {
							var mappedRates []FinalRate
							for _, lr := range liveRates {
								mappedRates = append(mappedRates, FinalRate{
									ID:                lr.ProviderID,
									Name:              lr.Name,
									Rate:              lr.Rate,
									EstimatedDelivery: lr.EstimatedDelivery,
								})
							}
							rateChan <- mappedRates
							return
						} else {
							log.Printf("[Checkout Error] %s GetLiveRates failed: %v", p.ProviderName, err)
						}
					}
					rateChan <- nil
				}(provider)
			} else {
				rateChan <- nil
			}
		}

		// Collect results
		for i := 0; i < len(zoneProviders); i++ {
			rates := <-rateChan
			if rates != nil {
				baseRates = append(baseRates, rates...)
			}
		}
	}

	// 3. Fallback if absolutely nothing is found
	if len(baseRates) == 0 {
		defName := shop.DefaultShippingName
		if defName == "" {
			defName = "Standard Delivery"
		}
		baseRates = append(baseRates, FinalRate{
			ID:                "default_standard",
			Name:              defName,
			Rate:              shop.DefaultShippingRate,
			EstimatedDelivery: "3-5 Business Days",
		})
	}

	// 4. Apply Rules
	var rules []ShippingRule
	tenantDB.Where("is_active = ? AND (zone_id = ? OR zone_id IS NULL)", true, zoneID).Order("priority asc").Find(&rules)

	var finalRates []FinalRate
	for _, br := range baseRates {
		rate := br.Rate

		// Only apply rules to manual or default rates
		if strings.HasPrefix(br.ID, "manual_") || strings.HasPrefix(br.ID, "default_") {
			for _, rule := range rules {
				rate = ApplyShippingRule(rule, cartTotal, totalWeight, rate)
				if rate != br.Rate {
					br.Name = rule.Name + " (" + br.Name + ")"
					if rule.ActionJSON == `{"type":"FREE_SHIPPING","value":0}` {
						break
					}
				}
			}
		}

		finalRates = append(finalRates, FinalRate{
			ID:                br.ID,
			Name:              br.Name,
			Rate:              rate,
			EstimatedDelivery: br.EstimatedDelivery,
		})
	}

	return finalRates, boxDims, cartTotal
}

func ApplyShippingRule(rule ShippingRule, cartTotal, totalWeight, currentRate float64) float64 {
	var conditions struct {
		Operator   string `json:"operator"`
		Conditions []struct {
			Field    string  `json:"field"`
			Operator string  `json:"operator"`
			Value    float64 `json:"value"`
		} `json:"conditions"`
	}
	json.Unmarshal([]byte(rule.ConditionsJSON), &conditions)

	var action struct {
		Type  string  `json:"type"`
		Value float64 `json:"value"`
	}
	json.Unmarshal([]byte(rule.ActionJSON), &action)

	rulePasses := true
	if len(conditions.Conditions) > 0 {
		for _, cond := range conditions.Conditions {
			valToCompare := cartTotal
			if cond.Field == "weight" {
				valToCompare = totalWeight
			} else if cond.Field == "live_shipping_rate" {
				valToCompare = currentRate
			}

			switch cond.Operator {
			case ">":
				if !(valToCompare > cond.Value) { rulePasses = false }
			case "<":
				if !(valToCompare < cond.Value) { rulePasses = false }
			case ">=":
				if !(valToCompare >= cond.Value) { rulePasses = false }
			case "<=":
				if !(valToCompare <= cond.Value) { rulePasses = false }
			}
		}
	}

	if rulePasses {
		if action.Type == "FREE_SHIPPING" {
			return 0
		} else if action.Type == "FLAT_RATE" {
			return action.Value
		} else if action.Type == "DISCOUNT_SHIPPING_RATE" {
			newRate := currentRate - action.Value
			if newRate < 0 {
				newRate = 0
			}
			return newRate
		}
	}
	return currentRate
}

func handleSimulateShipping(c *gin.Context) {
	shopID := c.Param("id")
	var shop Shop
	if err := db.First(&shop, "id = ?", shopID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var req CheckoutRatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	finalRates, boxDims, cartTotal := calculateShippingRatesForCart(tenantDB, shop, req.Cart, req.Pincode, req.Country, req.State, "", "")

	c.JSON(http.StatusOK, gin.H{
		"rates": finalRates,
		"box_dimensions": boxDims,
		"cart_total": cartTotal,
	})
}

// CalculateDiscount calculates the discount amount given the cart total and discount code.
func CalculateDiscount(tenantDB *gorm.DB, code string, cartTotal float64) (float64, *DiscountCode, error) {
	if code == "" {
		return 0, nil, nil
	}

	var discount DiscountCode
	if err := tenantDB.Where("code = ? AND is_active = ?", code, true).First(&discount).Error; err != nil {
		return 0, nil, fmt.Errorf("invalid or inactive discount code")
	}

	now := time.Now()
	if discount.ValidFrom != nil && now.Before(*discount.ValidFrom) {
		return 0, nil, fmt.Errorf("discount code is not yet valid")
	}
	if discount.ValidUntil != nil && now.After(*discount.ValidUntil) {
		return 0, nil, fmt.Errorf("discount code has expired")
	}

	if discount.UsageLimit != nil && discount.Uses >= *discount.UsageLimit {
		return 0, nil, fmt.Errorf("discount code usage limit reached")
	}

	if cartTotal < discount.MinPurchaseAmount {
		return 0, nil, fmt.Errorf("minimum purchase amount not met")
	}

	var discountAmount float64
	if discount.Type == "percentage" {
		discountAmount = cartTotal * (discount.Value / 100.0)
	} else if discount.Type == "flat" {
		discountAmount = discount.Value
	} else if discount.Type == "free_shipping" {
		// Handled separately in rates if needed, or we just return 0 here.
		// For simplicity, we can let free_shipping just waive shipping cost later.
		discountAmount = 0 
	}

	if discountAmount > cartTotal {
		discountAmount = cartTotal
	}

	return discountAmount, &discount, nil
}

type CartSyncRequest struct {
	Email string     `json:"email"`
	Cart  []CartItem `json:"cart"`
	Value float64    `json:"value"`
}

func handleCartSync(c *gin.Context) {
	subdomain := c.Param("subdomain")

	var req CartSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Email == "" || len(req.Cart) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No email or cart to sync"})
		return
	}

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	cartJSON, _ := json.Marshal(req.Cart)

	var cart AbandonedCart
	if err := tenantDB.Where("customer_email = ?", req.Email).Order("updated_at desc").First(&cart).Error; err == nil {
		if cart.Status == "Abandoned" {
			// Update existing
			cart.CartJSON = string(cartJSON)
			cart.Value = req.Value
			tenantDB.Save(&cart)
			if GlobalBroker != nil {
				GlobalBroker.BroadcastEvent(shop.ID, EventCartAbandoned, cart)
			}
		} else {
			// They had a recovered cart, let's make a new abandoned one
			newCart := AbandonedCart{
				CustomerEmail: req.Email,
				CartJSON:      string(cartJSON),
				Value:         req.Value,
				Status:        "Abandoned",
			}
			tenantDB.Create(&newCart)
			if GlobalBroker != nil {
				GlobalBroker.BroadcastEvent(shop.ID, EventCartAbandoned, newCart)
			}
		}
	} else {
		// New cart
		newCart := AbandonedCart{
			CustomerEmail: req.Email,
			CartJSON:      string(cartJSON),
			Value:         req.Value,
			Status:        "Abandoned",
		}
		tenantDB.Create(&newCart)
		if GlobalBroker != nil {
			GlobalBroker.BroadcastEvent(shop.ID, EventCartAbandoned, newCart)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cart synced"})
}

func handleVerifyPayment(c *gin.Context) {
	subdomain := c.Param("subdomain")

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tenant DB error"})
		return
	}

	var payload struct {
		OrderID    string `json:"cf_order_id"`
		Provider   string `json:"provider"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	if payload.Provider != "cashfree" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported provider for verification"})
		return
	}

	// Get provider config
	var providerConfig TenantPaymentConfig
	if err := tenantDB.Where("provider_name = ? AND is_active = ?", "cashfree", true).First(&providerConfig).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cashfree not configured"})
		return
	}

	provider := GetPaymentProvider("cashfree", providerConfig.AuthConfig)
	if provider == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Provider error"})
		return
	}

	cfProvider, ok := provider.(*CashfreeProvider)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Provider type error"})
		return
	}

	// Call Cashfree API to check order status
	orderStatus, err := cfProvider.VerifyOrder(payload.OrderID)
	if err != nil {
		log.Printf("[Verify Payment] Error verifying order %s: %v", payload.OrderID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Verification failed"})
		return
	}

	// Extract our internal order ID from the Cashfree order_id (format: order_123)
	orderIDStr := strings.TrimPrefix(payload.OrderID, "order_")
	
	if orderStatus == "PAID" {
		var order Order
		if err := tenantDB.First(&order, orderIDStr).Error; err == nil {
			if order.Status == "Pending Payment" {
				order.Status = "Paid"
				tenantDB.Save(&order)
				log.Printf("[Verify Payment] Order %d marked as Paid via Cashfree verification!", order.ID)
				
				triggerAutoFulfillment(tenantDB, shop, order)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       orderStatus,
		"order_id":     payload.OrderID,
		"payment_paid": orderStatus == "PAID",
	})
}
