package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const namecheapSandboxURL = "https://api.sandbox.namecheap.com/xml.response"

type NamecheapClient struct {
	ApiUser       string
	ApiKey        string
	UserName      string
	ClientIP      string
	client        *http.Client
	regClient     *http.Client
	livePricesUSD map[string]float64
	mu            sync.RWMutex
}

var NCClient *NamecheapClient

func InitNamecheap() {
	NCClient = &NamecheapClient{
		ApiUser:       AppConfig.NamecheapApiUser,
		ApiKey:        AppConfig.NamecheapApiKey,
		UserName:      AppConfig.NamecheapUserName,
		ClientIP:      AppConfig.NamecheapClientIP,
		client:        &http.Client{Timeout: 10 * time.Second},
		regClient:     &http.Client{Timeout: 45 * time.Second},
		livePricesUSD: map[string]float64{
			"com":   11.65,
			"net":   10.88,
			"org":   10.88,
			"io":    32.00,
			"in":    7.90,
			"co.in": 6.50,
			"shop":  22.50,
			"store": 40.85,
			"co":    22.50,
			"biz":   15.00,
		},
	}
	go NCClient.syncLivePrices()
}


type NCPricingResponse struct {
	XMLName xml.Name `xml:"ApiResponse"`
	Status  string   `xml:"Status,attr"`
	CommandResponse struct {
		UserGetPricingResult struct {
			ProductType struct {
				ProductCategory []struct {
					Name    string `xml:"Name,attr"`
					Product []struct {
						Name  string `xml:"Name,attr"`
						Price []struct {
							Duration int     `xml:"Duration,attr"`
							YourPrice float64 `xml:"YourPrice,attr"`
						} `xml:"Price"`
					} `xml:"Product"`
				} `xml:"ProductCategory"`
			} `xml:"ProductType"`
		} `xml:"UserGetPricingResult"`
	} `xml:"CommandResponse"`
}

func (c *NamecheapClient) syncLivePrices() {
	// Use a dedicated long-timeout client — the pricing XML is huge and takes 15-30s
	pricingClient := &http.Client{Timeout: 60 * time.Second}

	reqURL := c.buildBaseURL("namecheap.users.getPricing") + "&ProductType=DOMAIN&ActionName=REGISTER"
	fmt.Println("[Namecheap] Fetching live pricing from API (this takes ~15s)...")
	resp, err := pricingClient.Get(reqURL)
	if err != nil {
		fmt.Println("[Namecheap] Failed to fetch live pricing:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ncResp NCPricingResponse
	xml.Unmarshal(body, &ncResp)

	if ncResp.Status == "OK" {
		c.mu.Lock()
		defer c.mu.Unlock()
		
		count := 0
		for _, category := range ncResp.CommandResponse.UserGetPricingResult.ProductType.ProductCategory {
			if category.Name == "register" {
				for _, prod := range category.Product {
					for _, price := range prod.Price {
						if price.Duration == 1 {
							c.livePricesUSD[prod.Name] = price.YourPrice
							count++
							break
						}
					}
				}
			}
		}
		// Log a few key prices so we can verify
		fmt.Printf("[Namecheap] Synced LIVE pricing for %d TLDs\n", count)
		for _, key := range []string{"com", "net", "org", "in", "io", "shop", "store", "biz", "co"} {
			if p, ok := c.livePricesUSD[key]; ok {
				fmt.Printf("  .%-6s => $%.2f (we charge: ₹%d with 35%% markup)\n", key, p, int(p*1.35*85.0))
			}
		}
	} else {
		fmt.Println("[Namecheap] Error in pricing response")
	}
}

func (c *NamecheapClient) buildBaseURL(command string) string {
	u, _ := url.Parse(namecheapSandboxURL)
	q := u.Query()
	q.Set("ApiUser", c.ApiUser)
	q.Set("ApiKey", c.ApiKey)
	q.Set("UserName", c.UserName)
	q.Set("ClientIp", c.ClientIP)
	q.Set("Command", command)
	u.RawQuery = q.Encode()
	return u.String()
}

// --- XML Parsing Structs ---

type NCResponse struct {
	XMLName xml.Name `xml:"ApiResponse"`
	Status  string   `xml:"Status,attr"`
	Errors  struct {
		Error []struct {
			Number string `xml:"Number,attr"`
			Msg    string `xml:",chardata"`
		} `xml:"Error"`
	} `xml:"Errors"`
	CommandResponse struct {
		DomainCheckResult []struct {
			Domain    string `xml:"Domain,attr"`
			Available string `xml:"Available,attr"` // "true" or "false"
		} `xml:"DomainCheckResult"`
		DomainCreateResult struct {
			Domain     string `xml:"Domain,attr"`
			Registered string `xml:"Registered,attr"`
			OrderID    string `xml:"OrderID,attr"`
		} `xml:"DomainCreateResult"`
		DomainDNSGetHostsResult struct {
			Host []struct {
				HostId  string `xml:"HostId,attr"`
				Name    string `xml:"Name,attr"`
				Type    string `xml:"Type,attr"`
				Address string `xml:"Address,attr"`
				MXPref  string `xml:"MXPref,attr"`
				TTL     string `xml:"TTL,attr"`
			} `xml:"host"`
		} `xml:"DomainDNSGetHostsResult"`
	} `xml:"CommandResponse"`
}

type DomainSearchResult struct {
	Domain    string  `json:"domain"`
	Available bool    `json:"available"`
	Price     float64 `json:"price"`
	Premium   bool    `json:"premium"`
}

// CheckMultipleTLDs takes a base brand and returns availability for various TLDs
func (c *NamecheapClient) CheckMultipleTLDs(query string) ([]DomainSearchResult, error) {
	query = strings.ToLower(strings.TrimSpace(query))
	
	// Default popular TLDs to suggest
	tlds := []string{"com", "in", "co.in", "shop", "store", "net", "org", "co", "io", "biz"}
	
	var domains []string
	
	// If the user typed a specific domain (e.g., "mybrand.shop"), check that exact one first
	baseBrand := query
	if strings.Contains(query, ".") {
		domains = append(domains, query)
		parts := strings.SplitN(query, ".", 2)
		baseBrand = parts[0]
	}

	for _, t := range tlds {
		dom := fmt.Sprintf("%s.%s", baseBrand, t)
		// Avoid duplicate if they explicitly typed "brand.com"
		if dom != query {
			domains = append(domains, dom)
		}
	}
	
	domainList := strings.Join(domains, ",")

	reqURL := c.buildBaseURL("namecheap.domains.check") + "&DomainList=" + domainList
	
	// Quick dummy prices for Sandbox (Namecheap sandbox doesn't return prices natively in check)
	c.mu.RLock()
	// Copy prices for the ones we care about
	wholesaleUSD := make(map[string]float64)
	for _, ext := range tlds {
		wholesaleUSD[ext] = c.livePricesUSD[ext]
	}
	// Also get the one the user typed explicitly
	if strings.Contains(query, ".") {
		parts := strings.SplitN(query, ".", 2)
		if len(parts) > 1 {
			wholesaleUSD[parts[1]] = c.livePricesUSD[parts[1]]
		}
	}
	c.mu.RUnlock()

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to call namecheap: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ncResp NCResponse
	xml.Unmarshal(body, &ncResp)

	if ncResp.Status == "ERROR" && len(ncResp.Errors.Error) > 0 {
		return nil, fmt.Errorf("namecheap error: %s", ncResp.Errors.Error[0].Msg)
	}

	results := []DomainSearchResult{}
	for _, res := range ncResp.CommandResponse.DomainCheckResult {
		isAvail := strings.ToLower(res.Available) == "true"
		
		// Extract TLD to find base price
		parts := strings.SplitN(res.Domain, ".", 2)
		ext := "com"
		if len(parts) > 1 {
			ext = parts[1] // covers "co.in" properly because SplitN with 2
		}

		baseUSD := wholesaleUSD[ext]
		if baseUSD == 0 {
			baseUSD = 15.00 // Default fallback price
		}
		
		// Apply 35% commission markup
		finalINR := int((baseUSD * 1.35) * 85.0)

		results = append(results, DomainSearchResult{
			Domain:    res.Domain,
			Available: isAvail,
			Price:     float64(finalINR),
			Premium:   false,
		})
	}
	return results, nil
}

type DomainContact struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Address   string `json:"address"`
	City      string `json:"city"`
	State     string `json:"state"`
	Zip       string `json:"zip"`
	Country   string `json:"country"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
}

// RegisterDomain purchases a domain
func (c *NamecheapClient) RegisterDomain(domain string, contact DomainContact) (string, error) {
	u, _ := url.Parse(c.buildBaseURL("namecheap.domains.create"))
	q := u.Query()
	q.Set("DomainName", domain)
	q.Set("Years", "1")
	
	// Normalize phone to Namecheap format: +CountryCode.Number
	// e.g. "9876543210" => "+91.9876543210", "+919876543210" => "+91.9876543210"
	phone := strings.TrimSpace(contact.Phone)
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if !strings.Contains(phone, ".") {
		// No dot means not in Namecheap format yet
		if strings.HasPrefix(phone, "+91") {
			phone = "+91." + strings.TrimPrefix(phone, "+91")
		} else if strings.HasPrefix(phone, "+") {
			// Generic: split after country code (assume 1-3 digits)
			// Try to find where country code ends
			digits := strings.TrimPrefix(phone, "+")
			if len(digits) > 10 {
				cc := digits[:len(digits)-10]
				num := digits[len(digits)-10:]
				phone = "+" + cc + "." + num
			} else {
				phone = "+1." + digits // fallback to US
			}
		} else if len(phone) == 10 {
			// Bare 10-digit number, assume India
			phone = "+91." + phone
		} else {
			phone = "+1." + phone // fallback
		}
	}

	fields := []string{"Registrant", "Tech", "Admin", "AuxBilling"}
	for _, f := range fields {
		q.Set(f+"FirstName", contact.FirstName)
		q.Set(f+"LastName", contact.LastName)
		q.Set(f+"Address1", contact.Address)
		q.Set(f+"City", contact.City)
		q.Set(f+"StateProvince", contact.State)
		q.Set(f+"PostalCode", contact.Zip)
		q.Set(f+"Country", contact.Country)
		q.Set(f+"Phone", phone)
		q.Set(f+"EmailAddress", contact.Email)
	}

	u.RawQuery = q.Encode()

	resp, err := c.regClient.Get(u.String())
	if err != nil {
		return "", fmt.Errorf("failed to register domain: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ncResp NCResponse
	xml.Unmarshal(body, &ncResp)

	if ncResp.Status == "ERROR" {
		if len(ncResp.Errors.Error) > 0 {
			return "", fmt.Errorf("namecheap registration error: %s", ncResp.Errors.Error[0].Msg)
		}
		return "", fmt.Errorf("unknown namecheap error")
	}

	if strings.ToLower(ncResp.CommandResponse.DomainCreateResult.Registered) != "true" {
		return "", fmt.Errorf("domain not successfully registered")
	}

	return ncResp.CommandResponse.DomainCreateResult.OrderID, nil
}

type NCDnsRecord struct {
	Type  string
	Name  string
	Value string
	TTL   string
}

// GetDNSRecords fetches DNS records
func (c *NamecheapClient) GetDNSRecords(domain string) ([]NCDnsRecord, error) {
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid domain")
	}
	sld := parts[0]
	tld := parts[1]

	u, _ := url.Parse(c.buildBaseURL("namecheap.domains.dns.getHosts"))
	q := u.Query()
	q.Set("SLD", sld)
	q.Set("TLD", tld)
	u.RawQuery = q.Encode()

	resp, err := c.client.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ncResp NCResponse
	xml.Unmarshal(body, &ncResp)

	if ncResp.Status == "ERROR" {
		return []NCDnsRecord{}, nil // Fallback gracefully if zone error
	}

	var records []NCDnsRecord
	for _, h := range ncResp.CommandResponse.DomainDNSGetHostsResult.Host {
		records = append(records, NCDnsRecord{
			Type:  h.Type,
			Name:  h.Name,
			Value: h.Address,
			TTL:   h.TTL,
		})
	}
	return records, nil
}

// AddDNSRecord adds a record
func (c *NamecheapClient) AddDNSRecord(domain string, recordType, name, value string) error {
	// For Namecheap, you have to pass ALL existing records + the new one
	existing, err := c.GetDNSRecords(domain)
	if err != nil {
		existing = []NCDnsRecord{}
	}

	parts := strings.Split(domain, ".")
	sld := parts[0]
	tld := parts[1]

	u, _ := url.Parse(c.buildBaseURL("namecheap.domains.dns.setHosts"))
	q := u.Query()
	q.Set("SLD", sld)
	q.Set("TLD", tld)

	idx := 1
	for _, r := range existing {
		q.Set(fmt.Sprintf("HostName%d", idx), r.Name)
		q.Set(fmt.Sprintf("RecordType%d", idx), r.Type)
		q.Set(fmt.Sprintf("Address%d", idx), r.Value)
		q.Set(fmt.Sprintf("TTL%d", idx), r.TTL)
		idx++
	}

	// Add the new one
	q.Set(fmt.Sprintf("HostName%d", idx), name)
	q.Set(fmt.Sprintf("RecordType%d", idx), recordType)
	q.Set(fmt.Sprintf("Address%d", idx), value)
	q.Set(fmt.Sprintf("TTL%d", idx), "1800")
	
	u.RawQuery = q.Encode()

	resp, err := c.client.Get(u.String())
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ncResp NCResponse
	xml.Unmarshal(body, &ncResp)

	if ncResp.Status == "ERROR" && len(ncResp.Errors.Error) > 0 {
		return fmt.Errorf("namecheap error: %s", ncResp.Errors.Error[0].Msg)
	}

	return nil
}
