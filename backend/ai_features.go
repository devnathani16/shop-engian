package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/imagekit-developer/imagekit-go/v2"
)

type GenerateDescriptionReq struct {
	Title    string `json:"title" binding:"required"`
	Keywords string `json:"keywords"`
}

func handleGenerateDescription(c *gin.Context) {
	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	shopID := shop.ID
	_ = shopID

	var req GenerateDescriptionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Make request to AIML service
	aimlURL := "http://127.0.0.1:8000/generate-description"
	
	payload, _ := json.Marshal(req)
	resp, err := http.Post(aimlURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("Failed to call AIML service: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service unavailable"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("AIML service returned error code: %d", resp.StatusCode)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI generation failed"})
		return
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse AI response"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func handleRemoveBackground(c *gin.Context) {
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

	// Prepare multipart form for AIML service
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare AI request"})
		return
	}
	io.Copy(part, file)
	writer.Close()

	// Call AIML service
	aimlURL := "http://127.0.0.1:8000/remove-background"
	req, err := http.NewRequest("POST", aimlURL, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create AI request"})
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to call AIML service: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service unavailable"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("AIML service returned error code: %d", resp.StatusCode)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI background removal failed"})
		return
	}

	// Read processed image bytes
	processedBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read processed image"})
		return
	}

	// Upload processed image to ImageKit
	folderPath := "/eaas-media/" + shop.ID
	newFileName := "nobg_" + fileHeader.Filename

	// We'll pass the bytes to ImageKit wrapped in a Reader
	ikResp, err := ik.Files.Upload(c.Request.Context(), imagekit.FileUploadParams{
		File:              bytes.NewReader(processedBytes),
		FileName:          newFileName,
		Folder:            imagekit.String(folderPath),
		UseUniqueFileName: imagekit.Bool(true),
	})

	if err != nil {
		log.Printf("ImageKit upload error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload processed file to CDN"})
		return
	}

	media := Media{
		FileName: newFileName,
		URL:      ikResp.URL,
		FileID:   ikResp.FileID,
	}

	if err := tenantDB.Create(&media).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save media record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"media": media})
}

// GenerateProductEmbedding calls the AIML service to generate and save an embedding for a product
func GenerateProductEmbedding(tenantDBName string, shopID string, productID uint, title, description string) {
	tenantDB, err := GlobalTenantManager.GetConnection(tenantDBName)
	if err != nil {
		log.Printf("[AIML] Failed to connect to tenant DB %s for embedding generation: %v", tenantDBName, err)
		return
	}

	text := title + " " + description
	reqBody, _ := json.Marshal(map[string]string{"text": text})

	resp, err := http.Post("http://127.0.0.1:8000/generate-embedding", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		log.Printf("[AIML] Failed to generate embedding for product %d: %v", productID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var result struct {
			Embedding []float64 `json:"embedding"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			embeddingJSON, _ := json.Marshal(result.Embedding)
			now := time.Now()
			tenantDB.Model(&Product{}).Where("id = ?", productID).Updates(map[string]interface{}{
				"embedding_json": string(embeddingJSON),
				"embedding_updated_at": now,
			})
			
			// Push to AIML memory immediately
			UpdateSingleProductEmbeddingInAI(shopID, productID, result.Embedding)
			
			log.Printf("[AIML] Successfully saved embedding for product %d", productID)
		}
	}
}

// CosineSimilarity calculates the cosine similarity between two vectors
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0.0
	}
	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0.0
	}
	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

func handleGetRecommendations(c *gin.Context) {
	subdomain := c.Param("subdomain")
	productID := c.Param("product_id")

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to tenant db"})
		return
	}

	var targetProduct Product
	if err := tenantDB.First(&targetProduct, productID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Target product not found"})
		return
	}

	if targetProduct.EmbeddingJSON == "" {
		c.JSON(http.StatusOK, []Product{}) // No embedding to compare
		return
	}

	var targetEmbedding []float64
	if err := json.Unmarshal([]byte(targetProduct.EmbeddingJSON), &targetEmbedding); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse target embedding"})
		return
	}

	var allProducts []Product
	tenantDB.Where("id != ? AND embedding_json IS NOT NULL AND embedding_json != ''", productID).Find(&allProducts)

	type scoredProduct struct {
		Product Product
		Score   float64
	}

	var scoredProducts []scoredProduct
	for _, p := range allProducts {
		var pEmb []float64
		if err := json.Unmarshal([]byte(p.EmbeddingJSON), &pEmb); err == nil {
			score := CosineSimilarity(targetEmbedding, pEmb)
			scoredProducts = append(scoredProducts, scoredProduct{Product: p, Score: score})
		}
	}

	sort.Slice(scoredProducts, func(i, j int) bool {
		return scoredProducts[i].Score > scoredProducts[j].Score
	})

	limit := 4
	if len(scoredProducts) < limit {
		limit = len(scoredProducts)
	}

	var recommendedProducts []Product
	for i := 0; i < limit; i++ {
		recommendedProducts = append(recommendedProducts, scoredProducts[i].Product)
	}

	c.JSON(http.StatusOK, recommendedProducts)
}
