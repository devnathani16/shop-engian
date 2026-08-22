package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
)

type ShiprocketAuthResponse struct {
	Token string `json:"token"`
}

type ShiprocketServiceabilityRequest struct {
	PickupPostcode   string  `json:"pickup_postcode"`
	DeliveryPostcode string  `json:"delivery_postcode"`
	Weight           float64 `json:"weight"` // in kg
	COD              int     `json:"cod"`
}

type ShiprocketCourier struct {
	CourierName       string  `json:"courier_name"`
	CourierCompanyID  int     `json:"courier_company_id"`
	Rate              float64 `json:"rate"`
	EstimatedDelivery string  `json:"etd"`
}

func getShiprocketToken(email, password string) (string, error) {
	url := "https://apiv2.shiprocket.in/v1/external/auth/login"
	payload := map[string]string{
		"email":    email,
		"password": password,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return "", fmt.Errorf("failed to authenticate with Shiprocket, status: %d", res.StatusCode)
	}

	var authRes ShiprocketAuthResponse
	json.NewDecoder(res.Body).Decode(&authRes)
	return authRes.Token, nil
}

func getShiprocketRates(token, pickup, delivery string, dims BoxDimensions) ([]ShiprocketCourier, error) {
	volumetricWeight := (dims.Length * dims.Width * dims.Height) / 5000.0
	chargeableWeight := dims.Weight
	if volumetricWeight > chargeableWeight {
		chargeableWeight = volumetricWeight
	}
	
	log.Printf("[Shiprocket Debug] L=%.2f, W=%.2f, H=%.2f -> Volumetric=%.2f, Dead=%.2f, Chargeable=%.2f", dims.Length, dims.Width, dims.Height, volumetricWeight, dims.Weight, chargeableWeight)

	url := fmt.Sprintf("https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=%s&delivery_postcode=%s&weight=%f&cod=0", pickup, delivery, chargeableWeight)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		bodyBytes, _ := ioutil.ReadAll(res.Body)
		return nil, fmt.Errorf("failed to fetch rates from Shiprocket: %s", string(bodyBytes))
	}

	var result map[string]interface{}
	json.NewDecoder(res.Body).Decode(&result)

	var couriers []ShiprocketCourier
	data, ok := result["data"].(map[string]interface{})
	if ok {
		available, ok := data["available_courier_companies"].([]interface{})
		if ok && len(available) > 0 {
			for _, c := range available {
				cMap := c.(map[string]interface{})
				name := cMap["courier_name"].(string)
				rate := cMap["rate"].(float64)
				id := int(cMap["courier_company_id"].(float64))
				etd := cMap["etd"].(string)
				couriers = append(couriers, ShiprocketCourier{
					CourierName:       name,
					CourierCompanyID:  id,
					Rate:              rate,
					EstimatedDelivery: etd,
				})
			}
		} else {
			log.Printf("[Shiprocket API] No couriers available. Full response: %v", result)
		}
	} else {
		log.Printf("[Shiprocket API] Invalid response format. Full response: %v", result)
	}

	return couriers, nil
}

type ShiprocketOrderRequest struct {
	OrderID           string `json:"order_id"`
	OrderDate         string `json:"order_date"`
	PickupLocation    string `json:"pickup_location"`
	BillingCustomer   string `json:"billing_customer_name"`
	BillingLastName   string `json:"billing_last_name"`
	BillingAddress    string `json:"billing_address"`
	BillingCity       string `json:"billing_city"`
	BillingPincode    string `json:"billing_pincode"`
	BillingState      string `json:"billing_state"`
	BillingCountry    string `json:"billing_country"`
	BillingEmail      string `json:"billing_email"`
	BillingPhone      string `json:"billing_phone"`
	ShippingIsBilling bool   `json:"shipping_is_billing"`
	OrderItems        []map[string]interface{} `json:"order_items"`
	PaymentMethod     string `json:"payment_method"`
	SubTotal          float64 `json:"sub_total"`
	Length            float64 `json:"length"`
	Breadth           float64 `json:"breadth"`
	Height            float64 `json:"height"`
	Weight            float64 `json:"weight"`
}

type ShiprocketOrderResponse struct {
	OrderID    int `json:"order_id"`
	ShipmentID int `json:"shipment_id"`
	Status     string `json:"status"`
	StatusCode int `json:"status_code"`
}

func createShiprocketOrder(token string, payload ShiprocketOrderRequest) (*ShiprocketOrderResponse, error) {
	url := "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"
	
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		bodyBytes, _ := ioutil.ReadAll(res.Body)
		return nil, fmt.Errorf("shiprocket order creation failed: %s", string(bodyBytes))
	}

	bodyBytes, _ := ioutil.ReadAll(res.Body)
	log.Printf("[Shiprocket Response] %s", string(bodyBytes))

	var srResponse ShiprocketOrderResponse
	if err := json.Unmarshal(bodyBytes, &srResponse); err != nil {
		return nil, err
	}

	if srResponse.OrderID == 0 {
		var errResponse struct {
			Message string `json:"message"`
		}
		json.Unmarshal(bodyBytes, &errResponse)
		return nil, fmt.Errorf("shiprocket error: %s", errResponse.Message)
	}

	return &srResponse, nil
}

func cancelShiprocketOrder(token string, orderIDs []int) error {
	url := "https://apiv2.shiprocket.in/v1/external/orders/cancel"
	
	payload := map[string]interface{}{
		"ids": orderIDs,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		bodyBytes, _ := ioutil.ReadAll(res.Body)
		return fmt.Errorf("shiprocket order cancellation failed: %s", string(bodyBytes))
	}
	return nil
}

type ShiprocketAWBResponse struct {
	AWBCode string `json:"awb_code"`
	CourierName string `json:"courier_name"`
	CourierCompanyID int `json:"courier_company_id"`
}

func generateShiprocketAWB(token string, shipmentID int) (*ShiprocketAWBResponse, error) {
	url := "https://apiv2.shiprocket.in/v1/external/courier/assign/awb"
	payload := map[string]interface{}{
		"shipment_id": shipmentID,
	}
	body, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	bodyBytes, _ := ioutil.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("failed to generate AWB: %s", string(bodyBytes))
	}

	var result struct {
		Response struct {
			Data ShiprocketAWBResponse `json:"data"`
		} `json:"response"`
	}
	json.Unmarshal(bodyBytes, &result)
	
	return &result.Response.Data, nil
}

func generateShiprocketLabel(token string, shipmentIDs []int) (string, error) {
	url := "https://apiv2.shiprocket.in/v1/external/manifests/generate"
	payload := map[string]interface{}{
		"shipment_id": shipmentIDs,
	}
	body, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	bodyBytes, _ := ioutil.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("failed to generate label: %s", string(bodyBytes))
	}

	var result struct {
		LabelURL string `json:"label_url"`
	}
	json.Unmarshal(bodyBytes, &result)
	
	return result.LabelURL, nil
}

func generateShiprocketInvoice(token string, orderIDs []int) (string, error) {
	url := "https://apiv2.shiprocket.in/v1/external/orders/print/invoice"
	payload := map[string]interface{}{
		"ids": orderIDs,
	}
	body, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	bodyBytes, _ := ioutil.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("failed to generate invoice: %s", string(bodyBytes))
	}

	var result struct {
		IsInvoiceCreated bool   `json:"is_invoice_created"`
		InvoiceURL       string `json:"invoice_url"`
	}
	json.Unmarshal(bodyBytes, &result)
	
	if !result.IsInvoiceCreated {
		return "", fmt.Errorf("invoice not created yet, please wait a few moments")
	}
	return result.InvoiceURL, nil
}
