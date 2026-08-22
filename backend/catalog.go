package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// -------------------------------------------------------------
// Admin: Categories
// -------------------------------------------------------------

func handleGetCategories(c *gin.Context) {
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

	var categories []Category
	if err := tenantDB.Preload("Products").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

func handleCreateCategory(c *gin.Context) {
	// Context extraction moved below

	var req struct {
		Name       string `json:"name" binding:"required"`
		ImageURL   string `json:"image_url"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	category := Category{
		Name:       req.Name,
		Slug:       strings.ReplaceAll(strings.ToLower(req.Name), " ", "-"),
		ImageURL:   req.ImageURL,
	}

	if err := tenantDB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": category})
}

func handleUpdateCategory(c *gin.Context) {
	categoryID := c.Param("category_id")
	// Context extraction moved below

	var req struct {
		Name       string `json:"name" binding:"required"`
		ImageURL   string `json:"image_url"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	var category Category
	if err := tenantDB.First(&category, categoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	category.Name = req.Name
	category.Slug = strings.ReplaceAll(strings.ToLower(req.Name), " ", "-")
	category.ImageURL = req.ImageURL

	if err := tenantDB.Save(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": category})
}

func handleDeleteCategory(c *gin.Context) {
	categoryID := c.Param("category_id")
	// Context extraction moved below

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

	if err := tenantDB.Delete(&Category{}, categoryID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted successfully"})
}

// -------------------------------------------------------------
// Admin: Products
// -------------------------------------------------------------

func handleGetProducts(c *gin.Context) {
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

	var products []Product
	if err := tenantDB.Preload("Options").Preload("Variants").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"products": products})
}

func handleCreateProduct(c *gin.Context) {
	// Context extraction moved below

	var req struct {
		Title         string           `json:"title" binding:"required"`
		Description   string           `json:"description"`
		Price          float64          `json:"price" binding:"required"`
		CompareAtPrice float64          `json:"compare_at_price"`
		StockQuantity  int              `json:"stock_quantity"`
		ImageURL      string           `json:"image_url"`
		Weight        float64          `json:"weight"`
		Length        float64          `json:"length"`
		Width         float64          `json:"width"`
		Height        float64          `json:"height"`
		CategoryID    *uint            `json:"category_id"`
		Options       []ProductOption  `json:"options"`
		Variants      []ProductVariant `json:"variants"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	product := Product{
		Title:         req.Title,
		Description:    req.Description,
		Price:          req.Price,
		CompareAtPrice: req.CompareAtPrice,
		StockQuantity:  req.StockQuantity,
		ImageURL:      req.ImageURL,
		Weight:        req.Weight,
		Length:        req.Length,
		Width:         req.Width,
		Height:        req.Height,
		CategoryID:    req.CategoryID,
		Options:       req.Options,
		Variants:      req.Variants,
	}

	if err := tenantDB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
		return
	}

	if shop.EnableAISearch {
		go GenerateProductEmbedding(shop.DBName, shop.ID, product.ID, product.Title, product.Description)
	}

	c.JSON(http.StatusCreated, product)
}

func handleUpdateProduct(c *gin.Context) {
	productID := c.Param("product_id")
	// Context extraction moved below

	var req struct {
		Title         string           `json:"title" binding:"required"`
		Description   string           `json:"description"`
		Price          float64          `json:"price" binding:"required"`
		CompareAtPrice float64          `json:"compare_at_price"`
		StockQuantity  int              `json:"stock_quantity"`
		ImageURL      string           `json:"image_url"`
		Weight        float64          `json:"weight"`
		Length        float64          `json:"length"`
		Width         float64          `json:"width"`
		Height        float64          `json:"height"`
		CategoryID    *uint            `json:"category_id"`
		Options       []ProductOption  `json:"options"`
		Variants      []ProductVariant `json:"variants"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	var product Product
	if err := tenantDB.Preload("Options").Preload("Variants").First(&product, productID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	// Clear old options and variants
	if err := tenantDB.Where("product_id = ?", product.ID).Delete(&ProductOption{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update options"})
		return
	}
	if err := tenantDB.Where("product_id = ?", product.ID).Delete(&ProductVariant{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update variants"})
		return
	}

	// Zero out IDs so they are inserted as new records instead of trying to update deleted ones
	for i := range req.Options {
		req.Options[i].ID = 0
	}
	for i := range req.Variants {
		req.Variants[i].ID = 0
	}

	product.Title = req.Title
	product.Description = req.Description
	product.Price = req.Price
	product.CompareAtPrice = req.CompareAtPrice
	product.StockQuantity = req.StockQuantity
	product.ImageURL = req.ImageURL
	product.Weight = req.Weight
	product.Length = req.Length
	product.Width = req.Width
	product.Height = req.Height
	product.CategoryID = req.CategoryID
	product.Options = req.Options
	product.Variants = req.Variants

	if err := tenantDB.Save(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
		return
	}

	if shop.EnableAISearch {
		go GenerateProductEmbedding(shop.DBName, shop.ID, product.ID, product.Title, product.Description)
	} else {
		// Just clear the updated_at timestamp since the embedding is now stale
		tenantDB.Model(&product).Update("embedding_updated_at", nil)
	}

	c.JSON(http.StatusOK, product)
}

func handleDeleteProduct(c *gin.Context) {
	productID := c.Param("product_id")
	// Context extraction moved below

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

	var product Product
	if err := tenantDB.First(&product, productID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	if err := tenantDB.Delete(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete product"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product deleted successfully"})
}

// -------------------------------------------------------------
// Storefront API
// -------------------------------------------------------------

func handleGetStorefrontCatalog(c *gin.Context) {
	subdomain := c.Param("subdomain")

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

	var categories []Category
	if err := tenantDB.Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}

	q := c.Query("q")
	minPrice := c.Query("min_price")
	maxPrice := c.Query("max_price")
	categoryID := c.Query("category_id")

	query := tenantDB.Model(&Product{})

	if q != "" {
		if shop.EnableAISearch {
			// Try Semantic Search first
			semanticProductIDs, err := CallSemanticSearch(shop.ID, q, 50)
			if err == nil {
				if len(semanticProductIDs) > 0 {
					// Search successful, filter by these IDs
					query = query.Where("id IN ?", semanticProductIDs)
				} else {
					// AI searched but found nothing. Don't fallback to SQL.
					query = query.Where("1 = 0")
				}
			} else {
				// Fallback to SQL LIKE only if AI service is down/error
				query = query.Where("title LIKE ? OR description LIKE ?", "%"+q+"%", "%"+q+"%")
			}
		} else {
			// AI Search disabled, fallback to standard SQL
			query = query.Where("title LIKE ? OR description LIKE ?", "%"+q+"%", "%"+q+"%")
		}
	}
	if minPrice != "" {
		query = query.Where("price >= ?", minPrice)
	}
	if maxPrice != "" {
		query = query.Where("price <= ?", maxPrice)
	}
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	var products []Product
	if err := query.Preload("Options").Preload("Variants").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"shop": gin.H{
			"name":     shop.Name,
			"logo_url": shop.LogoURL,
			"currency": shop.Currency,
		},
		"categories": categories,
		"products":   products,
	})
}
