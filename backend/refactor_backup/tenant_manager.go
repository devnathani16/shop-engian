package main

import (
	"fmt"
	"sync"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type TenantManager struct {
	mu    sync.RWMutex
	conns map[string]*gorm.DB
}

var GlobalTenantManager *TenantManager

func InitTenantManager() {
	GlobalTenantManager = &TenantManager{
		conns: make(map[string]*gorm.DB),
	}
}

// GetConnection returns a cached database connection for the given dbName, or initializes a new one.
// It uses double-checked locking to ensure only one connection is created per tenant.
func (tm *TenantManager) GetConnection(dbName string) (*gorm.DB, error) {
	// 1. Read lock: check if connection already exists
	tm.mu.RLock()
	if tDB, ok := tm.conns[dbName]; ok {
		tm.mu.RUnlock()
		return tDB, nil
	}
	tm.mu.RUnlock()

	// 2. Write lock: double check and initialize
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tDB, ok := tm.conns[dbName]; ok {
		return tDB, nil
	}

	tenantDSN := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		AppConfig.DBUser,
		AppConfig.DBPass,
		AppConfig.DBHost,
		dbName,
	)

	tDB, err := gorm.Open(mysql.Open(tenantDSN), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to tenant database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := tDB.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(5)                  // Cap maximum connections per tenant
		sqlDB.SetMaxIdleConns(2)                  // Keep some connections idle
		sqlDB.SetConnMaxLifetime(30 * time.Minute) // Recycle connections
	}

	// AutoMigrate is only run ONCE per tenant when the connection is initialized
	if err := tDB.AutoMigrate(&Category{}, &Product{}, &ProductOption{}, &ProductVariant{}, &Order{}, &ShopAuthSetting{}, &Media{}, &Customer{}, &ShippingRule{}, &OrderItem{}, &ShippingZone{}, &ShippingZoneCountry{}, &ShippingZoneRegion{}, &ShippingZoneRate{}, &ShippingProvider{}, &ShippingZoneProvider{}, &TenantPaymentConfig{}, &DiscountCode{}, &AbandonedCart{}, &ThemeSetting{}, &TaxCategory{}, &TaxZone{}, &TaxZoneCountry{}, &TaxZoneRegion{}, &TaxRate{}, &ShopTaxOverride{}, &InventoryInsight{}); err != nil {
		return nil, fmt.Errorf("failed to auto migrate tenant database: %w", err)
	}

	// Drop deprecated columns that cause constraint errors
	if tDB.Migrator().HasColumn(&ProductVariant{}, "name") {
		tDB.Migrator().DropColumn(&ProductVariant{}, "name")
	}
	if tDB.Migrator().HasColumn(&ProductVariant{}, "type") {
		tDB.Migrator().DropColumn(&ProductVariant{}, "type")
	}

	tm.conns[dbName] = tDB
	return tDB, nil
}
