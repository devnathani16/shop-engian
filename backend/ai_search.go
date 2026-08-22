package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"eaas-backend/pb"
)

var (
	aimlClient pb.SemanticSearchServiceClient
)

func initAIMLClient() {
	// Connect to Python gRPC server
	conn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("[AIML] Failed to connect to ML service: %v", err)
		return
	}
	aimlClient = pb.NewSemanticSearchServiceClient(conn)
	log.Println("[AIML] Connected to Semantic Search Service on localhost:50051")
}

func CallSemanticSearch(shopID, query string, topK int) ([]uint32, error) {
	if aimlClient == nil {
		return nil, fmt.Errorf("AI search service not connected") // Trigger fallback to SQL
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req := &pb.SearchRequest{
		ShopId: shopID,
		Query:  query,
		TopK:   int32(topK),
	}

	res, err := aimlClient.Search(ctx, req)
	if err != nil {
		log.Printf("[AIML] Search failed: %v", err)
		return nil, err
	}

	var productIDs []uint32
	for _, r := range res.Results {
		productIDs = append(productIDs, r.ProductId)
	}

	return productIDs, nil
}

func SyncShopEmbeddings(shopID string) {
	var shop Shop
	if err := db.First(&shop, "id = ?", shopID).Error; err != nil {
		return
	}

	if !shop.EnableAISearch {
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		return
	}

	var products []Product
	if err := tenantDB.Find(&products).Error; err != nil {
		return
	}

	// Prepare batch of valid, up-to-date embeddings to load instantly
	type ProductItem struct {
		ID        uint      `json:"id"`
		Embedding []float64 `json:"embedding"`
	}
	var validItems []ProductItem

	for i := range products {
		p := &products[i]
		
		needsUpdate := false
		if p.EmbeddingUpdatedAt == nil {
			needsUpdate = true
		} else if p.UpdatedAt.After(*p.EmbeddingUpdatedAt) {
			needsUpdate = true
		} else if p.EmbeddingJSON == "" || p.EmbeddingJSON == "[]" {
			needsUpdate = true
		}

		if needsUpdate {
			// Generate new embedding
			text := p.Title + " " + p.Description
			reqBody, _ := json.Marshal(map[string]string{"text": text})
			resp, err := http.Post("http://127.0.0.1:8000/generate-embedding", "application/json", bytes.NewBuffer(reqBody))
			if err == nil {
				defer resp.Body.Close()
				var resData struct {
					Embedding []float64 `json:"embedding"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&resData); err == nil && len(resData.Embedding) > 0 {
					embJSON, _ := json.Marshal(resData.Embedding)
					now := time.Now()
					
					// Save to DB
					tenantDB.Model(p).Updates(map[string]interface{}{
						"embedding_json": string(embJSON),
						"embedding_updated_at": now,
					})
					
					validItems = append(validItems, ProductItem{
						ID: p.ID,
						Embedding: resData.Embedding,
					})
				}
			}
		} else {
			// Parse existing valid embedding
			var emb []float64
			if err := json.Unmarshal([]byte(p.EmbeddingJSON), &emb); err == nil && len(emb) > 0 {
				validItems = append(validItems, ProductItem{
					ID: p.ID,
					Embedding: emb,
				})
			}
		}
	}

	// Batch load all valid items to Python AIML memory
	loadReq, _ := json.Marshal(map[string]interface{}{
		"shop_id": shopID,
		"products": validItems,
	})
	http.Post("http://127.0.0.1:8000/load-embeddings", "application/json", bytes.NewBuffer(loadReq))
}

func UpdateSingleProductEmbeddingInAI(shopID string, productID uint, embedding []float64) {
	reqBody, _ := json.Marshal(map[string]interface{}{
		"shop_id": shopID,
		"product_id": productID,
		"embedding": embedding,
	})
	http.Post("http://127.0.0.1:8000/update-embedding", "application/json", bytes.NewBuffer(reqBody))
}

func IndexExistingProducts() {
	var shops []Shop
	if err := db.Find(&shops).Error; err != nil {
		return
	}

	for _, shop := range shops {
		if shop.EnableAISearch {
			go SyncShopEmbeddings(shop.ID)
		}
	}
}
