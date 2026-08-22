package main

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Roles
func handleGetShopRoles(c *gin.Context) {
	shopID := c.Param("id")
	var roles []ShopRole
	if err := db.Where("shop_id = ?", shopID).Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch roles"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"roles": roles})
}

type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	DisplayName string   `json:"display_name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions" binding:"required"`
}

func handleCreateShopRole(c *gin.Context) {
	shopID := c.Param("id")
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	permsJSON, _ := json.Marshal(req.Permissions)
	role := ShopRole{
		ShopID:      shopID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Permissions: string(permsJSON),
	}

	if err := db.Create(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"role": role})
}

type UpdateRoleRequest struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

func handleUpdateShopRole(c *gin.Context) {
	shopID := c.Param("id")
	roleID := c.Param("role_id")
	
	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var role ShopRole
	if err := db.Where("id = ? AND shop_id = ?", roleID, shopID).First(&role).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}

	if req.Name != "" {
		role.Name = req.Name
	}
	if req.DisplayName != "" {
		role.DisplayName = req.DisplayName
	}
	if req.Description != "" {
		role.Description = req.Description
	}
	if req.Permissions != nil {
		permsJSON, _ := json.Marshal(req.Permissions)
		role.Permissions = string(permsJSON)
	}

	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"role": role})
}

func handleDeleteShopRole(c *gin.Context) {
	shopID := c.Param("id")
	roleID := c.Param("role_id")

	if err := db.Where("id = ? AND shop_id = ?", roleID, shopID).Delete(&ShopRole{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// Staff
func handleGetShopStaff(c *gin.Context) {
	shopID := c.Param("id")
	var staff []ShopStaff
	if err := db.Where("shop_id = ?", shopID).Find(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staff"})
		return
	}
	var invites []ShopInvite
	if err := db.Where("shop_id = ? AND status = ?", shopID, "pending").Find(&invites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invites"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"staff": staff, "invites": invites})
}

type CreateStaffRequest struct {
	Email  string `json:"email" binding:"required"`
	RoleID uint   `json:"role_id" binding:"required"`
}

func handleCreateShopStaff(c *gin.Context) {
	shopID := c.Param("id")
	var req CreateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	inviter := userInterface.(User)

	// Verify role belongs to shop
	var role ShopRole
	if err := db.Where("id = ? AND shop_id = ?", req.RoleID, shopID).First(&role).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	// Check if already invited and pending
	var existingInvite ShopInvite
	if err := db.Where("shop_id = ? AND email = ? AND status = ?", shopID, req.Email, "pending").First(&existingInvite).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An invite is already pending for this email"})
		return
	}

	// Find user by email to check if they are already staff
	var targetUser User
	if err := db.Where("email = ?", req.Email).First(&targetUser).Error; err == nil {
		var existingStaff ShopStaff
		if err := db.Where("shop_id = ? AND user_id = ?", shopID, targetUser.ID).First(&existingStaff).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already staff in this shop"})
			return
		}
	}

	invite := ShopInvite{
		ShopID:    shopID,
		Email:     req.Email,
		RoleID:    req.RoleID,
		Status:    "pending",
		InviterID: inviter.ID,
	}

	if err := db.Create(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}

	// TODO: Send email via Resend if email is not registered yet, or send a notification email if they are.

	c.JSON(http.StatusOK, gin.H{"message": "Invitation sent successfully", "invite": invite})
}

type UpdateStaffRequest struct {
	RoleID uint `json:"role_id" binding:"required"`
}

func handleUpdateShopStaff(c *gin.Context) {
	shopID := c.Param("id")
	staffID := c.Param("staff_id")

	var req UpdateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify role belongs to shop
	var role ShopRole
	if err := db.Where("id = ? AND shop_id = ?", req.RoleID, shopID).First(&role).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	var staff ShopStaff
	if err := db.Where("id = ? AND shop_id = ?", staffID, shopID).First(&staff).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}

	staff.RoleID = req.RoleID
	if err := db.Save(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update staff"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"staff": staff})
}

func handleDeleteShopStaff(c *gin.Context) {
	shopID := c.Param("id")
	staffID := c.Param("staff_id")

	if err := db.Where("id = ? AND shop_id = ?", staffID, shopID).Delete(&ShopStaff{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete staff"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Staff removed successfully"})
}

func handleGetUserInvites(c *gin.Context) {
	userInterface, _ := c.Get("user")
	user := userInterface.(User)

	var invites []ShopInvite
	if err := db.Where("email = ? AND status = ?", user.Email, "pending").Find(&invites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invites"})
		return
	}

	type InviteWithShop struct {
		ShopInvite
		ShopName string `json:"shop_name"`
	}
	var res []InviteWithShop
	for _, inv := range invites {
		var shop Shop
		db.Where("id = ?", inv.ShopID).First(&shop)
		res = append(res, InviteWithShop{
			ShopInvite: inv,
			ShopName:   shop.Name,
		})
	}
	c.JSON(http.StatusOK, gin.H{"invites": res})
}

func handleAcceptInvite(c *gin.Context) {
	inviteID := c.Param("invite_id")
	userInterface, _ := c.Get("user")
	user := userInterface.(User)

	var invite ShopInvite
	if err := db.Where("id = ? AND email = ? AND status = ?", inviteID, user.Email, "pending").First(&invite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already processed"})
		return
	}

	staff := ShopStaff{
		ShopID: invite.ShopID,
		UserID: user.ID,
		RoleID: invite.RoleID,
	}
	if err := db.Create(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join shop"})
		return
	}

	invite.Status = "accepted"
	db.Save(&invite)

	c.JSON(http.StatusOK, gin.H{"message": "Invite accepted"})
}

func handleRejectInvite(c *gin.Context) {
	inviteID := c.Param("invite_id")
	userInterface, _ := c.Get("user")
	user := userInterface.(User)

	var invite ShopInvite
	if err := db.Where("id = ? AND email = ? AND status = ?", inviteID, user.Email, "pending").First(&invite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already processed"})
		return
	}

	invite.Status = "rejected"
	db.Save(&invite)

	c.JSON(http.StatusOK, gin.H{"message": "Invite rejected"})
}
