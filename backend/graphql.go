package main

import (
	"context"
	"fmt"
	"strconv"

	"eaas-backend/graph"
	"eaas-backend/graph/model"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
)

// graphqlHandler defines the GQL handler and injects dependencies
func graphqlHandler() gin.HandlerFunc {
	// Setup resolver with DI
	res := &graph.Resolver{
		GetProductsFunc: func(ctx context.Context, shopID string) ([]*model.Product, error) {
			// Find shop in core DB
			var shop Shop
			if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
				return nil, fmt.Errorf("shop not found")
			}

			// Get tenant DB
			tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
			if err != nil {
				return nil, fmt.Errorf("failed to connect to tenant db")
			}

			// Fetch products with variants
			var dbProducts []Product
			tenantDB.Preload("Variants").Find(&dbProducts)

			// Map to GQL models
			var gqlProducts []*model.Product
			for _, p := range dbProducts {
				var variants []*model.ProductVariant
				for _, v := range p.Variants {
					vid := strconv.Itoa(int(v.ID))
					variants = append(variants, &model.ProductVariant{
						ID:                vid,
						ProductID:         int(v.ProductID),
						Title:             v.Title,
						Sku:               &v.SKU,
						Price:             v.Price,
						InventoryQuantity: v.StockQuantity,
					})
				}

				pid := strconv.Itoa(int(p.ID))
				gqlProducts = append(gqlProducts, &model.Product{
					ID:                pid,
					Title:             p.Title,
					Description:       &p.Description,
					Sku:               nil,
					Price:             p.Price,
					CompareAtPrice:    &p.CompareAtPrice,
					InventoryQuantity: p.StockQuantity,
					Status:            "Active",
					IsActive:          true,
					Variants:          variants,
				})
			}
			return gqlProducts, nil
		},
		GetOrdersFunc: func(ctx context.Context, shopID string) ([]*model.Order, error) {
			var shop Shop
			if err := db.Where("id = ?", shopID).First(&shop).Error; err != nil {
				return nil, fmt.Errorf("shop not found")
			}

			tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
			if err != nil {
				return nil, fmt.Errorf("failed to connect to tenant db")
			}

			var dbOrders []Order
			tenantDB.Preload("Items").Order("created_at desc").Find(&dbOrders)

			var gqlOrders []*model.Order
			for _, o := range dbOrders {
				var items []*model.OrderItem
				for _, i := range o.Items {
					iid := strconv.Itoa(int(i.ID))
					items = append(items, &model.OrderItem{
						ID:       iid,
						OrderID:  int(i.OrderID),
						Title:    i.Title,
						Quantity: i.Quantity,
						Price:    i.Price,
					})
				}
				oid := strconv.Itoa(int(o.ID))
				ctime := o.CreatedAt.Format("2006-01-02 15:04:05")
				gqlOrders = append(gqlOrders, &model.Order{
					ID:            oid,
					CustomerEmail: &o.CustomerEmail,
					TotalAmount:   o.TotalAmount,
					Status:        o.Status,
					PaymentMethod: &o.PaymentMethod,
					CreatedAt:     ctime,
					Items:         items,
				})
			}
			return gqlOrders, nil
		},
	}

	h := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{Resolvers: res}))

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// playgroundHandler defines a handler to expose the Playground
func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL Playground", "/api/graphql")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
