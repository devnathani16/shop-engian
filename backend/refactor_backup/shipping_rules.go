package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// handleGetShippingRules lists all shipping rules for the shop
func handleGetShippingRules(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to shop database"})
		return
	}

	var rules []ShippingRule
	if err := tenantDB.Order("priority asc").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch shipping rules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

// handleCreateShippingRule creates a new shipping rule
func handleCreateShippingRule(c *gin.Context) {

	var req struct {
		Name           string `json:"name" binding:"required"`
		Priority       int    `json:"priority"`
		ZoneID         *uint  `json:"zone_id"`
		ConditionsJSON string `json:"conditions_json" binding:"required"`
		ActionJSON     string `json:"action_json" binding:"required"`
		IsActive       bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to shop database"})
		return
	}

	rule := ShippingRule{
		ShopID:         shopID,
		Name:           req.Name,
		Priority:       req.Priority,
		ZoneID:         req.ZoneID,
		ConditionsJSON: req.ConditionsJSON,
		ActionJSON:     req.ActionJSON,
		IsActive:       req.IsActive,
	}

	if err := tenantDB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

// handleDeleteShippingRule deletes a shipping rule
func handleDeleteShippingRule(c *gin.Context) {
	ruleID := c.Param("rule_id")


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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to shop database"})
		return
	}

	if err := tenantDB.Delete(&ShippingRule{}, ruleID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rule deleted"})
}
