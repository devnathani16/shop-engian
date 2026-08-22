package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type AnalyticsResponse struct {
	TotalRevenue   float64          `json:"total_revenue"`
	TotalOrders    int64            `json:"total_orders"`
	TotalProducts  int64            `json:"total_products"`
	TotalCustomers int64            `json:"total_customers"`
	SalesChart     []SalesDataPoint `json:"sales_chart"`
	TopProducts    []TopProduct     `json:"top_products"`
	Currency       string           `json:"currency"`
	Subdomain      string           `json:"subdomain"`
}

type SalesDataPoint struct {
	Date  string  `json:"date"`
	Sales float64 `json:"sales"`
}

type TopProduct struct {
	Title    string  `json:"title"`
	Quantity int     `json:"quantity"`
	Revenue  float64 `json:"revenue"`
}

func handleGetShopAnalytics(c *gin.Context) {
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

	var res AnalyticsResponse
	res.Currency = shop.Currency
	res.Subdomain = shop.Subdomain

	// Total Revenue & Orders (exclude Cancelled)
	tenantDB.Model(&Order{}).Where("status != ?", "Cancelled").Select("COALESCE(SUM(total_amount), 0)").Scan(&res.TotalRevenue)
	tenantDB.Model(&Order{}).Where("status != ?", "Cancelled").Count(&res.TotalOrders)

	// Total Products
	tenantDB.Model(&Product{}).Count(&res.TotalProducts)

	// Total Customers (registered customers)
	tenantDB.Model(&Customer{}).Count(&res.TotalCustomers)

	// Last 30 days sales chart
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	type dailySale struct {
		SaleDate string
		Total    float64
	}
	var dailySales []dailySale
	// Using MySQL DATE function
	tenantDB.Model(&Order{}).
		Select("DATE(created_at) as sale_date, COALESCE(SUM(total_amount), 0) as total").
		Where("status != ? AND created_at >= ?", "Cancelled", thirtyDaysAgo).
		Group("DATE(created_at)").
		Order("sale_date asc").
		Scan(&dailySales)

	// Fill in missing days with 0
	salesMap := make(map[string]float64)
	for _, ds := range dailySales {
		salesMap[ds.SaleDate] = ds.Total
	}

	for i := 29; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		res.SalesChart = append(res.SalesChart, SalesDataPoint{
			Date:  d,
			Sales: salesMap[d],
		})
	}

	// Top Products
	tenantDB.Model(&OrderItem{}).
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.status != ?", "Cancelled").
		Select("order_items.title, SUM(order_items.quantity) as quantity, SUM(order_items.price * order_items.quantity) as revenue").
		Group("order_items.title").
		Order("quantity desc").
		Limit(5).
		Scan(&res.TopProducts)

	c.JSON(http.StatusOK, res)
}

func handleGetAbandonedCarts(c *gin.Context) {
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

	var carts []AbandonedCart
	// Only fetch carts that are truly abandoned
	if err := tenantDB.Where("status = ?", "Abandoned").Order("updated_at desc").Find(&carts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch abandoned carts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"carts": carts})
}
