package main

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireShopPermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		shopID := c.Param("id")
		userInterface, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		user := userInterface.(User)

		var shop Shop
		if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
			return
		}

		if user.ID == shop.UserID {
			// Owner has all permissions
			c.Set("shop", shop)
			c.Next()
			return
		}

		var staff ShopStaff
		if err := db.Where("shop_id = ? AND user_id = ?", shopID, user.ID).First(&staff).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden - Not a staff member"})
			return
		}

		var role ShopRole
		if err := db.Where("id = ?", staff.RoleID).First(&role).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden - Role not found"})
			return
		}

		var perms []string
		if err := json.Unmarshal([]byte(role.Permissions), &perms); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse permissions"})
			return
		}

		hasPermission := false
		for _, p := range perms {
			if p == "*" || p == permission {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden - Missing permission: " + permission})
			return
		}

		c.Set("shop", shop)
		c.Next()
	}
}
