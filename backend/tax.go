package main

import (
	"encoding/json"
	"math"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// TaxBreakdownItem represents a single line in the tax breakdown
type TaxBreakdownItem struct {
	Name   string  `json:"name"`
	Rate   float64 `json:"rate"`
	Amount float64 `json:"amount"`
}

// TaxResult holds the complete result of a tax calculation
type TaxResult struct {
	TotalTax      float64            `json:"total_tax"`
	EffectiveRate float64            `json:"effective_rate"`
	Breakdown     []TaxBreakdownItem `json:"breakdown"`
	Inclusive     bool               `json:"inclusive"`
	BreakdownJSON string             `json:"-"`
}

// TaxLineItem represents a single item in the cart for tax calculation
type TaxLineItem struct {
	ProductID     uint
	TaxCategoryID *uint
	Amount        float64 // line total (price * qty)
	Quantity      int
}

// resolveTaxZone finds the matching TaxZone for a customer's country and region.
// Priority: region match > country match > default zone > no zone
func resolveTaxZone(tenantDB *gorm.DB, country string, region string) *TaxZone {
	country = strings.ToUpper(strings.TrimSpace(country))
	region = strings.ToUpper(strings.TrimSpace(region))

	// Normalize common country names to ISO codes
	countryCode := normalizeCountryForTax(country)

	// 1. Try to match by region first (more specific)
	if region != "" {
		var zoneRegion TaxZoneRegion
		if err := tenantDB.Where("region_code = ?", region).First(&zoneRegion).Error; err == nil {
			var zone TaxZone
			if err := tenantDB.Where("id = ? AND enabled = ?", zoneRegion.TaxZoneID, true).First(&zone).Error; err == nil {
				return &zone
			}
		}
	}

	// 2. Try to match by country
	var zoneCountry TaxZoneCountry
	if err := tenantDB.Where("country_code = ? OR country_code = ?", country, countryCode).First(&zoneCountry).Error; err == nil {
		var zone TaxZone
		if err := tenantDB.Where("id = ? AND enabled = ?", zoneCountry.TaxZoneID, true).First(&zone).Error; err == nil {
			return &zone
		}
	}

	// 3. Fallback to default zone
	var defaultZone TaxZone
	if err := tenantDB.Where("is_default = ? AND enabled = ?", true, true).First(&defaultZone).Error; err == nil {
		return &defaultZone
	}

	return nil
}

// normalizeCountryForTax converts common country names to ISO codes
func normalizeCountryForTax(country string) string {
	switch strings.ToLower(country) {
	case "india":
		return "IN"
	case "united states", "usa", "us":
		return "US"
	case "united kingdom", "uk":
		return "GB"
	case "canada":
		return "CA"
	case "australia":
		return "AU"
	case "germany":
		return "DE"
	case "france":
		return "FR"
	default:
		return strings.ToUpper(country)
	}
}

// getDefaultTaxCategory returns the shop's default tax category
func getDefaultTaxCategory(tenantDB *gorm.DB, shopID string) *TaxCategory {
	var cat TaxCategory
	if err := tenantDB.Where("shop_id = ? AND is_default = ?", shopID, true).First(&cat).Error; err == nil {
		return &cat
	}
	return nil
}

// lookupTaxRates finds applicable tax rates for a zone + category, checking overrides first
func lookupTaxRates(tenantDB *gorm.DB, shopID string, zoneID uint, categoryID uint, productID uint) []TaxRate {
	// 1. Check product-level override
	var productOverride ShopTaxOverride
	if err := tenantDB.Where("shop_id = ? AND scope_type = ? AND scope_id = ? AND tax_zone_id = ?",
		shopID, "product", productID, zoneID).First(&productOverride).Error; err == nil {
		if productOverride.Exempt {
			return nil // exempt = 0% tax
		}
		return []TaxRate{{
			Name:     "Tax (Override)",
			Rate:     productOverride.Rate,
			RateType: "percentage",
		}}
	}

	// 2. Check category-level override
	var categoryOverride ShopTaxOverride
	if err := tenantDB.Where("shop_id = ? AND scope_type = ? AND scope_id = ? AND tax_zone_id = ?",
		shopID, "category", categoryID, zoneID).First(&categoryOverride).Error; err == nil {
		if categoryOverride.Exempt {
			return nil
		}
		return []TaxRate{{
			Name:     "Tax (Override)",
			Rate:     categoryOverride.Rate,
			RateType: "percentage",
		}}
	}

	// 3. Use zone default rates for this category
	var rates []TaxRate
	tenantDB.Where("tax_zone_id = ? AND tax_category_id = ?", zoneID, categoryID).
		Order("priority ASC").Find(&rates)

	return rates
}

// calculateTaxForCart computes total tax for a cart given the customer's location
func calculateTaxForCart(tenantDB *gorm.DB, shopID string, lineItems []TaxLineItem, country string, region string) TaxResult {
	result := TaxResult{}

	// 1. Resolve the tax zone
	zone := resolveTaxZone(tenantDB, country, region)
	if zone == nil {
		return result // no tax zone = no tax
	}

	result.Inclusive = zone.Inclusive

	// 2. Get default category for items without one
	defaultCat := getDefaultTaxCategory(tenantDB, shopID)

	var totalTaxableAmount float64
	breakdownMap := make(map[string]*TaxBreakdownItem)

	// 3. Calculate tax for each line item
	for _, item := range lineItems {
		categoryID := uint(0)
		if item.TaxCategoryID != nil {
			categoryID = *item.TaxCategoryID
		} else if defaultCat != nil {
			categoryID = defaultCat.ID
		}

		if categoryID == 0 {
			continue // no category assigned, skip tax
		}

		rates := lookupTaxRates(tenantDB, shopID, zone.ID, categoryID, item.ProductID)
		if len(rates) == 0 {
			continue
		}

		// Sort by priority for compound calculation
		sort.Slice(rates, func(i, j int) bool {
			return rates[i].Priority < rates[j].Priority
		})

		baseAmount := item.Amount
		if zone.Inclusive {
			// Back-calculate: if price includes tax, extract the tax portion
			// For a single rate: tax = price - (price / (1 + rate))
			// For compound rates, we need to reverse the compound calculation
			totalRate := calculateEffectiveRate(rates)
			baseAmount = item.Amount / (1 + totalRate)
		}

		runningBase := baseAmount
		for _, rate := range rates {
			var lineTax float64
			if rate.RateType == "flat" {
				lineTax = rate.Rate * float64(item.Quantity)
			} else {
				lineTax = runningBase * rate.Rate
			}

			// Round to 2 decimal places
			lineTax = math.Round(lineTax*100) / 100

			result.TotalTax += lineTax

			// Aggregate breakdown by tax name
			key := rate.Name
			if existing, ok := breakdownMap[key]; ok {
				existing.Amount += lineTax
			} else {
				breakdownMap[key] = &TaxBreakdownItem{
					Name:   rate.Name,
					Rate:   rate.Rate,
					Amount: lineTax,
				}
			}

			// For compound taxes, next tax applies on base + previous tax
			if rate.IsCompound {
				runningBase += lineTax
			}
		}

		totalTaxableAmount += baseAmount
	}

	// Round total tax
	result.TotalTax = math.Round(result.TotalTax*100) / 100

	// Calculate effective rate
	if totalTaxableAmount > 0 {
		result.EffectiveRate = math.Round((result.TotalTax/totalTaxableAmount)*10000) / 10000
	}

	// Build breakdown slice
	for _, item := range breakdownMap {
		item.Amount = math.Round(item.Amount*100) / 100
		result.Breakdown = append(result.Breakdown, *item)
	}

	// Serialize breakdown to JSON
	if len(result.Breakdown) > 0 {
		if b, err := json.Marshal(result.Breakdown); err == nil {
			result.BreakdownJSON = string(b)
		}
	}

	return result
}

// calculateEffectiveRate computes the combined rate for compound taxes
func calculateEffectiveRate(rates []TaxRate) float64 {
	var totalRate float64
	for _, r := range rates {
		if r.RateType == "percentage" {
			if r.IsCompound {
				totalRate = totalRate + r.Rate + (totalRate * r.Rate)
			} else {
				totalRate += r.Rate
			}
		}
	}
	return totalRate
}
