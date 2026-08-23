import os
import re
import shutil

backend_dir = r"F:\shop.me\backend"
go_module = "eaas-backend"

# 1. Define folder mappings
folders = {
    "models": ["models.go"],
    "database": [], # We will create database.go manually
    "config": ["config.go"],
    "domains": ["domain_api.go", "namecheap.go"],
    "payments": [f for f in os.listdir(backend_dir) if f.startswith("payment_") and f.endswith(".go")],
    "shipping": ["shipping_api.go", "shipping_carriers.go", "shipping_rules.go", "shiprocket.go", "binpacking.go"],
    "taxes": ["tax.go", "tax_api.go"],
    "ai": ["ai_features.go", "ai_search.go", "ai_theme.go", "aiml_client.go", "inventory_ai.go"],
    "core": ["crypto.go", "currency.go", "email_templates.go", "media.go", "events.go", "middleware.go", "rbac.go", "tenant_manager.go", "webhooks.go", "graphql.go"],
    "store": ["catalog.go", "checkout.go", "customer.go", "discounts.go", "orders.go", "theme.go"],
}

# Add any missed go files to core except main.go
assigned_files = set([f for group in folders.values() for f in group])
assigned_files.add("main.go")
for f in os.listdir(backend_dir):
    if f.endswith(".go") and f not in assigned_files:
        folders["core"].append(f)

# 2. Extract structs from models.go
models_path = os.path.join(backend_dir, "models.go")
with open(models_path, "r", encoding="utf-8") as f:
    models_content = f.read()

structs = re.findall(r"type\s+([A-Z]\w+)\s+", models_content)
# Filter out some generic types if needed, but [A-Z] usually means exported struct
struct_set = set(structs)

# 3. Create database.go to hold DB global
os.makedirs(os.path.join(backend_dir, "database"), exist_ok=True)
with open(os.path.join(backend_dir, "database", "database.go"), "w", encoding="utf-8") as f:
    f.write("package database\n\nimport \"gorm.io/gorm\"\n\nvar DB *gorm.DB\n")

# 4. Refactor and Move files
def process_file(filepath, pkg_name):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Change package name
    content = re.sub(r"^package main\b", f"package {pkg_name}", content, flags=re.MULTILINE)
    
    # Capitalize handler functions (handleX -> HandleX)
    content = re.sub(r"func\s+handle([A-Z]\w+)", r"func Handle\1", content)
    
    # Replace `db.` with `database.DB.`
    content = re.sub(r"\bdb\.", "database.DB.", content)
    # If the file had `var db *gorm.DB` or similar, we should remove it (mostly in main.go)
    
    # Replace models
    for struct in struct_set:
        # Regex to match struct name but not if it's already models.Struct or part of another word
        # Needs to handle pointers `*Struct`, slices `[]Struct`, function args `s Struct`, variables `var s Struct`
        content = re.sub(rf"(?<![\w\.])({struct})(?![\w])", rf"models.\1", content)
        
    # AppConfig replacements
    if pkg_name != "config":
        content = re.sub(r"(?<![\w\.])AppConfig(?![\w])", "config.AppConfig", content)
        
    # NCClient replacements
    if pkg_name != "domains":
        content = re.sub(r"(?<![\w\.])NCClient(?![\w])", "domains.NCClient", content)
        
    # Add imports
    imports_to_add = []
    if "models." in content and pkg_name != "models":
        imports_to_add.append(f'"{go_module}/models"')
    if "database.DB" in content and pkg_name != "database":
        imports_to_add.append(f'"{go_module}/database"')
    if "config." in content and pkg_name != "config":
        imports_to_add.append(f'"{go_module}/config"')
    if "domains." in content and pkg_name != "domains":
        imports_to_add.append(f'"{go_module}/domains"')
        
    if imports_to_add:
        # Find the import block or add one
        if "import (" in content:
            # Add to existing import block
            import_str = "\n\t".join(imports_to_add) + "\n"
            content = content.replace("import (", f"import (\n\t{import_str}", 1)
        else:
            # Create import block
            import_str = "\n".join(imports_to_add)
            content = re.sub(r"(^package \w+\n)", f"\\1\nimport (\n\t{import_str}\n)\n", content, flags=re.MULTILINE)

    return content

for pkg_name, files in folders.items():
    if not files: continue
    pkg_dir = os.path.join(backend_dir, pkg_name)
    os.makedirs(pkg_dir, exist_ok=True)
    
    for file in files:
        old_path = os.path.join(backend_dir, file)
        if not os.path.exists(old_path): continue
        
        new_content = process_file(old_path, pkg_name)
        new_path = os.path.join(pkg_dir, file)
        
        with open(new_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        
        # Remove original
        os.remove(old_path)

# 5. Fix up main.go
main_path = os.path.join(backend_dir, "main.go")
with open(main_path, "r", encoding="utf-8") as f:
    main_content = f.read()

# main.go needs to import all these packages and call their Handlers
# This is tricky because we renamed handleX to HandleX, and now they belong to packages (store.HandleX).
# Let's use regex to prefix the handlers in the gin router in main.go
packages = [p for p in folders.keys() if p not in ("models", "database", "config")]
# We'll just manually try to build and fix errors iteratively, it's safer than perfect regexing.

# Fix main.go DB init
main_content = re.sub(r"var db \*gorm\.DB\n", "", main_content)
main_content = re.sub(r"db,\s*err\s*=\s*gorm\.Open", "database.DB, err = gorm.Open", main_content)
main_content = re.sub(r"db\.", "database.DB.", main_content)
main_content = re.sub(r"InitNamecheap\(\)", "domains.InitNamecheap()", main_content)
main_content = re.sub(r"InitConfig\(\)", "config.InitConfig()", main_content)

for struct in struct_set:
    main_content = re.sub(rf"(?<![\w\.])({struct})(?![\w])", rf"models.\1", main_content)
    
# Save main.go
with open(main_path, "w", encoding="utf-8") as f:
    f.write(main_content)
