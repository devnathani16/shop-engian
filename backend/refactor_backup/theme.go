package main

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

// DefaultThemeJSON is the baseline "Dawn-like" theme structure
var DefaultThemeJSON = `{
  "global": {
    "colors": {
      "primary": "#000000",
      "background": "#ffffff",
      "text": "#1a1a1a"
    },
    "typography": {
      "fontFamily": "Inter, sans-serif"
    }
  },
  "pages": {
    "home": [
      {
        "id": "hero_1",
        "type": "hero",
        "settings": {
          "title": "Welcome to our store",
          "subtitle": "Discover the new standard in minimalist design.",
          "buttonText": "Shop Now",
          "buttonLink": "#products",
          "imageUrl": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=80"
        }
      },
      {
        "id": "category_grid_1",
        "type": "category_grid",
        "settings": {
          "title": "Shop by Category"
        }
      },
      {
        "id": "featured_products_1",
        "type": "featured_products",
        "settings": {
          "title": "Featured Products",
          "subtitle": "Curated selections for the modern lifestyle."
        }
      }
    ],
    "products": [
      {
        "id": "featured_products_2",
        "type": "featured_products",
        "settings": {
          "title": "All Products",
          "subtitle": "Browse our entire collection."
        }
      }
    ],
    "about": [
      {
        "id": "hero_2",
        "type": "hero",
        "settings": {
          "title": "About Us",
          "subtitle": "We are on a mission to redefine commerce.",
          "buttonText": "Contact Us",
          "buttonLink": "#contact",
          "imageUrl": "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=2000&q=80"
        }
      }
    ]
  }
}`

type UpdateThemeRequest struct {
	Config json.RawMessage `json:"config"`
}

func handleGetAdminTheme(c *gin.Context) {
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

	var theme ThemeSetting
	if err := tenantDB.First(&theme).Error; err != nil {
		// Create default theme if it doesn't exist
		theme = ThemeSetting{Config: DefaultThemeJSON}
		tenantDB.Create(&theme)
	}

	c.JSON(http.StatusOK, gin.H{"config": json.RawMessage(theme.Config)})
}

func handleUpdateAdminTheme(c *gin.Context) {

	var req UpdateThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var theme ThemeSetting
	if err := tenantDB.First(&theme).Error; err != nil {
		theme = ThemeSetting{Config: string(req.Config)}
		tenantDB.Create(&theme)
	} else {
		theme.Config = string(req.Config)
		tenantDB.Save(&theme)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Theme updated successfully", "config": json.RawMessage(theme.Config)})
}

func handleGetStorefrontTheme(c *gin.Context) {
	subdomain := c.Param("subdomain")

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

	var theme ThemeSetting
	if err := tenantDB.First(&theme).Error; err != nil {
		theme = ThemeSetting{Config: DefaultThemeJSON}
	}

	c.JSON(http.StatusOK, gin.H{"config": json.RawMessage(theme.Config)})
}
