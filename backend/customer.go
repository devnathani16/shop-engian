package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// -------------------------------------------------------------
// Admin: Customers
// -------------------------------------------------------------

func handleGetCustomers(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	var customers []Customer
	// Order by most recent first
	if err := tenantDB.Order("created_at desc").Find(&customers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"customers": customers})
}

// -------------------------------------------------------------
// Storefront API
// -------------------------------------------------------------

func handleSyncCustomer(c *gin.Context) {
	subdomain := c.Param("subdomain")

	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Provider string `json:"provider"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Provider == "" {
		req.Provider = "default"
	}

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to store database"})
		return
	}

	var customer Customer
	// Find or Create the customer based on Email
	err = tenantDB.Where("email = ?", req.Email).FirstOrCreate(&customer, Customer{
		Email:    req.Email,
		Provider: req.Provider,
	}).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync customer"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Customer synced successfully", "customer": customer})
}
