package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"gorm.io/gorm"
)

// triggerAIInventoryInsight checks if stock is low and generates an insight via the AI service
func triggerAIInventoryInsight(tenantDB *gorm.DB, shop Shop, variant ProductVariant, newStock int) {
	// Only trigger if stock drops to 5 or below
	if newStock > 5 {
		return
	}

	// Run in background so it doesn't block webhooks
	go func() {
		// Calculate a rough sales velocity by checking orders in the last 7 days
		var recentItems []OrderItem
		sevenDaysAgo := time.Now().AddDate(0, 0, -7)
		tenantDB.Joins("JOIN orders ON orders.id = order_items.order_id").
			Where("order_items.variant_id = ? AND orders.status = ? AND orders.created_at >= ?", variant.ID, "Paid", sevenDaysAgo).
			Find(&recentItems)

		var unitsSold int
		for _, item := range recentItems {
			unitsSold += item.Quantity
		}

		velocity := float64(unitsSold) / 7.0
		if velocity < 0.1 {
			velocity = 0.5 // Baseline minimal velocity so the AI has something to work with
		}

		// Fetch product title
		var prod Product
		if err := tenantDB.First(&prod, variant.ProductID).Error; err != nil {
			return
		}

		// Call Python AIML service
		reqBody := map[string]interface{}{
			"product_title":  prod.Title,
			"variant_title":  variant.Title,
			"current_stock":  newStock,
			"sales_velocity": velocity,
		}

		jsonBody, _ := json.Marshal(reqBody)
		resp, err := http.Post("http://127.0.0.1:8000/inventory-insight", "application/json", bytes.NewBuffer(jsonBody))
		if err != nil {
			log.Printf("[Inventory AI Error] Failed to call AI service: %v", err)
			return
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			insightMsg, _ := result["insight"].(string)
			severity, _ := result["severity"].(string)

			if insightMsg != "" {
				insight := InventoryInsight{
					ShopID:    shop.ID,
					VariantID: variant.ID,
					Message:   insightMsg,
					Severity:  severity,
				}
				// Optionally clean up old insights for this variant before saving a new one
				tenantDB.Where("variant_id = ?", variant.ID).Delete(&InventoryInsight{})
				
				tenantDB.Create(&insight)
				log.Printf("[Inventory AI] Generated insight for %s: %s", variant.Title, insightMsg)
			}
		}
	}()
}
