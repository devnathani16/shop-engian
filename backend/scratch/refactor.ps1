$replaceDB = @"
	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	shopID := shop.ID
"@

$files = Get-ChildItem -Path . -Filter *.go
foreach ($file in $files) {
    if ($file.Name -eq "middleware.go" -or $file.Name -eq "rbac.go") { continue }
    
    $content = [IO.File]::ReadAllText($file.FullName)
    
    $patternDB = '(?ms)^\s*var shop Shop\r?\n\s*if err := db\.Where\("id = \? AND user_id = \?", shopID, user\.ID\)\.First\(&shop\)\.Error; err != nil \{.*?\r?\n\s*\}\r?\n'
    
    if ($content -match $patternDB) {
        $content = $content -replace $patternDB, ($replaceDB + "`r`n")
        
        $patternUser1 = '(?ms)^\s*userInterface, _ := c\.Get\("user"\)\r?\n\s*user := userInterface\.\(User\)\r?\n'
        $content = $content -replace $patternUser1, ""
        
        $patternUser2 = '(?ms)^\s*userInterface, exists := c\.Get\("user"\)\r?\n\s*if !exists \{.*?\r?\n\s*\}\r?\n\s*user := userInterface\.\(User\)\r?\n'
        $content = $content -replace $patternUser2, ""

        $patternShopID = '(?m)^\s*shopID := c\.Param\("id"\)\r?\n'
        $content = $content -replace $patternShopID, ""

        [IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated $($file.Name)"
    }
}
