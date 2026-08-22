package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AIThemeRequest struct {
	Prompt string `json:"prompt"`
}

func handleGenerateTheme(c *gin.Context) {

	var req AIThemeRequest
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

	// Proxy to Python AIML microservice
	aimlURL := "http://127.0.0.1:8000/generate-theme"
	payloadBytes, _ := json.Marshal(map[string]string{"prompt": req.Prompt})
	
	resp, err := http.Post(aimlURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to AI engine"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI engine returned an error"})
		return
	}

	bodyBytes, _ := io.ReadAll(resp.Body)

	// Save generated JSON to database
	var theme ThemeSetting
	if err := tenantDB.First(&theme).Error; err != nil {
		theme = ThemeSetting{Config: string(bodyBytes)}
		tenantDB.Create(&theme)
	} else {
		theme.Config = string(bodyBytes)
		tenantDB.Save(&theme)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Theme generated successfully", "config": json.RawMessage(theme.Config)})
}
