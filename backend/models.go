package main

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	Email        string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string         `json:"-"`
	IsVerified   bool           `gorm:"default:false" json:"is_verified"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type OTP struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	Email     string    `gorm:"type:varchar(255);index;not null" json:"email"`
	Code      string    `gorm:"not null" json:"code"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Shop belongs to a User and lives in eaas_core
type Shop struct {
	ID                 string    `gorm:"type:char(36);primarykey" json:"id"`
	UserID             uint      `gorm:"not null;index" json:"user_id"`
	User               User      `json:"-"`
	Name               string    `gorm:"not null" json:"name"`
	Subdomain          string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"subdomain"`
	DBName             string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"db_name"`
	LogoURL            string    `json:"logo_url"`
	Currency           string    `gorm:"default:'USD'" json:"currency"`
	OriginPincode       string    `json:"origin_pincode"`
	DefaultShippingRate float64   `gorm:"default:5.00" json:"default_shipping_rate"`
	DefaultShippingName string    `gorm:"default:'Standard Delivery'" json:"default_shipping_name"`
	CustomCheckoutFields string   `gorm:"type:text" json:"custom_checkout_fields"` // JSON array of custom fields
	EnableAIRecommendations bool  `gorm:"default:false" json:"enable_ai_recommendations"`
	EnableAISearch          bool  `gorm:"default:false" json:"enable_ai_search"`
	Plan                    string `gorm:"default:'starter'" json:"plan"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (s *Shop) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	return
}

type ShopRole struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	ShopID      string    `gorm:"type:char(36);not null;index;constraint:OnDelete:CASCADE;" json:"shop_id"`
	Name        string    `gorm:"not null" json:"name"`
	DisplayName string    `gorm:"not null" json:"display_name"`
	Description string    `json:"description"`
	Permissions string    `gorm:"type:text" json:"permissions"` // JSON array e.g., ["read:orders", "write:products"]
	IsDefault   bool      `gorm:"default:false" json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
}

type ShopStaff struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"type:char(36);not null;index;constraint:OnDelete:CASCADE;" json:"shop_id"`
	UserID    uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"user_id"`
	RoleID    uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"role_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ShopInvite struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"type:char(36);not null;index;constraint:OnDelete:CASCADE;" json:"shop_id"`
	Email     string    `gorm:"not null;index" json:"email"`
	RoleID    uint      `gorm:"not null" json:"role_id"`
	Status    string    `gorm:"default:'pending'" json:"status"` // pending, accepted, rejected
	InviterID uint      `gorm:"not null" json:"inviter_id"`
	CreatedAt time.Time `json:"created_at"`
}

// Tenant Models (Live inside the isolated eaas_shop_* databases)

type Category struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Slug      string    `gorm:"uniqueIndex;size:255" json:"slug"`
	ImageURL  string    `json:"image_url"`
	Products  []Product `json:"products"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Product struct {
	ID             uint             `gorm:"primarykey" json:"id"`
	ShopID         string           `gorm:"not null;index" json:"shop_id"`
	Title          string           `gorm:"not null" json:"title"`
	Description    string           `json:"description"`
	Price          float64          `gorm:"not null" json:"price"`
	CompareAtPrice float64          `json:"compare_at_price"`
	StockQuantity  int              `gorm:"not null;default:0" json:"stock_quantity"`
	ImageURL       string           `json:"image_url"`
	Weight         float64          `json:"weight"` // in kg
	Length         float64          `json:"length"` // in cm
	Width          float64          `json:"width"`  // in cm
	Height         float64          `json:"height"` // in cm
	CategoryID     *uint            `gorm:"index" json:"category_id"`
	TaxCategoryID  *uint            `gorm:"index" json:"tax_category_id"`
	Category       *Category        `json:"category,omitempty"`
	EmbeddingJSON  string           `gorm:"type:text" json:"embedding_json"` // Stores vector array
	EmbeddingUpdatedAt *time.Time   `json:"embedding_updated_at"`
	Options        []ProductOption  `gorm:"constraint:OnDelete:CASCADE;" json:"options"`
	Variants       []ProductVariant `gorm:"constraint:OnDelete:CASCADE;" json:"variants"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

type ProductOption struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ProductID uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"product_id"`
	Name      string    `gorm:"not null" json:"name"` // e.g., "Color", "Size"
	Values    string    `gorm:"type:text" json:"values"` // Comma-separated or JSON array of strings
	Position  int       `gorm:"default:0" json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProductVariant struct {
	ID             uint      `gorm:"primarykey" json:"id"`
	ProductID      uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"product_id"`
	Title          string    `gorm:"not null" json:"title"` // e.g. "Red / Small"
	Option1        string    `json:"option1"`
	Option2        string    `json:"option2"`
	Option3        string    `json:"option3"`
	Option4        string    `json:"option4"`
	Option5        string    `json:"option5"`
	SKU            string    `json:"sku"`
	Price          float64   `gorm:"not null" json:"price"`
	CompareAtPrice *float64  `json:"compare_at_price"`
	StockQuantity  int       `gorm:"not null;default:0" json:"stock_quantity"`
	Weight         float64   `gorm:"default:0" json:"weight"` // weight in kg, 0 means unassigned
	ImageURL       string    `json:"image_url"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Order struct {
	ID              uint      `gorm:"primarykey" json:"id"`
	CustomerID      string    `json:"customer_id"`
	CustomerName    string    `json:"customer_name"`
	TotalAmount     float64   `gorm:"not null" json:"total_amount"`
	Status          string    `gorm:"not null;default:'Pending Payment'" json:"status"`
	PaymentMethod   string    `json:"payment_method"` // e.g. COD, Stripe, Razorpay
	CustomerEmail   string    `gorm:"not null" json:"customer_email"`
	CustomerPhone   string    `json:"customer_phone"`
	AddressLine1    string    `json:"address_line_1"`
	AddressLine2    string    `json:"address_line_2"`
	City            string    `json:"city"`
	State           string    `json:"state"`
	Pincode         string    `json:"pincode"`
	Country         string    `json:"country"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	ShippingCourier string    `json:"shipping_courier"`
	ShippingRateID  string    `json:"shipping_rate_id"`
	ShippingCost    float64   `json:"shipping_cost"`
	Subtotal        float64   `json:"subtotal"`
	DiscountCode    string    `json:"discount_code"`
	DiscountAmount  float64   `json:"discount_amount"`
	TaxAmount       float64   `json:"tax_amount"`
	TaxRate         float64   `json:"tax_rate"`
	TaxBreakdown    string    `gorm:"type:text" json:"tax_breakdown"`
	CustomFieldData string    `gorm:"type:text" json:"custom_field_data"` // JSON
	ShiprocketOrderID    string    `json:"shiprocket_order_id"`
	ShiprocketShipmentID string    `json:"shiprocket_shipment_id"`
	ShiprocketAWB        string    `json:"shiprocket_awb"`
	ShiprocketLabelURL   string    `json:"shiprocket_label_url"`
	ShiprocketInvoiceURL string    `json:"shiprocket_invoice_url"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Items           []OrderItem `gorm:"foreignKey:OrderID" json:"items"`
}

type OrderItem struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	OrderID   uint      `gorm:"not null;index" json:"order_id"`
	VariantID uint      `gorm:"not null" json:"variant_id"`
	Title     string    `json:"title"`
	Price     float64   `json:"price"`
	Quantity  int       `json:"quantity"`
	ImageURL  string    `json:"image_url"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TenantPaymentConfig struct {
	ID           uint   `gorm:"primarykey" json:"id"`
	ProviderName string `gorm:"not null" json:"provider_name"` // "stripe", "razorpay"
	IsActive     bool   `gorm:"default:true" json:"is_active"`
	AuthConfig   string `gorm:"type:text" json:"auth_config"`  // JSON containing encrypted keys
}

type Customer struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	Email     string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Provider  string    `gorm:"not null;default:'default'" json:"provider"` // e.g. 'default', 'clerk', 'auth0'
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Media struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	FileName  string    `gorm:"not null" json:"file_name"`
	URL       string    `gorm:"not null" json:"url"`
	FileID    string    `gorm:"not null" json:"file_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ShopAuthSetting struct {
	ID                 uint      `gorm:"primarykey" json:"id"`
	Provider           string    `gorm:"not null;default:'default'" json:"provider"` // 'default', 'clerk', 'auth0'
	Domain             string    `json:"domain"`                                     // Used for Auth0
	PublicKey          string    `json:"public_key"`
	EncryptedSecretKey string    `json:"-"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type ShippingRule struct {
	ID             uint      `gorm:"primarykey" json:"id"`
	ShopID         string    `gorm:"not null;index" json:"shop_id"` // Add ShopID to rule
	ZoneID         *uint     `json:"zone_id"`                       // Nullable for global rules
	Name           string    `gorm:"not null" json:"name"`
	Priority       int       `gorm:"not null;default:0" json:"priority"`
	ConditionsJSON string    `gorm:"type:text;not null" json:"conditions_json"`
	ActionJSON     string    `gorm:"type:text;not null" json:"action_json"`
	IsActive       bool      `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ShippingZone struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"shop_id"`
	Name      string    `gorm:"not null" json:"name"`
	Currency  string    `gorm:"default:'USD'" json:"currency"`
	IsDefault bool      `gorm:"default:false" json:"is_default"` // Catch-All (Rest of World)
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ShippingZoneCountry struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	ZoneID      uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"zone_id"`
	CountryCode string    `gorm:"not null;index" json:"country_code"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ShippingZoneRegion struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ZoneID    uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"zone_id"`
	StateCode string    `json:"state_code"` // e.g., MH, CA
	ZipPrefix string    `json:"zip_prefix"` // e.g., 902*
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ShippingZoneRate struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	ZoneID        uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"zone_id"`
	Name          string    `gorm:"not null" json:"name"`
	MinWeight     float64   `gorm:"default:0" json:"min_weight"`
	MaxWeight     float64   `gorm:"default:0" json:"max_weight"`
	MinOrderValue float64   `gorm:"default:0" json:"min_order_value"`
	MaxOrderValue float64   `gorm:"default:0" json:"max_order_value"`
	Rate          float64   `gorm:"not null" json:"rate"`
	EstimatedDays string    `json:"estimated_days"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ShippingProvider struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	ShopID       string    `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"shop_id"`
	ProviderName string    `gorm:"not null" json:"provider_name"` // "shiprocket", "easypost"
	AuthConfig   string    `gorm:"type:text" json:"auth_config"`  // JSON mapping of credentials
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ShippingZoneProvider struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	ZoneID     uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"zone_id"`
	ProviderID uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"provider_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type DiscountCode struct {
	ID                uint       `gorm:"primarykey" json:"id"`
	Code              string     `gorm:"type:varchar(100);not null;uniqueIndex" json:"code"`
	Type              string     `gorm:"type:varchar(50);not null" json:"type"` // "percentage", "flat", "free_shipping"
	Value             float64    `gorm:"not null" json:"value"` // e.g., 20 for 20%, 500 for Rs500
	MinPurchaseAmount float64    `gorm:"default:0" json:"min_purchase_amount"`
	UsageLimit        *int       `json:"usage_limit"` // null for unlimited
	Uses              int        `gorm:"default:0" json:"uses"`
	ValidFrom         *time.Time `json:"valid_from"`
	ValidUntil        *time.Time `json:"valid_until"`
	IsActive          bool       `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type AbandonedCart struct {
	ID                uint       `gorm:"primarykey" json:"id"`
	CustomerEmail     string     `gorm:"index;not null" json:"customer_email"`
	CartJSON          string     `gorm:"type:text;not null" json:"cart_json"`
	Value             float64    `gorm:"not null;default:0" json:"value"`
	Status            string     `gorm:"not null;default:'Abandoned'" json:"status"` // "Abandoned", "Recovered"
	RecoveryEmailSent bool       `gorm:"default:false" json:"recovery_email_sent"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type ThemeSetting struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	Config    string    `gorm:"type:text;not null" json:"config"` // JSON string containing global colors, fonts, and an array of sections
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ===== TAX SYSTEM MODELS =====

type TaxCategory struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"not null;index" json:"shop_id"`
	Name      string    `gorm:"not null" json:"name"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaxZone struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"not null;index" json:"shop_id"`
	Name      string    `gorm:"not null" json:"name"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	Inclusive bool      `gorm:"default:false" json:"inclusive"`
	Enabled   bool      `gorm:"default:true" json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaxZoneCountry struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	TaxZoneID   uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"tax_zone_id"`
	CountryCode string    `gorm:"not null;index" json:"country_code"`
	CreatedAt   time.Time `json:"created_at"`
}

type TaxZoneRegion struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	TaxZoneID  uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"tax_zone_id"`
	RegionCode string    `gorm:"not null" json:"region_code"`
	CreatedAt  time.Time `json:"created_at"`
}

type TaxRate struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	TaxZoneID     uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"tax_zone_id"`
	TaxCategoryID uint      `gorm:"not null;index" json:"tax_category_id"`
	Name          string    `gorm:"not null" json:"name"`
	Rate          float64   `gorm:"not null" json:"rate"`
	RateType      string    `gorm:"default:'percentage'" json:"rate_type"`
	IsCompound    bool      `gorm:"default:false" json:"is_compound"`
	Priority      int       `gorm:"default:0" json:"priority"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ShopTaxOverride struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"not null;index" json:"shop_id"`
	ScopeType string    `gorm:"not null" json:"scope_type"`
	ScopeID   uint      `gorm:"not null" json:"scope_id"`
	TaxZoneID uint      `gorm:"not null" json:"tax_zone_id"`
	Rate      float64   `gorm:"not null" json:"rate"`
	Exempt    bool      `gorm:"default:false" json:"exempt"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ===== INVENTORY AI MODELS =====

type InventoryInsight struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ShopID    string    `gorm:"not null;index" json:"shop_id"`
	VariantID uint      `gorm:"not null;index;constraint:OnDelete:CASCADE;" json:"variant_id"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	Severity  string    `gorm:"default:'info'" json:"severity"` // 'info', 'warning', 'critical'
	CreatedAt time.Time `json:"created_at"`
}
