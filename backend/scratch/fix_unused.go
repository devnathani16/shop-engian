package main

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
)

func main() {
	files, err := filepath.Glob("*.go")
	if err != nil {
		panic(err)
	}
	for _, file := range files {
		content, err := ioutil.ReadFile(file)
		if err != nil {
			panic(err)
		}
		str := string(content)
		if strings.Contains(str, "shopID := shop.ID") {
			// replace only if not already done
			if !strings.Contains(str, "_ = shopID") {
				str = strings.ReplaceAll(str, "shopID := shop.ID", "shopID := shop.ID\n\t_ = shopID")
				ioutil.WriteFile(file, []byte(str), 0644)
				fmt.Printf("Fixed unused shopID in %s\n", file)
			}
		}
	}
}
