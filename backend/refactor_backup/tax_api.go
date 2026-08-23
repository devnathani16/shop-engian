package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ===== TAX CATEGORIES =====

func handleGetTaxCategories(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var categories []TaxCategory
	tenantDB.Where("shop_id = ?", shopID).Order("created_at ASC").Find(&categories)
	c.JSON(http.StatusOK, categories)
}

func handleCreateTaxCategory(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Name      string `json:"name" binding:"required"`
		IsDefault bool   `json:"is_default"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// If setting as default, unset other defaults
	if req.IsDefault {
		tenantDB.Model(&TaxCategory{}).Where("shop_id = ?", shopID).Update("is_default", false)
	}
	cat := TaxCategory{ShopID: shopID, Name: req.Name, IsDefault: req.IsDefault}
	if err := tenantDB.Create(&cat).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tax category"})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func handleDeleteTaxCategory(c *gin.Context) {
	shopID := c.Param("id")
	catID := c.Param("cat_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ? AND shop_id = ?", catID, shopID).Delete(&TaxCategory{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ===== TAX ZONES =====

func handleGetTaxZones(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var zones []TaxZone
	tenantDB.Where("shop_id = ?", shopID).Order("created_at ASC").Find(&zones)

	type ZoneWithDetails struct {
		TaxZone
		Countries []TaxZoneCountry `json:"countries"`
		Regions   []TaxZoneRegion  `json:"regions"`
		Rates     []TaxRate        `json:"rates"`
	}

	var result []ZoneWithDetails
	for _, z := range zones {
		var countries []TaxZoneCountry
		var regions []TaxZoneRegion
		var rates []TaxRate
		tenantDB.Where("tax_zone_id = ?", z.ID).Find(&countries)
		tenantDB.Where("tax_zone_id = ?", z.ID).Find(&regions)
		tenantDB.Where("tax_zone_id = ?", z.ID).Order("priority ASC").Find(&rates)
		result = append(result, ZoneWithDetails{
			TaxZone:   z,
			Countries: countries,
			Regions:   regions,
			Rates:     rates,
		})
	}
	c.JSON(http.StatusOK, result)
}

func handleCreateTaxZone(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Name      string `json:"name" binding:"required"`
		IsDefault bool   `json:"is_default"`
		Inclusive bool   `json:"inclusive"`
		Enabled   bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.IsDefault {
		tenantDB.Model(&TaxZone{}).Where("shop_id = ?", shopID).Update("is_default", false)
	}
	zone := TaxZone{ShopID: shopID, Name: req.Name, IsDefault: req.IsDefault, Inclusive: req.Inclusive, Enabled: req.Enabled}
	if err := tenantDB.Create(&zone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tax zone"})
		return
	}
	c.JSON(http.StatusOK, zone)
}

func handleUpdateTaxZone(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Name      *string `json:"name"`
		IsDefault *bool   `json:"is_default"`
		Inclusive *bool   `json:"inclusive"`
		Enabled   *bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var zone TaxZone
	if err := tenantDB.Where("id = ? AND shop_id = ?", zoneID, shopID).First(&zone).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tax zone not found"})
		return
	}
	if req.Name != nil {
		zone.Name = *req.Name
	}
	if req.IsDefault != nil {
		if *req.IsDefault {
			tenantDB.Model(&TaxZone{}).Where("shop_id = ? AND id != ?", shopID, zone.ID).Update("is_default", false)
		}
		zone.IsDefault = *req.IsDefault
	}
	if req.Inclusive != nil {
		zone.Inclusive = *req.Inclusive
	}
	if req.Enabled != nil {
		zone.Enabled = *req.Enabled
	}
	tenantDB.Save(&zone)
	c.JSON(http.StatusOK, zone)
}

func handleDeleteTaxZone(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ? AND shop_id = ?", zoneID, shopID).Delete(&TaxZone{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ===== TAX ZONE COUNTRIES =====

func handleAddTaxZoneCountry(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		CountryCode string `json:"country_code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	zid, _ := strconv.ParseUint(zoneID, 10, 32)
	country := TaxZoneCountry{TaxZoneID: uint(zid), CountryCode: req.CountryCode}
	if err := tenantDB.Create(&country).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add country"})
		return
	}
	c.JSON(http.StatusOK, country)
}

func handleRemoveTaxZoneCountry(c *gin.Context) {
	_ = c.Param("id") // shopID for auth
	countryID := c.Param("country_id")
	tenantDB, err := getTenantDB(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ?", countryID).Delete(&TaxZoneCountry{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ===== TAX ZONE REGIONS =====

func handleAddTaxZoneRegion(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		RegionCode string `json:"region_code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	zid, _ := strconv.ParseUint(zoneID, 10, 32)
	region := TaxZoneRegion{TaxZoneID: uint(zid), RegionCode: req.RegionCode}
	if err := tenantDB.Create(&region).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add region"})
		return
	}
	c.JSON(http.StatusOK, region)
}

func handleRemoveTaxZoneRegion(c *gin.Context) {
	_ = c.Param("id")
	regionID := c.Param("region_id")
	tenantDB, err := getTenantDB(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ?", regionID).Delete(&TaxZoneRegion{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ===== TAX RATES =====

func handleCreateTaxRate(c *gin.Context) {
	shopID := c.Param("id")
	zoneID := c.Param("zone_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		TaxCategoryID uint    `json:"tax_category_id" binding:"required"`
		Name          string  `json:"name" binding:"required"`
		Rate          float64 `json:"rate" binding:"required"`
		RateType      string  `json:"rate_type"`
		IsCompound    bool    `json:"is_compound"`
		Priority      int     `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.RateType == "" {
		req.RateType = "percentage"
	}
	zid, _ := strconv.ParseUint(zoneID, 10, 32)
	rate := TaxRate{
		TaxZoneID:     uint(zid),
		TaxCategoryID: req.TaxCategoryID,
		Name:          req.Name,
		Rate:          req.Rate,
		RateType:      req.RateType,
		IsCompound:    req.IsCompound,
		Priority:      req.Priority,
	}
	if err := tenantDB.Create(&rate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tax rate"})
		return
	}
	c.JSON(http.StatusOK, rate)
}

func handleUpdateTaxRate(c *gin.Context) {
	shopID := c.Param("id")
	rateID := c.Param("rate_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		Name       *string  `json:"name"`
		Rate       *float64 `json:"rate"`
		RateType   *string  `json:"rate_type"`
		IsCompound *bool    `json:"is_compound"`
		Priority   *int     `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var rate TaxRate
	if err := tenantDB.First(&rate, rateID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tax rate not found"})
		return
	}
	if req.Name != nil {
		rate.Name = *req.Name
	}
	if req.Rate != nil {
		rate.Rate = *req.Rate
	}
	if req.RateType != nil {
		rate.RateType = *req.RateType
	}
	if req.IsCompound != nil {
		rate.IsCompound = *req.IsCompound
	}
	if req.Priority != nil {
		rate.Priority = *req.Priority
	}
	tenantDB.Save(&rate)
	c.JSON(http.StatusOK, rate)
}

func handleDeleteTaxRate(c *gin.Context) {
	_ = c.Param("id")
	rateID := c.Param("rate_id")
	tenantDB, err := getTenantDB(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ?", rateID).Delete(&TaxRate{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ===== TAX OVERRIDES =====

func handleGetTaxOverrides(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var overrides []ShopTaxOverride
	tenantDB.Where("shop_id = ?", shopID).Find(&overrides)
	c.JSON(http.StatusOK, overrides)
}

func handleCreateTaxOverride(c *gin.Context) {
	shopID := c.Param("id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	var req struct {
		ScopeType string  `json:"scope_type" binding:"required"`
		ScopeID   uint    `json:"scope_id" binding:"required"`
		TaxZoneID uint    `json:"tax_zone_id" binding:"required"`
		Rate      float64 `json:"rate"`
		Exempt    bool    `json:"exempt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	override := ShopTaxOverride{
		ShopID:    shopID,
		ScopeType: req.ScopeType,
		ScopeID:   req.ScopeID,
		TaxZoneID: req.TaxZoneID,
		Rate:      req.Rate,
		Exempt:    req.Exempt,
	}
	if err := tenantDB.Create(&override).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tax override"})
		return
	}
	c.JSON(http.StatusOK, override)
}

func handleDeleteTaxOverride(c *gin.Context) {
	shopID := c.Param("id")
	overrideID := c.Param("override_id")
	tenantDB, err := getTenantDB(c, shopID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	tenantDB.Where("id = ? AND shop_id = ?", overrideID, shopID).Delete(&ShopTaxOverride{})
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
