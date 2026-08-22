package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUser              string
	DBPass              string
	DBHost              string
	JWTSecret           string
	EncryptionMasterKey string
	ResendAPIKey        string
	ImageKitPrivateKey  string
	ImageKitPublicKey   string
	ImageKitURLEndpoint string
}

var AppConfig *Config

// LoadConfig loads the environment variables and panics if required ones are missing
func LoadConfig() {
	// Attempt to load .env file, but don't fail if it doesn't exist (e.g. in production)
	_ = godotenv.Load()

	AppConfig = &Config{
		DBUser:              os.Getenv("DB_USER"),
		DBPass:              os.Getenv("DB_PASS"),
		DBHost:              os.Getenv("DB_HOST"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		EncryptionMasterKey: os.Getenv("ENCRYPTION_MASTER_KEY"),
		ResendAPIKey:        os.Getenv("RESEND_API_KEY"),
		ImageKitPrivateKey:  os.Getenv("IMAGEKIT_PRIVATE_KEY"),
		ImageKitPublicKey:   os.Getenv("IMAGEKIT_PUBLIC_KEY"),
		ImageKitURLEndpoint: os.Getenv("IMAGEKIT_URL_ENDPOINT"),
	}

	// Provide sensible defaults for local development database connection if missing
	if AppConfig.DBUser == "" {
		AppConfig.DBUser = "root"
	}
	if AppConfig.DBPass == "" {
		AppConfig.DBPass = "root"
	}
	if AppConfig.DBHost == "" {
		AppConfig.DBHost = "127.0.0.1:3306"
	}

	// Fail-closed validation for strictly required secrets
	if AppConfig.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required but not set")
	}

	if len(AppConfig.EncryptionMasterKey) != 32 {
		log.Fatalf("ENCRYPTION_MASTER_KEY must be exactly 32 bytes (got %d bytes)", len(AppConfig.EncryptionMasterKey))
	}

	if AppConfig.ResendAPIKey == "" {
		log.Fatal("RESEND_API_KEY is required but not set")
	}

	if AppConfig.ImageKitPrivateKey == "" || AppConfig.ImageKitPublicKey == "" || AppConfig.ImageKitURLEndpoint == "" {
		log.Fatal("All IMAGEKIT variables (PRIVATE_KEY, PUBLIC_KEY, URL_ENDPOINT) are required")
	}
}
