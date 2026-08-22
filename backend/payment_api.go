package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type PaymentConfigPayload struct {
	ProviderName string                 `json:"provider_name"`
	IsActive     bool                   `json:"is_active"`
	AuthKeys     map[string]interface{} `json:"auth_keys"` // Will be JSON serialized to AuthConfig
}

func handleGetPaymentConfigs(c *gin.Context) {
	tenantDB, _ := getTenantDB(c, c.Param("id"))
	if tenantDB == nil { return }

	var configs []TenantPaymentConfig
	tenantDB.Find(&configs)

	var response []PaymentConfigPayload
	for _, conf := range configs {
		var keys map[string]interface{}
		
		if decrypted, err := DecryptAES([]byte(AppConfig.EncryptionMasterKey), conf.AuthConfig); err == nil {
			json.Unmarshal([]byte(decrypted), &keys)
		} else {
			json.Unmarshal([]byte(conf.AuthConfig), &keys)
		}
		
		for k, v := range keys {
			if strings.Contains(k, "secret") || strings.Contains(k, "key") {
				if valStr, ok := v.(string); ok && valStr != "" && k != "key_id" && k != "public_key" {
					if len(valStr) > 4 {
						keys[k] = "sk_live_••••" + valStr[len(valStr)-4:]
					} else {
						keys[k] = "sk_live_••••"
					}
				}
			}
		}

		response = append(response, PaymentConfigPayload{
			ProviderName: conf.ProviderName,
			IsActive:     conf.IsActive,
			AuthKeys:     keys,
		})
	}

	c.JSON(http.StatusOK, response)
}

func handleUpdatePaymentConfig(c *gin.Context) {
	tenantDB, _ := getTenantDB(c, c.Param("id"))
	if tenantDB == nil { return }
	provider := c.Param("provider")

	var payload PaymentConfigPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	var existingConf TenantPaymentConfig
	existingKeys := make(map[string]interface{})
	if err := tenantDB.Where("provider_name = ?", provider).First(&existingConf).Error; err == nil {
		if decrypted, err := DecryptAES([]byte(AppConfig.EncryptionMasterKey), existingConf.AuthConfig); err == nil {
			json.Unmarshal([]byte(decrypted), &existingKeys)
		} else {
			json.Unmarshal([]byte(existingConf.AuthConfig), &existingKeys)
		}
	}

	for k, v := range payload.AuthKeys {
		if valStr, ok := v.(string); ok && strings.HasPrefix(valStr, "sk_live_••••") {
			payload.AuthKeys[k] = existingKeys[k]
		}
	}

	authBytes, _ := json.Marshal(payload.AuthKeys)
	encryptedAuth, err := EncryptAES([]byte(AppConfig.EncryptionMasterKey), string(authBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption error"})
		return
	}
	
	var conf TenantPaymentConfig
	if err := tenantDB.Where("provider_name = ?", provider).First(&conf).Error; err != nil {
		conf = TenantPaymentConfig{
			ProviderName: provider,
			IsActive:     payload.IsActive,
			AuthConfig:   encryptedAuth,
		}
		tenantDB.Create(&conf)
	} else {
		conf.IsActive = payload.IsActive
		conf.AuthConfig = encryptedAuth
		tenantDB.Save(&conf)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment provider updated successfully"})
}
