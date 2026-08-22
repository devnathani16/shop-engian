package graph

import (
	"context"
	"eaas-backend/graph/model"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	GetProductsFunc func(ctx context.Context, shopID string) ([]*model.Product, error)
	GetOrdersFunc   func(ctx context.Context, shopID string) ([]*model.Order, error)
}
