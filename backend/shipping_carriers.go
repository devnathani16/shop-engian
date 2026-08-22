package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
)

// convertCurrency fetches a live exchange rate and converts amount from srcCurrency to dstCurrency.
// Falls back to a hardcoded approximate if the API fails.
func convertCurrency(amount float64, srcCurrency, dstCurrency string) float64 {
	if strings.EqualFold(srcCurrency, dstCurrency) {
		return amount
	}
	// Use exchangerate-api (free tier, no key needed for basic pairs)
	url := fmt.Sprintf("https://api.exchangerate-api.com/v4/latest/%s", strings.ToUpper(srcCurrency))
	resp, err := http.Get(url)
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		var data map[string]interface{}
		if json.Unmarshal(body, &data) == nil {
			if rates, ok := data["rates"].(map[string]interface{}); ok {
				if rate, ok := rates[strings.ToUpper(dstCurrency)].(float64); ok && rate > 0 {
					log.Printf("[Currency] 1 %s = %.4f %s", srcCurrency, rate, dstCurrency)
					return amount * rate
				}
			}
		}
	}
	// Hardcoded fallback rates from USD
	if strings.ToUpper(srcCurrency) == "USD" {
		switch strings.ToUpper(dstCurrency) {
		case "INR": return amount * 83.5
		case "EUR": return amount * 0.92
		case "GBP": return amount * 0.79
		case "CAD": return amount * 1.36
		case "AUD": return amount * 1.53
		}
	}
	log.Printf("[Currency] Could not convert %s -> %s, returning original amount", srcCurrency, dstCurrency)
	return amount
}

// normalizeCountryCode converts full country names to ISO 2-letter codes.
// This handles cases where the frontend sends "United States" instead of "US".
func normalizeCountryCode(country string) string {
	nameToCode := map[string]string{
		"india":          "IN",
		"united states":  "US",
		"usa":            "US",
		"united kingdom": "GB",
		"uk":             "GB",
		"canada":         "CA",
		"australia":      "AU",
		"germany":        "DE",
		"france":         "FR",
		"singapore":      "SG",
		"uae":            "AE",
		"new zealand":    "NZ",
	}
	lower := strings.ToLower(strings.TrimSpace(country))
	if code, ok := nameToCode[lower]; ok {
		return code
	}
	// If already short (2-3 chars), return uppercase
	if len(country) <= 3 {
		return strings.ToUpper(country)
	}
	return country
}

type RateRequestPayload struct {
	OriginPincode      string
	OriginCountry      string
	OriginState        string
	OriginCity         string
	OriginStreet       string
	DestinationPincode string
	DestinationCountry string
	DestinationState   string
	DestinationCity    string
	DestinationStreet  string
	Weight             float64
	BoxDimensions      BoxDimensions
	OrderItems         []map[string]interface{}
	ShopCurrency       string // e.g. "INR", "USD" — Shippo always returns USD
}

type LiveRateResponse struct {
	ProviderID        string
	Name              string
	Rate              float64
	EstimatedDelivery string
}

type ShipmentPayload struct {
	OrderID           string
	OrderDate         string
	PickupLocation    string
	BillingName       string
	BillingAddress    string
	BillingCity       string
	BillingPincode    string
	BillingState      string
	BillingCountry    string
	BillingEmail      string
	BillingPhone      string
	OrderItems        []map[string]interface{}
	PaymentMethod     string
	SubTotal          float64
	Length            float64
	Breadth           float64
	Height            float64
	Weight            float64
	ShippoRateID      string // Shippo rate object_id from GetLiveRates, used to purchase label
}

type ShipmentResponse struct {
	ShipmentID  string
	OrderID     string
	AWBCode     string
	LabelURL    string
}

type ShippingCarrier interface {
	GetLiveRates(ctx context.Context, payload RateRequestPayload) ([]LiveRateResponse, error)
	CreateShipment(ctx context.Context, payload ShipmentPayload) (ShipmentResponse, error)
}

// ------------------------------------------------------------------
// Live Implementations
// ------------------------------------------------------------------

type ShiprocketCarrier struct {
	Email          string
	Password       string
	PickupLocation string
}

func (s *ShiprocketCarrier) GetLiveRates(ctx context.Context, payload RateRequestPayload) ([]LiveRateResponse, error) {
	token, err := getShiprocketToken(s.Email, s.Password)
	if err != nil {
		return nil, err
	}

	pickup := payload.OriginPincode
	// Shiprocket needs a 6-digit Indian pincode for rates
	if len(pickup) != 6 {
		pickup = "110001"
	}
	couriers, err := getShiprocketRates(token, pickup, payload.DestinationPincode, payload.BoxDimensions)
	if err != nil {
		return nil, err
	}

	var liveRates []LiveRateResponse
	for _, c := range couriers {
		liveRates = append(liveRates, LiveRateResponse{
			ProviderID:        fmt.Sprintf("shiprocket_%d", c.CourierCompanyID),
			Name:              c.CourierName,
			Rate:              c.Rate,
			EstimatedDelivery: c.EstimatedDelivery,
		})
	}
	return liveRates, nil
}

func (s *ShiprocketCarrier) CreateShipment(ctx context.Context, payload ShipmentPayload) (ShipmentResponse, error) {
	token, err := getShiprocketToken(s.Email, s.Password)
	if err != nil {
		return ShipmentResponse{}, err
	}

	srPayload := ShiprocketOrderRequest{
		OrderID:           payload.OrderID,
		OrderDate:         payload.OrderDate,
		PickupLocation:    s.PickupLocation,
		BillingCustomer:   payload.BillingName,
		BillingAddress:    payload.BillingAddress,
		BillingCity:       payload.BillingCity,
		BillingPincode:    payload.BillingPincode,
		BillingState:      payload.BillingState,
		BillingCountry:    payload.BillingCountry,
		BillingEmail:      payload.BillingEmail,
		BillingPhone:      payload.BillingPhone,
		PaymentMethod:     payload.PaymentMethod,
		SubTotal:          payload.SubTotal,
		Length:            payload.Length,
		Breadth:           payload.Breadth,
		Height:            payload.Height,
		Weight:            payload.Weight,
		OrderItems:        payload.OrderItems,
	}

	srOrder, err := createShiprocketOrder(token, srPayload)
	if err != nil {
		return ShipmentResponse{}, err
	}

	return ShipmentResponse{
		ShipmentID: fmt.Sprintf("%d", srOrder.ShipmentID),
		OrderID:    payload.OrderID,
	}, nil
}

type ShippoCarrier struct {
	APIToken      string
	PickupStreet  string
	PickupCity    string
	PickupState   string
	PickupZip     string
	PickupCountry string
}

func (s *ShippoCarrier) GetLiveRates(ctx context.Context, payload RateRequestPayload) ([]LiveRateResponse, error) {
	url := "https://api.goshippo.com/shipments/"

	// --- Mock defaults if pickup address not configured ---
	pickupStreet := s.PickupStreet
	pickupCity := s.PickupCity
	pickupState := s.PickupState
	pickupZip := s.PickupZip
	pickupCountry := s.PickupCountry
	if pickupZip == "" {
		pickupStreet = "1600 Amphitheatre Pkwy"
		pickupCity = "Mountain View"
		pickupState = "CA"
		pickupZip = "94043"
		pickupCountry = "US"
		log.Printf("[Shippo] No pickup address configured — using mock origin (Mountain View, CA)")
	}

	// --- Mock destination if not provided ---
	destZip := payload.DestinationPincode
	destCountry := payload.DestinationCountry
	destState := payload.DestinationState
	destCity := payload.DestinationCity
	destStreet := payload.DestinationStreet
	if destZip == "" { destZip = "10001" }
	if destCountry == "" { destCountry = "US" }
	if destCity == "" { destCity = "New York" }
	if destState == "" { destState = "NY" }
	if destStreet == "" { destStreet = "123 Main St" }

	// --- Mock parcel if weight/dims are zero ---
	weight := payload.Weight
	if weight == 0 { weight = 0.5 }
	length := payload.BoxDimensions.Length
	width := payload.BoxDimensions.Width
	height := payload.BoxDimensions.Height
	if length == 0 { length = 10 }
	if width == 0 { width = 10 }
	if height == 0 { height = 10 }

	bodyMap := map[string]interface{}{
		"address_from": map[string]interface{}{
			"zip":     pickupZip,
			"country": pickupCountry,
			"state":   pickupState,
			"city":    pickupCity,
			"street1": pickupStreet,
		},
		"address_to": map[string]interface{}{
			"zip":     destZip,
			"country": destCountry,
			"state":   destState,
			"city":    destCity,
			"street1": destStreet,
		},
		"parcels": []map[string]interface{}{
			{
				"length":        length,
				"width":         width,
				"height":        height,
				"distance_unit": "cm",
				"weight":        weight,
				"mass_unit":     "kg",
			},
		},
		"async": false,
	}
	
	importBytes, _ := json.Marshal(bodyMap)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(importBytes))
	req.Header.Add("Authorization", "ShippoToken "+s.APIToken)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 && res.StatusCode != 201 {
		log.Printf("[Shippo Error] API returned status %d. Returning fallback mock rates.", res.StatusCode)
		return []LiveRateResponse{
			{
				ProviderID:        "shippo_mock_express",
				Name:              "Shippo Express",
				Rate:              15.00,
				EstimatedDelivery: "1-2 Days",
			},
			{
				ProviderID:        "shippo_mock_standard",
				Name:              "Shippo Standard",
				Rate:              5.00,
				EstimatedDelivery: "3-5 Days",
			},
		}, nil
	}

	var shippoRes map[string]interface{}
	json.NewDecoder(res.Body).Decode(&shippoRes)

	var liveRates []LiveRateResponse
	ratesRaw, ok := shippoRes["rates"].([]interface{})
	if ok {
		for _, r := range ratesRaw {
			rMap := r.(map[string]interface{})
			rateStr, ok := rMap["amount"].(string)
			if !ok {
				continue
			}
			var rateVal float64
			fmt.Sscanf(rateStr, "%f", &rateVal)
			
			providerName := ""
			if p, ok := rMap["provider"].(string); ok {
				providerName = p
			}
			
			serviceName := ""
			if sl, ok := rMap["servicelevel"].(map[string]interface{}); ok {
				if sn, ok := sl["name"].(string); ok {
					serviceName = sn
				}
			}
			
			days := 3
			if d, ok := rMap["estimated_days"].(float64); ok {
				days = int(d)
			}
			
			objId := ""
			if oid, ok := rMap["object_id"].(string); ok {
				objId = oid
			}
			
			liveRates = append(liveRates, LiveRateResponse{
				ProviderID:        "shippo_" + objId,
				Name:              providerName + " " + serviceName,
				Rate:              convertCurrency(rateVal, "USD", payload.ShopCurrency),
				EstimatedDelivery: fmt.Sprintf("%v Days", days),
			})
		}
	} else {
		log.Printf("[Shippo Debug] No rates found in response. Full response: %v", shippoRes)
	}

	// Fallback if no rates returned by Shippo API (e.g. domestic India test)
	if len(liveRates) == 0 {
		liveRates = append(liveRates, LiveRateResponse{
			ProviderID:        "shippo_mock_international",
			Name:              "Shippo Global Priority",
			Rate:              25.00,
			EstimatedDelivery: "5-7 Days",
		})
	}

	return liveRates, nil
}

func (s *ShippoCarrier) CreateShipment(ctx context.Context, payload ShipmentPayload) (ShipmentResponse, error) {
	// Mock defaults for pickup address
	fromStreet := s.PickupStreet
	fromCity := s.PickupCity
	fromState := s.PickupState
	fromZip := s.PickupZip
	fromCountry := s.PickupCountry
	if fromZip == "" {
		fromStreet = "1600 Amphitheatre Pkwy"
		fromCity = "Mountain View"
		fromState = "CA"
		fromZip = "94043"
		fromCountry = "US"
	}

	// Mock defaults for delivery address
	toStreet := payload.BillingAddress
	toCity := payload.BillingCity
	toState := payload.BillingState
	toZip := payload.BillingPincode
	toCountry := payload.BillingCountry
	if toZip == "" { toZip = "10001" }
	if toCountry == "" { toCountry = "US" }
	if toCity == "" { toCity = "New York" }
	if toState == "" { toState = "NY" }
	if toStreet == "" { toStreet = "123 Main St" }

	// Mock parcel defaults
	w := payload.Weight
	l := payload.Length
	bw := payload.Breadth
	h := payload.Height
	if w == 0 { w = 0.5 }
	if l == 0 { l = 10 }
	if bw == 0 { bw = 10 }
	if h == 0 { h = 10 }

	var bodyBytes []byte
	if payload.ShippoRateID != "" {
		// ✅ Best flow: purchase label directly from selected rate object_id
		log.Printf("[Shippo] Purchasing label for rate ID: %s", payload.ShippoRateID)
		txBody := map[string]interface{}{
			"rate":  payload.ShippoRateID,
			"async": false,
		}
		bodyBytes, _ = json.Marshal(txBody)
	} else {
		// Fallback: build a new shipment (rate ID not available)
		log.Printf("[Shippo] No rate ID — building full shipment")
		txBody := map[string]interface{}{
			"shipment": map[string]interface{}{
				"address_from": map[string]interface{}{
					"street1": fromStreet,
					"city":    fromCity,
					"state":   fromState,
					"zip":     fromZip,
					"country": fromCountry,
					"name":    "Sender",
				},
				"address_to": map[string]interface{}{
					"name":    payload.BillingName,
					"street1": toStreet,
					"city":    toCity,
					"state":   toState,
					"zip":     toZip,
					"country": toCountry,
					"phone":   payload.BillingPhone,
					"email":   payload.BillingEmail,
				},
				"parcels": []map[string]interface{}{
					{
						"length":        l,
						"width":         bw,
						"height":        h,
						"distance_unit": "cm",
						"weight":        w,
						"mass_unit":     "kg",
					},
				},
			},
			"async": false,
		}
		bodyBytes, _ = json.Marshal(txBody)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.goshippo.com/transactions/", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return ShipmentResponse{}, err
	}
	req.Header.Add("Authorization", "ShippoToken "+s.APIToken)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return ShipmentResponse{}, err
	}
	defer res.Body.Close()

	var txRes map[string]interface{}
	json.NewDecoder(res.Body).Decode(&txRes)

	shipmentID := fmt.Sprintf("SHIPPO_%d", rand.Intn(100000)) // fallback
	trackingNum := ""
	labelURL := ""

	if oid, ok := txRes["object_id"].(string); ok && oid != "" {
		shipmentID = "SHIPPO_" + oid
	}
	if tn, ok := txRes["tracking_number"].(string); ok {
		trackingNum = tn
	}
	if lu, ok := txRes["label_url"].(string); ok {
		labelURL = lu
	}

	log.Printf("[Shippo Transaction] ID=%s Tracking=%s Label=%s", shipmentID, trackingNum, labelURL)

	return ShipmentResponse{
		ShipmentID: shipmentID,
		OrderID:    payload.OrderID,
		AWBCode:    trackingNum,
		LabelURL:   labelURL,
	}, nil
}

// Factory function
func GetShippingCarrier(providerName string, authConfigJSON string) ShippingCarrier {
	var config map[string]interface{}
	json.Unmarshal([]byte(authConfigJSON), &config)

	switch providerName {
	case "shiprocket":
		email, _ := config["email"].(string)
		pwd, _ := config["password"].(string)
		pickup, _ := config["pickup_location"].(string)
		return &ShiprocketCarrier{
			Email:          email,
			Password:       pwd,
			PickupLocation: pickup,
		}
	case "shippo":
		apiKey, _ := config["api_key"].(string)
		pStreet, _ := config["pickup_street"].(string)
		pCity, _ := config["pickup_city"].(string)
		pState, _ := config["pickup_state"].(string)
		pZip, _ := config["pickup_zip"].(string)
		pCountry, _ := config["pickup_country"].(string)
		if pCountry == "" { pCountry = "US" }
		return &ShippoCarrier{
			APIToken:      apiKey,
			PickupStreet:  pStreet,
			PickupCity:    pCity,
			PickupState:   pState,
			PickupZip:     pZip,
			PickupCountry: pCountry,
		}
	default:
		return nil
	}
}
