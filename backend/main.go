package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var db *gorm.DB
var resendClient *resend.Client

func initDB() {
	dsn := fmt.Sprintf("%s:%s@tcp(%s)/eaas_core?charset=utf8mb4&parseTime=True&loc=Local",
		AppConfig.DBUser,
		AppConfig.DBPass,
		AppConfig.DBHost,
	)
	var err error
	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migrate
	err = db.AutoMigrate(&User{}, &OTP{}, &Shop{}, &ShopRole{}, &ShopStaff{}, &ShopInvite{}, &RegisteredDomain{})
	if err != nil {
		log.Fatalf("Failed to auto migrate database: %v", err)
	}
	fmt.Println("Database connection and migration successful.")
}

func initResend() {
	resendClient = resend.NewClient(AppConfig.ResendAPIKey)
}

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("jwt")
		if err != nil || tokenString == "" {
			// Fallback to Authorization header
			tokenString = c.GetHeader("Authorization")
			if tokenString == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
				c.Abort()
				return
			}
			// Remove "Bearer " prefix if present
			if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
				tokenString = tokenString[7:]
			}
		}

		secret := AppConfig.JWTSecret

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		email, ok := claims["email"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token email"})
			c.Abort()
			return
		}

		var user User
		if err := db.Where("email = ?", email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

func main() {
	LoadConfig()
	InitOpenprovider()
	InitTenantManager()

	initDB()
	initAIMLClient()
	InitSSEBroker()
	IndexExistingProducts()
	
	// migrateExistingTenants() // Disabled to fix startup error
	initResend()
	initImageKit()

	r := gin.Default()
	r.Use(CORSMiddleware())

	auth := r.Group("/api/auth")
	{
		auth.POST("/signup", handleSignup)
		auth.POST("/verify", handleVerify)
		auth.POST("/login", handleLogin)
		auth.GET("/me", AuthMiddleware(), handleMe)
	}

	api := r.Group("/api")
	api.Use(AuthMiddleware())
	{
		api.POST("/shops", handleCreateShop)
				api.GET("/shops", handleGetShops)
		
		// User Invites
		api.GET("/user/invites", handleGetUserInvites)
		api.POST("/user/invites/:invite_id/accept", handleAcceptInvite)
		api.POST("/user/invites/:invite_id/reject", handleRejectInvite)
		api.GET("/shops/:id/events", RequireShopPermission("*"), handleShopEvents)
		api.PUT("/shops/:id", RequireShopPermission("*"), handleUpdateShop)
		api.DELETE("/shops/:id", RequireShopPermission("*"), handleDeleteShop)

		// RBAC Routes
		api.GET("/shops/:id/roles", RequireShopPermission("*"), handleGetShopRoles)
		api.POST("/shops/:id/roles", RequireShopPermission("*"), handleCreateShopRole)
		api.PUT("/shops/:id/roles/:role_id", RequireShopPermission("*"), handleUpdateShopRole)
		api.DELETE("/shops/:id/roles/:role_id", RequireShopPermission("*"), handleDeleteShopRole)

		api.GET("/shops/:id/staff", RequireShopPermission("*"), handleGetShopStaff)
		api.POST("/shops/:id/staff", RequireShopPermission("*"), handleCreateShopStaff)
		api.PUT("/shops/:id/staff/:staff_id", RequireShopPermission("*"), handleUpdateShopStaff)
		api.DELETE("/shops/:id/staff/:staff_id", RequireShopPermission("*"), handleDeleteShopStaff)

		api.GET("/shops/:id/auth-settings", RequireShopPermission("*"), handleGetShopAuthSettings)
		api.POST("/shops/:id/auth-settings", RequireShopPermission("*"), handleUpdateShopAuthSettings)
		
		api.GET("/shops/:id/media", RequireShopPermission("*"), handleGetMedia)
		api.GET("/shops/:id/media/auth", RequireShopPermission("*"), handleGetMediaAuth)
		api.POST("/shops/:id/media/record", RequireShopPermission("*"), handleRecordMedia)
		api.POST("/shops/:id/media", RequireShopPermission("*"), handleUploadMedia)
		api.DELETE("/shops/:id/media/:media_id", RequireShopPermission("*"), handleDeleteMedia)

		api.GET("/shops/:id/categories", RequireShopPermission("*"), handleGetCategories)
		api.POST("/shops/:id/categories", RequireShopPermission("*"), handleCreateCategory)
		api.PUT("/shops/:id/categories/:category_id", RequireShopPermission("*"), handleUpdateCategory)
		api.DELETE("/shops/:id/categories/:category_id", RequireShopPermission("*"), handleDeleteCategory)

		api.GET("/shops/:id/shipping-rules", RequireShopPermission("*"), handleGetShippingRules)
		api.POST("/shops/:id/shipping-rules", RequireShopPermission("*"), handleCreateShippingRule)
		api.DELETE("/shops/:id/shipping-rules/:rule_id", RequireShopPermission("*"), handleDeleteShippingRule)
		api.POST("/shops/:id/shipping/simulate", RequireShopPermission("*"), handleSimulateShipping)
		
		api.GET("/shops/:id/shipping-providers", RequireShopPermission("*"), handleGetShippingProviders)
		api.POST("/shops/:id/shipping-providers", RequireShopPermission("*"), handleCreateShippingProvider)
		api.PUT("/shops/:id/shipping-providers/:provider_id", RequireShopPermission("*"), handleUpdateShippingProvider)

		api.GET("/shops/:id/shipping-zones", RequireShopPermission("*"), handleGetShippingZones)
		api.POST("/shops/:id/shipping-zones", RequireShopPermission("*"), handleCreateShippingZone)
		api.DELETE("/shops/:id/shipping-zones/:zone_id", RequireShopPermission("*"), handleDeleteShippingZone)
		api.POST("/shops/:id/shipping-zones/:zone_id/providers", RequireShopPermission("*"), handleAddZoneProvider)
		api.DELETE("/shops/:id/shipping-zones/:zone_id/providers/:provider_id", RequireShopPermission("*"), handleRemoveZoneProvider)
		api.POST("/shops/:id/shipping-zones/:zone_id/rates", RequireShopPermission("*"), handleCreateZoneRate)
		api.DELETE("/shops/:id/shipping-zones/:zone_id/rates/:rate_id", RequireShopPermission("*"), handleDeleteZoneRate)

		// Tax System Routes
		api.GET("/shops/:id/tax-categories", RequireShopPermission("*"), handleGetTaxCategories)
		api.POST("/shops/:id/tax-categories", RequireShopPermission("*"), handleCreateTaxCategory)
		api.DELETE("/shops/:id/tax-categories/:cat_id", RequireShopPermission("*"), handleDeleteTaxCategory)
		api.GET("/shops/:id/tax-zones", RequireShopPermission("*"), handleGetTaxZones)
		api.POST("/shops/:id/tax-zones", RequireShopPermission("*"), handleCreateTaxZone)
		api.PUT("/shops/:id/tax-zones/:zone_id", RequireShopPermission("*"), handleUpdateTaxZone)
		api.DELETE("/shops/:id/tax-zones/:zone_id", RequireShopPermission("*"), handleDeleteTaxZone)
		api.POST("/shops/:id/tax-zones/:zone_id/countries", RequireShopPermission("*"), handleAddTaxZoneCountry)
		api.DELETE("/shops/:id/tax-zones/:zone_id/countries/:country_id", RequireShopPermission("*"), handleRemoveTaxZoneCountry)
		api.POST("/shops/:id/tax-zones/:zone_id/regions", RequireShopPermission("*"), handleAddTaxZoneRegion)
		api.DELETE("/shops/:id/tax-zones/:zone_id/regions/:region_id", RequireShopPermission("*"), handleRemoveTaxZoneRegion)
		api.POST("/shops/:id/tax-zones/:zone_id/tax-rates", RequireShopPermission("*"), handleCreateTaxRate)
		api.PUT("/shops/:id/tax-zones/:zone_id/tax-rates/:rate_id", RequireShopPermission("*"), handleUpdateTaxRate)
		api.DELETE("/shops/:id/tax-zones/:zone_id/tax-rates/:rate_id", RequireShopPermission("*"), handleDeleteTaxRate)
		api.GET("/shops/:id/tax-overrides", RequireShopPermission("*"), handleGetTaxOverrides)
		api.POST("/shops/:id/tax-overrides", RequireShopPermission("*"), handleCreateTaxOverride)
		api.DELETE("/shops/:id/tax-overrides/:override_id", RequireShopPermission("*"), handleDeleteTaxOverride)

		api.GET("/shops/:id/products", RequireShopPermission("*"), handleGetProducts)
		api.POST("/shops/:id/products", RequireShopPermission("*"), handleCreateProduct)
		api.PUT("/shops/:id/products/:product_id", RequireShopPermission("*"), handleUpdateProduct)
		api.DELETE("/shops/:id/products/:product_id", RequireShopPermission("*"), handleDeleteProduct)
		
		api.GET("/shops/:id/orders", RequireShopPermission("*"), handleGetOrders)
		api.POST("/shops/:id/orders/:order_id/cancel", RequireShopPermission("*"), handleCancelOrder)
		api.POST("/shops/:id/orders/:order_id/awb", RequireShopPermission("*"), handleGenerateOrderAWB)
		api.POST("/shops/:id/orders/:order_id/label", RequireShopPermission("*"), handleGenerateOrderLabel)
		api.POST("/shops/:id/orders/:order_id/invoice", RequireShopPermission("*"), handleGenerateOrderInvoice)
		api.GET("/shops/:id/payment-configs", RequireShopPermission("*"), handleGetPaymentConfigs)
		api.POST("/shops/:id/payment-configs/:provider", RequireShopPermission("*"), handleUpdatePaymentConfig)
		api.GET("/shops/:id/customers", RequireShopPermission("*"), handleGetCustomers)
		api.POST("/shops/:id/customers/:customer_id/request-erasure", RequireShopPermission("*"), handleAnonymizeCustomer)

		api.GET("/shops/:id/discounts", RequireShopPermission("*"), handleGetDiscounts)
		api.POST("/shops/:id/discounts", RequireShopPermission("*"), handleCreateDiscount)
		api.PUT("/shops/:id/discounts/:discount_id", RequireShopPermission("*"), handleUpdateDiscount)
		api.DELETE("/shops/:id/discounts/:discount_id", RequireShopPermission("*"), handleDeleteDiscount)

		api.GET("/shops/:id/analytics", RequireShopPermission("*"), handleGetShopAnalytics)
		api.GET("/shops/:id/abandoned-carts", RequireShopPermission("*"), handleGetAbandonedCarts)
		api.POST("/shops/:id/abandoned-carts/:cart_id/recover", RequireShopPermission("*"), handleRecoverAbandonedCart)
		
		shopRoutes := api.Group("/shops")
		shopRoutes.GET("/:id/theme", RequireShopPermission("*"), handleGetAdminTheme)
		shopRoutes.PUT("/:id/theme", RequireShopPermission("*"), handleUpdateAdminTheme)
		shopRoutes.POST("/:id/theme/generate", RequireShopPermission("*"), handleGenerateTheme)

		shopRoutes.POST("/:id/ai/generate-description", RequireShopPermission("*"), handleGenerateDescription)
		shopRoutes.POST("/:id/ai/process-image", RequireShopPermission("*"), handleRemoveBackground)
		
		
		// Global Domain Management Routes
		api.POST("/domains/search", handleDomainSearch)
		api.GET("/domains", handleGetUserDomains)
		api.POST("/domains/purchase/initiate", handlePurchaseDomainInitiate)
		api.POST("/domains/purchase/verify", handlePurchaseDomainVerify)
		api.GET("/domains/:domain/dns", handleGetDNSRecords)
		api.POST("/domains/:domain/dns", handleAddDNSRecord)

		api.POST("/graphql", graphqlHandler())
	}

	r.GET("/api/graphql/playground", playgroundHandler())

	// Storefront APIs (Domain based)
	r.GET("/api/storefront/:subdomain/auth-settings", handleGetStorefrontAuthSettings)
	r.GET("/api/storefront/:subdomain/auth/callback", handleStorefrontAuthCallback)
	r.GET("/api/storefront/:subdomain/catalog", handleGetStorefrontCatalog)
	r.GET("/api/storefront/:subdomain/theme", handleGetStorefrontTheme)
	r.GET("/api/storefront/:subdomain/checkout/config", handleGetCheckoutConfig)
	r.GET("/api/storefront/:subdomain/orders", handleGetStorefrontOrders)
	r.POST("/api/storefront/:subdomain/customers/sync", handleSyncCustomer)
	r.OPTIONS("/api/storefront/:subdomain/customers/sync", func(c *gin.Context) { c.Status(204) })
	r.POST("/api/storefront/:subdomain/checkout/rates", handleGetCheckoutRates)
	r.OPTIONS("/api/storefront/:subdomain/checkout/rates", func(c *gin.Context) { c.Status(204) })
	r.POST("/api/storefront/:subdomain/checkout/process", handleCheckoutProcess)
	r.OPTIONS("/api/storefront/:subdomain/checkout/process", func(c *gin.Context) { c.Status(204) })
	r.POST("/api/storefront/:subdomain/cart-sync", handleCartSync)
	r.OPTIONS("/api/storefront/:subdomain/cart-sync", func(c *gin.Context) { c.Status(204) })
	r.GET("/api/storefront/:subdomain/exchange-rates", handleGetExchangeRates)
	r.POST("/api/storefront/:subdomain/checkout/verify-payment", handleVerifyPayment)
	r.OPTIONS("/api/storefront/:subdomain/checkout/verify-payment", func(c *gin.Context) { c.Status(204) })
	r.GET("/api/storefront/:subdomain/products/:product_id/recommendations", handleGetRecommendations)
	r.POST("/api/storefront/:subdomain/orders/:order_id/invoice", handleStorefrontGenerateInvoice)
	r.OPTIONS("/api/storefront/:subdomain/orders/:order_id/invoice", func(c *gin.Context) { c.Status(204) })

	r.POST("/api/webhooks/payments/:subdomain/:provider", handlePaymentWebhook)

	fmt.Println("Server listening on :8080")
	r.Run(":8080")
}

func migrateExistingTenants() {
	var shops []Shop
	if err := db.Find(&shops).Error; err != nil {
		log.Printf("Failed to fetch existing shops for migration: %v", err)
		return
	}

	// Define struct for raw DB scan (since Shop struct no longer has these fields)
	type OldShopData struct {
		ID                       string
		DBName                   string
		UseShiprocket            bool   `gorm:"column:use_shiprocket"`
		ShiprocketEmail          string `gorm:"column:shiprocket_email"`
		ShiprocketPassword       string `gorm:"column:shiprocket_password"`
		ShiprocketPickupLocation string `gorm:"column:shiprocket_pickup_location"`
	}

	var oldShops []OldShopData
	if err := db.Raw("SELECT id, db_name, use_shiprocket, shiprocket_email, shiprocket_password, shiprocket_pickup_location FROM shops").Scan(&oldShops).Error; err != nil {
		log.Printf("Failed to fetch old shop data for migration: %v", err)
	}

	for _, shop := range oldShops {
		tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
		if err != nil {
			log.Printf("Failed to connect to tenant db %s for migration: %v", shop.DBName, err)
			continue
		}
		
		// The models are already auto-migrated by GetConnection, so we don't need to AutoMigrate here anymore.
		
		// Migrate old shiprocket config to new ShippingProvider
		if shop.UseShiprocket || shop.ShiprocketEmail != "" {
			var providerCount int64
			tenantDB.Model(&ShippingProvider{}).Where("provider_name = ?", "shiprocket").Count(&providerCount)
			if providerCount == 0 {
				authConfigStr := fmt.Sprintf(`{"email":"%s","password":"%s","pickup_location":"%s"}`,
					shop.ShiprocketEmail,
					shop.ShiprocketPassword,
					shop.ShiprocketPickupLocation,
				)
				provider := ShippingProvider{
					ShopID:       shop.ID,
					ProviderName: "shiprocket",
					AuthConfig:   authConfigStr,
					IsActive:     shop.UseShiprocket,
				}
				if err := tenantDB.Create(&provider).Error; err != nil {
					log.Printf("Failed to migrate shiprocket provider for %s: %v", shop.DBName, err)
				} else {
					log.Printf("Migrated shiprocket config to ShippingProvider for %s", shop.DBName)
				}
			}
		}
	}

	// Drop old columns from core DB now that migration is complete
	if db.Migrator().HasColumn(&Shop{}, "use_shiprocket") {
		db.Migrator().DropColumn(&Shop{}, "use_shiprocket")
		db.Migrator().DropColumn(&Shop{}, "shiprocket_email")
		db.Migrator().DropColumn(&Shop{}, "shiprocket_password")
		db.Migrator().DropColumn(&Shop{}, "shiprocket_pickup_location")
		log.Println("Dropped deprecated shiprocket columns from shops table")
	}

	fmt.Println("Completed tenant migrations.")
}

// Handlers

type SignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func handleSignup(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user already exists
	var existingUser User
	if err := db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create User
	user := User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
	}
	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate OTP
	otpCode, err := generateOTP()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate OTP"})
		return
	}

	// Save OTP
	otp := OTP{
		Email:     req.Email,
		Code:      otpCode,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := db.Create(&otp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save OTP"})
		return
	}

	// Send Email via Resend
	params := &resend.SendEmailRequest{
		From:    "onboarding@resend.dev",
		To:      []string{req.Email},
		Subject: "Verify your EaaS Admin Account",
		Html:    fmt.Sprintf("<strong>Your verification code is: %s</strong><br>It will expire in 10 minutes.", otpCode),
	}

	_, err = resendClient.Emails.Send(params)
	if err != nil {
		log.Printf("Failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Signup successful. Please verify your email."})
}

type VerifyRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

func handleVerify(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check OTP
	var otp OTP
	if err := db.Where("email = ? AND code = ? AND expires_at > ?", req.Email, req.Code, time.Now()).First(&otp).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	// Update User
	if err := db.Model(&User{}).Where("email = ?", req.Email).Update("is_verified", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user"})
		return
	}

	// Delete OTP so it can't be reused
	db.Delete(&otp)

	// Generate JWT
	tokenString, err := generateJWT(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set Cookie (HttpOnly=false so React can read it for Authorization headers)
	c.SetCookie("jwt", tokenString, 86400, "/", "localhost", false, false)

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func handleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !user.IsVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "Please verify your email first"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT
	tokenString, err := generateJWT(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set Cookie (HttpOnly=false so React can read it for Authorization headers)
	c.SetCookie("jwt", tokenString, 86400, "/", "localhost", false, false)

	c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
}

func handleMe(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userInterface.(User)
	c.JSON(http.StatusOK, gin.H{"user": gin.H{"email": user.Email}})
}

func generateJWT(email string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": email,
		"exp":   time.Now().Add(time.Hour * 24).Unix(),
	})

	// In a real app, use a secret from .env
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "supersecretkey" // Default for development
	}

	return token.SignedString([]byte(secret))
}

type CreateShopRequest struct {
	Name      string `json:"name" binding:"required"`
	Subdomain string `json:"subdomain" binding:"required"`
}

func handleCreateShop(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userInterface.(User)

	var req CreateShopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Check if subdomain is available globally
	var existingShop Shop
	if err := db.Where("subdomain = ?", req.Subdomain).First(&existingShop).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Subdomain is already taken"})
		return
	}

	// 2. Generate unique DB name
	b := make([]byte, 8)
	rand.Read(b)
	dbName := fmt.Sprintf("eaas_shop_%x", b)

	// 3. Execute RAW SQL to create the database on the MySQL server
	// We use db.Exec() which executes on the current connection (eaas_core)
	// Note: In a production environment, ensure the MySQL user has CREATE privileges.
	createDbSQL := fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;", dbName)
	if err := db.Exec(createDbSQL).Error; err != nil {
		log.Printf("Failed to create database %s: %v", dbName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provision shop database"})
		return
	}

	// 4. Connect dynamically to the new database
	tenantDSN := fmt.Sprintf("root:root@tcp(127.0.0.1:3306)/%s?charset=utf8mb4&parseTime=True&loc=Local", dbName)
	tenantDB, err := gorm.Open(mysql.Open(tenantDSN), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to newly created database %s: %v", dbName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize shop schema"})
		return
	}

	// 5. Run AutoMigrate for Tenant specific tables
	if err := tenantDB.AutoMigrate(
		&Category{}, &Product{}, &ProductOption{}, &ProductVariant{},
		&Order{}, &OrderItem{}, &ShopAuthSetting{}, &ShippingProvider{},
		&ShippingZoneProvider{},
		&TenantPaymentConfig{},
		&DiscountCode{},
		&AbandonedCart{},
		&ThemeSetting{},
	); err != nil {
		log.Printf("Failed to migrate tenant database %s: %v", dbName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to setup shop schema"})
		return
	}

	// 6. Save the Shop record in the Core DB linking it to the user
	shop := Shop{
		UserID:    user.ID,
		Name:      req.Name,
		Subdomain: req.Subdomain,
		DBName:    dbName,
	}

	if err := db.Create(&shop).Error; err != nil {
		log.Printf("Failed to save shop record in core db: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save shop details"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Shop provisioned successfully!",
		"shop":    shop,
	})
}

func handleGetShops(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userInterface.(User)

	var shops []Shop
	if err := db.Where("user_id = ?", user.ID).Find(&shops).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch shops"})
		return
	}

	var staffEntries []ShopStaff
	if err := db.Where("user_id = ?", user.ID).Find(&staffEntries).Error; err == nil {
		for _, staff := range staffEntries {
			var s Shop
			if err := db.Where("id = ?", staff.ShopID).First(&s).Error; err == nil {
				isDup := false
				for _, exist := range shops {
					if exist.ID == s.ID {
						isDup = true
						break
					}
				}
				if !isDup {
					shops = append(shops, s)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"shops": shops})
}

type UpdateShopRequest struct {
	Name               string  `json:"name"`
	Subdomain          string  `json:"subdomain"`
	LogoURL            string  `json:"logo_url"`
	Currency           string  `json:"currency"`
	OriginPincode       *string `json:"origin_pincode"`
	DefaultShippingRate *float64 `json:"default_shipping_rate"`
	DefaultShippingName *string  `json:"default_shipping_name"`
	EnableAIRecommendations *bool `json:"enable_ai_recommendations"`
	EnableAISearch          *bool `json:"enable_ai_search"`
}

func handleUpdateShop(c *gin.Context) {

	var req UpdateShopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	// Basic validation for subdomain changes (if it changed)
	if req.Subdomain != "" && req.Subdomain != shop.Subdomain {
		var existing Shop
		if err := db.Where("subdomain = ?", req.Subdomain).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Subdomain is already taken"})
			return
		}
		shop.Subdomain = req.Subdomain
	}

	if req.Name != "" {
		shop.Name = req.Name
	}
	shop.LogoURL = req.LogoURL
	if req.Currency != "" {
		shop.Currency = req.Currency
	}
	if req.OriginPincode != nil {
		shop.OriginPincode = *req.OriginPincode
	}
	if req.DefaultShippingRate != nil {
		shop.DefaultShippingRate = *req.DefaultShippingRate
	}
	if req.DefaultShippingName != nil {
		shop.DefaultShippingName = *req.DefaultShippingName
	}
	if req.EnableAIRecommendations != nil {
		shop.EnableAIRecommendations = *req.EnableAIRecommendations
	}
	wasAISearchEnabled := shop.EnableAISearch
	if req.EnableAISearch != nil {
		shop.EnableAISearch = *req.EnableAISearch
	}

	if err := db.Save(&shop).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update shop"})
		return
	}

	// If AI Search was just turned on, sync all missing/stale product embeddings in the background
	if !wasAISearchEnabled && shop.EnableAISearch {
		go SyncShopEmbeddings(shop.ID)
	}

	c.JSON(http.StatusOK, gin.H{"shop": shop})
}

func handleDeleteShop(c *gin.Context) {

	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	shopID := shop.ID
	_ = shopID

	// Drop the isolated database to wipe all store data
	dropDbSQL := fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;", shop.DBName)
	if err := db.Exec(dropDbSQL).Error; err != nil {
		log.Printf("Failed to drop database %s: %v", shop.DBName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete store data"})
		return
	}

	// Delete from core database
	if err := db.Delete(&shop).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete store record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Store successfully deleted"})
}


// -------------------------------------------------------------
// Auth Settings (Tenant Specific)
// -------------------------------------------------------------

func handleGetShopAuthSettings(c *gin.Context) {

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
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found or unauthorized"})
		return
	}

	var setting ShopAuthSetting
	if err := tenantDB.First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return default setting
			c.JSON(http.StatusOK, gin.H{"settings": ShopAuthSetting{Provider: "default"}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": setting})
}

type UpdateAuthSettingsRequest struct {
	Provider  string `json:"provider" binding:"required"`
	Domain    string `json:"domain"`
	PublicKey string `json:"public_key"`
	SecretKey string `json:"secret_key"`
}

func handleUpdateShopAuthSettings(c *gin.Context) {

	var req UpdateAuthSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found or unauthorized"})
		return
	}

	// Encrypt the SecretKey
	var encryptedSecret string
	if req.SecretKey != "" {
		masterKey := AppConfig.EncryptionMasterKey
		encrypted, err := EncryptAES([]byte(masterKey), req.SecretKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt secret"})
			return
		}
		encryptedSecret = encrypted
	}

	var setting ShopAuthSetting
	if err := tenantDB.First(&setting).Error; err != nil {
		// Create new
		setting = ShopAuthSetting{
			Provider:           req.Provider,
			Domain:             req.Domain,
			PublicKey:          req.PublicKey,
			EncryptedSecretKey: encryptedSecret,
		}
		if err := tenantDB.Create(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
			return
		}
	} else {
		// Update existing
		setting.Provider = req.Provider
		setting.Domain = req.Domain
		setting.PublicKey = req.PublicKey
		if req.SecretKey != "" { // Only update if provided
			setting.EncryptedSecretKey = encryptedSecret
		}
		if err := tenantDB.Save(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings saved successfully", "settings": setting})
}

// -------------------------------------------------------------
// Public Storefront API
// -------------------------------------------------------------

func handleGetStorefrontAuthSettings(c *gin.Context) {
	subdomain := c.Param("subdomain")

	// 1. Get Shop by Subdomain from core DB
	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Shop not found"})
		return
	}

	// 2. Connect to Tenant DB
	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to store database"})
		return
	}

	// 3. Fetch Auth Setting
	var setting ShopAuthSetting
	if err := tenantDB.First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"provider": "default", "public_key": ""})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	// 4. Return safely (no secrets)
	c.JSON(http.StatusOK, gin.H{
		"provider":   setting.Provider,
		"domain":     setting.Domain,
		"public_key": setting.PublicKey,
	})
}

func handleStorefrontAuthCallback(c *gin.Context) {
	subdomain := c.Param("subdomain")
	code := c.Query("code")

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing code"})
		return
	}

	var shop Shop
	if err := db.Where("subdomain = ?", subdomain).First(&shop).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Store not found"})
		return
	}

	tenantDB, err := GlobalTenantManager.GetConnection(shop.DBName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var setting ShopAuthSetting
	if err := tenantDB.First(&setting).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Auth settings not found"})
		return
	}

	if setting.Provider != "auth0" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider for this callback"})
		return
	}

	// Decrypt the Secret Key
	masterKey := AppConfig.EncryptionMasterKey
	secretKey, err := DecryptAES([]byte(masterKey), setting.EncryptedSecretKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt secret key"})
		return
	}
	_ = secretKey // Simulate using the secret key in the OAuth exchange below

	// Actually exchange code with Auth0
	// (In a real implementation, you make a POST request to https://{domain}/oauth/token)
	// For this demo, we will simulate success and issue our own EaaS JWT for the storefront
	// since we cannot realistically expect the user to provide a valid Auth0 code right now.

	customerEmail := "customer@" + shop.Subdomain + ".com"

	// Sync Customer to Database
	var customer Customer
	tenantDB.Where("email = ?", customerEmail).FirstOrCreate(&customer, Customer{
		Email:    customerEmail,
		Provider: "auth0",
	})

	// Generate a session JWT for the customer
	tokenString, err := generateJWT(customer.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

