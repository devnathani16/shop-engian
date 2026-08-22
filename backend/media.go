package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/imagekit-developer/imagekit-go/v2"
)

var ik imagekit.Client

func initImageKit() {
	// Automatically uses IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_URL_ENDPOINT from environment
	ik = imagekit.NewClient()
}

func handleGetMedia(c *gin.Context) {
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	var media []Media
	if err := tenantDB.Order("created_at desc").Find(&media).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch media"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"media": media})
}

func handleGetMediaAuth(c *gin.Context) {
	_, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	token := fmt.Sprintf("%x", rand.Int63())
	expire := time.Now().Add(30 * time.Minute).Unix()

	mac := hmac.New(sha1.New, []byte(os.Getenv("IMAGEKIT_PRIVATE_KEY")))
	mac.Write([]byte(token + fmt.Sprintf("%d", expire)))
	signature := hex.EncodeToString(mac.Sum(nil))

	c.JSON(http.StatusOK, gin.H{
		"token":       token,
		"expire":      expire,
		"signature":   signature,
		"publicKey":   os.Getenv("IMAGEKIT_PUBLIC_KEY"),
		"urlEndpoint": os.Getenv("IMAGEKIT_URL_ENDPOINT"),
	})
}

func handleRecordMedia(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant database"})
		return
	}

	var req struct {
		FileName string `json:"file_name" binding:"required"`
		URL      string `json:"url" binding:"required"`
		FileID   string `json:"file_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	media := Media{
		FileName: req.FileName,
		URL:      req.URL,
		FileID:   req.FileID,
	}

	if err := tenantDB.Create(&media).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save media record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"media": media})
}

func handleUploadMedia(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant database"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read uploaded file"})
		return
	}
	defer file.Close()

	folderPath := "/eaas-media/" + shop.ID

	resp, err := ik.Files.Upload(c.Request.Context(), imagekit.FileUploadParams{
		File:              file,
		FileName:          fileHeader.Filename,
		Folder:            imagekit.String(folderPath),
		UseUniqueFileName: imagekit.Bool(true),
	})

	if err != nil {
		log.Printf("ImageKit upload error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file to CDN"})
		return
	}

	media := Media{
		FileName: fileHeader.Filename,
		URL:      resp.URL,
		FileID:   resp.FileID,
	}

	if err := tenantDB.Create(&media).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save media record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"media": media})
}

func handleDeleteMedia(c *gin.Context) {
	mediaID := c.Param("media_id")

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant database"})
		return
	}

	var media Media
	if err := tenantDB.First(&media, mediaID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
		return
	}

	// Delete from ImageKit
	err = ik.Files.Delete(c.Request.Context(), media.FileID)
	if err != nil {
		log.Printf("Failed to delete from ImageKit: %v", err)
	}

	if err := tenantDB.Delete(&media).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete media record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Media deleted successfully"})
}
