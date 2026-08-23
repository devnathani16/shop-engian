package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const namecheapSandboxURL = "https://api.sandbox.namecheap.com/xml.response"

type NamecheapClient struct {
	ApiUser  string
	ApiKey   string
	UserName string
	ClientIP string
	client   *http.Client
	regClient *http.Client
}

var NCClient *NamecheapClient

func InitNamecheap() {
	NCClient = &NamecheapClient{
		ApiUser:  AppConfig.NamecheapApiUser,
		ApiKey:   AppConfig.NamecheapApiKey,
		UserName: AppConfig.NamecheapUserName,
		ClientIP: AppConfig.NamecheapClientIP,
		client:   &http.Client{Timeout: 10 * time.Second},
		regClient: &http.Client{Timeout: 45 * time.Second},
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

// CheckMultipleTLDs takes a base brand and returns availability for .com, .net, .org, .io, .in
func (c *NamecheapClient) CheckMultipleTLDs(brand string) ([]DomainSearchResult, error) {
	tlds := []string{"com", "net", "org", "io", "in"}
	var domains []string
	for _, t := range tlds {
		domains = append(domains, fmt.Sprintf("%s.%s", brand, t))
	}
	domainList := strings.Join(domains, ",")

	reqURL := c.buildBaseURL("namecheap.domains.check") + "&DomainList=" + domainList
	
	// Quick dummy prices for Sandbox (Namecheap sandbox doesn't return prices natively in check)
	wholesaleUSD := map[string]float64{
		"com": 9.29,
		"net": 10.98,
		"org": 10.98,
		"io":  32.00,
		"in":  8.00,
	}

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
		
		parts := strings.Split(res.Domain, ".")
		ext := "com"
		if len(parts) > 1 {
			ext = parts[len(parts)-1]
		}

		baseUSD := wholesaleUSD[ext]
		if baseUSD == 0 {
			baseUSD = 15.00
		}
		
		finalINR := int((baseUSD * 1.20) * 85.0)

		results = append(results, DomainSearchResult{
			Domain:    res.Domain,
			Available: isAvail,
			Price:     float64(finalINR),
			Premium:   false,
		})
	}
	return results, nil
}

// RegisterDomain purchases a domain
func (c *NamecheapClient) RegisterDomain(domain string) (string, error) {
	u, _ := url.Parse(c.buildBaseURL("namecheap.domains.create"))
	q := u.Query()
	q.Set("DomainName", domain)
	q.Set("Years", "1")
	
	// Namecheap requires extensive contact info to register
	// We'll use mock data for the Sandbox
	fields := []string{"Registrant", "Tech", "Admin", "AuxBilling"}
	for _, f := range fields {
		q.Set(f+"FirstName", "Sandbox")
		q.Set(f+"LastName", "User")
		q.Set(f+"Address1", "123 Sandbox St")
		q.Set(f+"City", "Los Angeles")
		q.Set(f+"StateProvince", "CA")
		q.Set(f+"PostalCode", "90001")
		q.Set(f+"Country", "US")
		q.Set(f+"Phone", "+1.5555555555")
		q.Set(f+"EmailAddress", "sandbox@example.com")
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
