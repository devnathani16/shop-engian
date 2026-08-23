package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// handleGetDiscounts retrieves all discounts for a given shop
func handleGetDiscounts(c *gin.Context) {
	shopID := c.Param("id")
	var shop Shop
	if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var discounts []DiscountCode
	if err := tenantDB.Find(&discounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch discounts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"discounts": discounts})
}

// handleCreateDiscount creates a new discount code
func handleCreateDiscount(c *gin.Context) {
	shopID := c.Param("id")
	var shop Shop
	if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var input struct {
		Code              string  `json:"code" binding:"required"`
		Type              string  `json:"type" binding:"required"`
		Value             float64 `json:"value"`
		MinPurchaseAmount float64 `json:"min_purchase_amount"`
		UsageLimit        *int    `json:"usage_limit"`
		ValidFrom         string  `json:"valid_from"`
		ValidUntil        string  `json:"valid_until"`
		IsActive          bool    `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	discount := DiscountCode{
		Code:              input.Code,
		Type:              input.Type,
		Value:             input.Value,
		MinPurchaseAmount: input.MinPurchaseAmount,
		UsageLimit:        input.UsageLimit,
		IsActive:          input.IsActive,
	}

	layout := "2006-01-02T15:04:05Z"
	if input.ValidFrom != "" {
		if t, err := time.Parse(layout, input.ValidFrom); err == nil {
			discount.ValidFrom = &t
		}
	}
	if input.ValidUntil != "" {
		if t, err := time.Parse(layout, input.ValidUntil); err == nil {
			discount.ValidUntil = &t
		}
	}

	if err := tenantDB.Create(&discount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create discount code: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Discount code created", "discount": discount})
}

// handleUpdateDiscount updates an existing discount code
func handleUpdateDiscount(c *gin.Context) {
	shopID := c.Param("id")
	discountID := c.Param("discount_id")

	var shop Shop
	if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var discount DiscountCode
	if err := tenantDB.First(&discount, discountID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Discount code not found"})
		return
	}

	var input struct {
		IsActive *bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if input.IsActive != nil {
		discount.IsActive = *input.IsActive
	}

	if err := tenantDB.Save(&discount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update discount code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Discount code updated", "discount": discount})
}

// handleDeleteDiscount deletes a discount code
func handleDeleteDiscount(c *gin.Context) {
	shopID := c.Param("id")
	discountID := c.Param("discount_id")

	var shop Shop
	if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if err := tenantDB.Delete(&DiscountCode{}, discountID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete discount code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Discount code deleted"})
}
