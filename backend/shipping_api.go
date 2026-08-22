package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// -------------------------------------------------------------
// Shipping Providers
// -------------------------------------------------------------

func handleGetShippingProviders(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var providers []ShippingProvider
	tenantDB.Find(&providers)
	c.JSON(http.StatusOK, gin.H{"providers": providers})
}

func handleCreateShippingProvider(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req ShippingProvider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.ShopID = shopID

	if err := tenantDB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create provider"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"provider": req})
}

func handleUpdateShippingProvider(c *gin.Context) {
	shopID := c.Param("id")
	providerID := c.Param("provider_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req ShippingProvider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing ShippingProvider
	if err := tenantDB.First(&existing, providerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	existing.AuthConfig = req.AuthConfig
	existing.IsActive = req.IsActive
	tenantDB.Save(&existing)

	c.JSON(http.StatusOK, gin.H{"provider": existing})
}

// -------------------------------------------------------------
// Shipping Zones
// -------------------------------------------------------------

type ShippingZoneResponse struct {
	ShippingZone
	Countries []ShippingZoneCountry  `json:"countries"`
	Rates     []ShippingZoneRate     `json:"rates"`
	Providers []ShippingZoneProvider `json:"providers"`
}

func handleGetShippingZones(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var zones []ShippingZone
	tenantDB.Find(&zones)

	var response []ShippingZoneResponse
	for _, z := range zones {
		var zr ShippingZoneResponse
		zr.ShippingZone = z
		tenantDB.Where("zone_id = ?", z.ID).Find(&zr.Countries)
		tenantDB.Where("zone_id = ?", z.ID).Find(&zr.Rates)
		tenantDB.Where("zone_id = ?", z.ID).Find(&zr.Providers)
		response = append(response, zr)
	}

	c.JSON(http.StatusOK, gin.H{"zones": response})
}

type CreateZoneRequest struct {
	Name      string   `json:"name"`
	IsDefault bool     `json:"is_default"`
	Countries []string `json:"countries"`
}

func handleCreateShippingZone(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req CreateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	zone := ShippingZone{
		ShopID:    shopID,
		Name:      req.Name,
		IsDefault: req.IsDefault,
	}

	if err := tenantDB.Create(&zone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create zone"})
		return
	}

	for _, code := range req.Countries {
		tenantDB.Create(&ShippingZoneCountry{ZoneID: zone.ID, CountryCode: code})
	}

	c.JSON(http.StatusOK, gin.H{"zone": zone})
}

func handleDeleteShippingZone(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Delete(&ShippingZone{}, zoneID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// -------------------------------------------------------------
// Zone Providers & Rates
// -------------------------------------------------------------

type AddZoneProviderRequest struct {
	ProviderID uint `json:"provider_id"`
}

func handleAddZoneProvider(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req AddZoneProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var zp ShippingZoneProvider
	zp.ZoneID = parseUint(zoneID)
	zp.ProviderID = req.ProviderID
	tenantDB.Create(&zp)

	c.JSON(http.StatusOK, gin.H{"message": "Provider added to zone"})
}

func handleRemoveZoneProvider(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	providerID := c.Param("provider_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	tenantDB.Delete(&ShippingZoneProvider{}, "zone_id = ? AND provider_id = ?", zoneID, providerID)

	c.JSON(http.StatusOK, gin.H{"message": "Provider removed from zone"})
}

// -------------------------------------------------------------
// Manual Rates
// -------------------------------------------------------------

type CreateZoneRateRequest struct {
	Name           string  `json:"name"`
	Rate           float64 `json:"rate"`
	MinWeight      float64 `json:"min_weight"`
	MaxWeight      float64 `json:"max_weight"`
	MinOrderValue  float64 `json:"min_order_value"`
	MaxOrderValue  float64 `json:"max_order_value"`
	EstimatedDays  string  `json:"estimated_days"`
}

func handleCreateZoneRate(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req CreateZoneRateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rate := ShippingZoneRate{
		ZoneID:        parseUint(zoneID),
		Name:          req.Name,
		Rate:          req.Rate,
		MinWeight:     req.MinWeight,
		MaxWeight:     req.MaxWeight,
		MinOrderValue: req.MinOrderValue,
		MaxOrderValue: req.MaxOrderValue,
		EstimatedDays: req.EstimatedDays,
	}

	if err := tenantDB.Create(&rate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rate": rate})
}

func handleDeleteZoneRate(c *gin.Context) {
	shopID := c.Param("id")
	rateID := c.Param("rate_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Delete(&ShippingZoneRate{}, rateID)
	c.JSON(http.StatusOK, gin.H{"message": "Rate deleted"})
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
func getTenantDB(c *gin.Context, shopID string) (*gorm.DB, error) {
	userInterface, exists := c.Get("user")
	if !exists {
		return nil, fmt.Errorf("unauthorized")
	}
	user := userInterface.(User)
	var shop Shop
	if err := db.Where("id = ? AND user_id = ?", shopID, user.ID).First(&shop).Error; err != nil {
		return nil, fmt.Errorf("shop not found")
	}
	return GlobalTenantManager.GetConnection(shop.DBName)
}

func parseUint(s string) uint {
	var val uint
	fmt.Sscanf(s, "%d", &val)
	return val
}
