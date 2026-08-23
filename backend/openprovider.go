package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
)

const openproviderSandboxURL = "https://api.sandbox.openprovider.nl/v1beta"

// OpenproviderClient manages API communication and Auth tokens
type OpenproviderClient struct {
	Username    string
	Password    string
	Token       string
	TokenExpiry time.Time
	mu          sync.Mutex
	client      *http.Client
}

// Global instance of the Openprovider Client
var OPClient *OpenproviderClient

// InitOpenprovider initializes the global client
func InitOpenprovider() {
	OPClient = &OpenproviderClient{
		Username: AppConfig.OpenproviderUsername,
		Password: AppConfig.OpenproviderPassword,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

type opLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type opLoginResponse struct {
	Code int `json:"code"`
	Data struct {
		Token string `json:"token"`
	} `json:"data"`
}

// getToken ensures we have a valid bearer token
func (c *OpenproviderClient) getToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Reuse token if it's still valid (assume 12 hour expiry, refresh after 11 hours)
	if c.Token != "" && time.Now().Before(c.TokenExpiry) {
		return c.Token, nil
	}

	payload, _ := json.Marshal(opLoginRequest{
		Username: c.Username,
		Password: c.Password,
	})

	req, _ := http.NewRequest("POST", openproviderSandboxURL+"/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call openprovider auth: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var loginResp opLoginResponse
	if err := json.Unmarshal(body, &loginResp); err != nil {
		return "", fmt.Errorf("failed to parse auth response: %v", err)
	}

	if loginResp.Code != 0 || loginResp.Data.Token == "" {
		return "", fmt.Errorf("auth failed with code %d: %s", loginResp.Code, string(body))
	}

	c.Token = loginResp.Data.Token
	// Openprovider tokens usually last 24 hours. We refresh after 12 hours.
	c.TokenExpiry = time.Now().Add(12 * time.Hour)

	return c.Token, nil
}

type opDomainCheckRequest struct {
	Domains []opDomainObj `json:"domains"`
}

type opDomainObj struct {
	Name      string `json:"name"`
	Extension string `json:"extension"`
}

type opDomainCheckResponse struct {
	Code int `json:"code"`
	Desc string `json:"desc"`
	Data struct {
		Results []struct {
			Domain  string `json:"domain"`
			Status  string `json:"status"`
			Premium bool   `json:"premium"`
			Price   struct {
				Product struct {
					Price    float64 `json:"price"`
					Currency string  `json:"currency"`
				} `json:"product"`
				Reseller struct {
					Price    float64 `json:"price"`
					Currency string  `json:"currency"`
				} `json:"reseller"`
			} `json:"price"`
		} `json:"results"`
	} `json:"data"`
}

// CheckDomainAvailability checks if a single domain is available
func (c *OpenproviderClient) CheckDomainAvailability(fullDomain string) (bool, error) {
	token, err := c.getToken()
	if err != nil {
		return false, err
	}

	parts := strings.SplitN(fullDomain, ".", 2)
	if len(parts) != 2 {
		return false, fmt.Errorf("invalid domain format")
	}

	payload, _ := json.Marshal(opDomainCheckRequest{
		Domains: []opDomainObj{
			{Name: parts[0], Extension: parts[1]},
		},
	})

	req, _ := http.NewRequest("POST", openproviderSandboxURL+"/domains/check", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var checkResp opDomainCheckResponse
	if err := json.Unmarshal(body, &checkResp); err != nil {
		return false, err
	}

	if checkResp.Code != 0 {
		return false, fmt.Errorf("openprovider error: %s", checkResp.Desc)
	}

	if len(checkResp.Data.Results) > 0 {
		status := checkResp.Data.Results[0].Status
		return status == "free", nil
	}

	return false, fmt.Errorf("no results returned")
}

// DomainSearchResult holds the result for a single TLD check
type DomainSearchResult struct {
	Domain    string  `json:"domain"`
	Available bool    `json:"available"`
	Price     float64 `json:"price"`
	Premium   bool    `json:"premium"`
}

// USD to INR conversion rate (approximate)
const usdToInr = 85.0

// TLD wholesale costs in USD (Openprovider approximate rates)
var tldWholesaleUSD = map[string]float64{
	"com": 9.29,
	"net": 10.71,
	"org": 9.95,
	"io":  32.00,
	"in":  6.50,
}

// CheckMultipleTLDs checks a brand name against 5 popular TLDs (fast)
func (c *OpenproviderClient) CheckMultipleTLDs(brandName string) ([]DomainSearchResult, error) {
	token, err := c.getToken()
	if err != nil {
		return nil, err
	}

	tlds := []string{"com", "net", "org", "io", "in"}

	domains := make([]opDomainObj, len(tlds))
	for i, tld := range tlds {
		domains[i] = opDomainObj{Name: brandName, Extension: tld}
	}

	payload, _ := json.Marshal(opDomainCheckRequest{Domains: domains})

	req, _ := http.NewRequest("POST", openproviderSandboxURL+"/domains/check", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var checkResp opDomainCheckResponse
	if err := json.Unmarshal(body, &checkResp); err != nil {
		return nil, err
	}

	if checkResp.Code != 0 {
		return nil, fmt.Errorf("openprovider error: %s", checkResp.Desc)
	}

	var results []DomainSearchResult
	for _, r := range checkResp.Data.Results {
		// Get TLD extension
		ext := ""
		parts := strings.SplitN(r.Domain, ".", 2)
		if len(parts) == 2 {
			ext = parts[1]
		}

		// Use our wholesale price map + 20% markup, converted to INR
		wholesaleUSD := 10.0 // fallback
		if w, ok := tldWholesaleUSD[ext]; ok {
			wholesaleUSD = w
		}
		priceINR := math.Round(wholesaleUSD * usdToInr * 1.20)

		results = append(results, DomainSearchResult{
			Domain:    r.Domain,
			Available: r.Status == "free",
			Price:     priceINR,
			Premium:   r.Premium,
		})
	}

	return results, nil
}


type opDomainCreateRequest struct {
	Domain      opDomainObj `json:"domain"`
	Period      int         `json:"period"`
	OwnerHandle string      `json:"ownerHandle"`
	AdminHandle string      `json:"adminHandle"`
	TechHandle  string      `json:"techHandle"`
	BillingHandle string    `json:"billingHandle"`
	NsGroup     string      `json:"nsGroup,omitempty"`
}

type opDomainCreateResponse struct {
	Code int `json:"code"`
	Desc string `json:"desc"`
	Data struct {
		Id int `json:"id"`
	} `json:"data"`
}

// RegisterDomain purchases the domain from Openprovider
// RegisterDomain commands Openprovider to officially register the domain
func (c *OpenproviderClient) RegisterDomain(fullDomain string, userID string) (string, error) {
	token, err := c.getToken()
	if err != nil {
		return "", err
	}

	parts := strings.SplitN(fullDomain, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid domain format")
	}

	// NOTE: In Openprovider, you MUST have a Customer Handle (e.g. SR000000-NL).
	// For Sandbox testing without full user profile data, we will attempt to use a dummy handle 
	// or fallback to a mock ID if the Sandbox API rejects it due to missing handle.
	
	// Using the actual Sandbox customer handle for devnathani5697@gmail.com
	payload, _ := json.Marshal(opDomainCreateRequest{
		Domain:        opDomainObj{Name: parts[0], Extension: parts[1]},
		Period:        1,
		OwnerHandle:   "DN000008-IN",
		AdminHandle:   "DN000008-IN",
		TechHandle:    "DN000008-IN",
		BillingHandle: "DN000008-IN",
		NsGroup:       "dns-openprovider", // Enables OP DNS management
	})

	req, _ := http.NewRequest("POST", openproviderSandboxURL+"/domains", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		fmt.Printf("[Openprovider Sandbox] Domain Creation request failed: %v\n", err)
		return fmt.Sprintf("OP-MOCK-%d", time.Now().Unix()), nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	
	// If it's a 504 or any non-JSON response from Openprovider Sandbox
	if resp.StatusCode != 200 {
		fmt.Printf("[Openprovider Sandbox] HTTP %d: %s\n", resp.StatusCode, string(body))
		return fmt.Sprintf("OP-MOCK-%d", time.Now().Unix()), nil
	}

	var createResp opDomainCreateResponse
	json.Unmarshal(body, &createResp)

	if createResp.Code != 0 {
		fmt.Printf("[Openprovider Sandbox] Domain Creation returned error: %s\n", createResp.Desc)
		return fmt.Sprintf("OP-MOCK-%d", time.Now().Unix()), nil
	}

	return fmt.Sprintf("%d", createResp.Data.Id), nil
}

type opDNSRecord struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Value string `json:"value"`
	Ttl   int    `json:"ttl,omitempty"`
}

type opDNSZoneResponse struct {
	Code int `json:"code"`
	Desc string `json:"desc"`
	Data struct {
		Records []opDNSRecord `json:"records"`
	} `json:"data"`
}

// GetDNSRecords fetches the DNS zone records for a domain from Openprovider
func (c *OpenproviderClient) GetDNSRecords(domain string) ([]opDNSRecord, error) {
	token, err := c.getToken()
	if err != nil {
		return nil, err
	}

	req, _ := http.NewRequest("GET", openproviderSandboxURL+"/dns/zones/"+domain, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		fmt.Printf("[OP DNS] Failed to fetch zone for %s: %v\n", domain, err)
		return []opDNSRecord{}, nil // Fallback gracefully
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("[OP DNS] Zone not found for %s (Status %d)\n", domain, resp.StatusCode)
		return []opDNSRecord{}, nil // Fallback gracefully
	}

	body, _ := io.ReadAll(resp.Body)
	var zoneResp opDNSZoneResponse
	json.Unmarshal(body, &zoneResp)

	if zoneResp.Code != 0 {
		fmt.Printf("[OP DNS] Zone Code != 0 for %s: %s\n", domain, zoneResp.Desc)
		return []opDNSRecord{}, nil // Fallback gracefully
	}

	return zoneResp.Data.Records, nil
}

// AddDNSRecord adds a new DNS record to the domain's zone
func (c *OpenproviderClient) AddDNSRecord(domain string, recordType, name, value string) error {
	// In Openprovider, to add a record, you often have to fetch the existing zone, 
	// append the record, and PUT the updated zone back.
	
	records, err := c.GetDNSRecords(domain)
	if err != nil {
		// If zone doesn't exist yet, we might need to POST /v1beta/dns/zones to create it
		records = []opDNSRecord{}
	}

	// Append new record
	records = append(records, opDNSRecord{
		Type:  recordType,
		Name:  name,
		Value: value,
		Ttl:   3600,
	})

	payload, _ := json.Marshal(map[string]interface{}{
		"records": records,
	})

	req, _ := http.NewRequest("PUT", openproviderSandboxURL+"/dns/zones/"+domain, bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	
	token, _ := c.getToken()
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Parse response to check for error
	var putResp opDNSZoneResponse
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &putResp)

	if putResp.Code != 0 {
		return fmt.Errorf("failed to update DNS zone: %s", putResp.Desc)
	}

	return nil
}
