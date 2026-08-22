package main

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"regexp"
)

func main() {
	files, err := filepath.Glob("*.go")
	if err != nil {
		panic(err)
	}

	dbPattern := regexp.MustCompile(`(?ms)[ \t]*var shop Shop\r?\n[ \t]*if err := db\.Where\("id = \? AND user_id = \?", shopID, user\.ID\)\.First\(&shop\)\.Error; err != nil \{.*?\r?\n[ \t]*return\r?\n[ \t]*\}\r?\n`)

	replacement := `	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	_ = shop.ID
`

	userPattern1 := regexp.MustCompile(`(?ms)[ \t]*userInterface, _ := c\.Get\("user"\)\r?\n[ \t]*user := userInterface\.\(User\)\r?\n`)
	userPattern2 := regexp.MustCompile(`(?ms)[ \t]*userInterface, exists := c\.Get\("user"\)\r?\n[ \t]*if !exists \{.*?\r?\n[ \t]*\}\r?\n[ \t]*user := userInterface\.\(User\)\r?\n`)
	shopIDPattern := regexp.MustCompile(`(?m)^[ \t]*shopID := c\.Param\("id"\)\r?\n`)

	for _, file := range files {
		if file == "middleware.go" || file == "rbac.go" {
			continue
		}

		content, err := ioutil.ReadFile(file)
		if err != nil {
			panic(err)
		}
		str := string(content)

		if file == "main.go" {
			// Update route registrations: api.METHOD("/shops/:id...", handler) -> api.METHOD("/shops/:id...", RequireShopPermission("*"), handler)
			// But avoid modifying already wrapped ones.
			routeRegex := regexp.MustCompile(`(api\.(?:GET|POST|PUT|DELETE)\("/shops/:id(?:/[^"]*)?", )([a-zA-Z0-9_]+)\)`)
			str = routeRegex.ReplaceAllString(str, `${1}RequireShopPermission("*"), ${2})`)

			// also shopRoutes
			shopRoutesRegex := regexp.MustCompile(`(shopRoutes\.(?:GET|POST|PUT|DELETE)\("/:id(?:/[^"]*)?", )([a-zA-Z0-9_]+)\)`)
			str = shopRoutesRegex.ReplaceAllString(str, `${1}RequireShopPermission("*"), ${2})`)
		}

		if dbPattern.MatchString(str) {
			str = dbPattern.ReplaceAllString(str, replacement)
			str = userPattern1.ReplaceAllString(str, "")
			str = userPattern2.ReplaceAllString(str, "")
			str = shopIDPattern.ReplaceAllString(str, "")
		}

		err = ioutil.WriteFile(file, []byte(str), 0644)
		if err != nil {
			panic(err)
		}
		fmt.Printf("Updated %s\n", file)
	}
}
