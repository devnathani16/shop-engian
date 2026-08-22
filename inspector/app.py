import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
import mysql.connector

class EaaSInspectorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("EaaS Database Inspector")
        self.root.geometry("1000x600")
        
        print("Starting EaaS Inspector App...")
        # Connection
        self.db_conn = None
        self.cursor = None
        print("Connecting to MySQL...")
        self.connect_to_mysql()

        print("Setting up UI...")
        self.setup_ui()
        print("Loading databases...")
        self.load_databases()
        print("Initialization complete.")

    def connect_to_mysql(self):
        try:
            self.db_conn = mysql.connector.connect(
                host="127.0.0.1",
                user="root",
                password="root"
            )
            self.cursor = self.db_conn.cursor(dictionary=True)
            print("Successfully connected to MySQL.")
        except Exception as e:
            print(f"Error connecting to MySQL: {e}")
            messagebox.showerror("Connection Error", f"Could not connect to MySQL: {e}")
            self.root.destroy()

    def setup_ui(self):
        # Create PanedWindow
        self.paned_window = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Left Frame: Explorer
        self.left_frame = ttk.Frame(self.paned_window, width=250)
        self.paned_window.add(self.left_frame, weight=1)
        
        # Right Frame: Data Viewer
        self.right_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(self.right_frame, weight=4)

        # Setup Explorer Treeview
        self.explorer_tree = ttk.Treeview(self.left_frame, selectmode="browse")
        self.explorer_tree.heading("#0", text="Databases", anchor=tk.W)
        self.explorer_tree.pack(fill=tk.BOTH, expand=True)
        self.explorer_tree.bind("<<TreeviewOpen>>", self.on_tree_expand)
        self.explorer_tree.bind("<<TreeviewSelect>>", self.on_tree_select)

        # Setup Data Treeview
        self.data_tree = ttk.Treeview(self.right_frame, show="headings")
        self.data_scroll_y = ttk.Scrollbar(self.right_frame, orient="vertical", command=self.data_tree.yview)
        self.data_scroll_x = ttk.Scrollbar(self.right_frame, orient="horizontal", command=self.data_tree.xview)
        
        self.data_tree.configure(yscrollcommand=self.data_scroll_y.set, xscrollcommand=self.data_scroll_x.set)
        
        self.data_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.data_scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.data_tree.pack(fill=tk.BOTH, expand=True)

    def load_databases(self):
        try:
            self.cursor.execute("SHOW DATABASES")
            databases = self.cursor.fetchall()
            
            for db_dict in databases:
                db_name = db_dict['Database']
                if db_name.startswith("eaas_"):
                    # Insert db node with a dummy child to enable expansion (+)
                    node_id = self.explorer_tree.insert("", tk.END, text=db_name, values=("db", db_name))
                    self.explorer_tree.insert(node_id, tk.END, text="dummy")
                    
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load databases: {e}")

    def on_tree_expand(self, event):
        item_id = self.explorer_tree.focus()
        item_values = self.explorer_tree.item(item_id, "values")
        
        if not item_values or item_values[0] != "db":
            return
            
        db_name = item_values[1]
        
        # Remove dummy child
        children = self.explorer_tree.get_children(item_id)
        if len(children) == 1 and self.explorer_tree.item(children[0], "text") == "dummy":
            self.explorer_tree.delete(children[0])
            
            # Load tables
            try:
                self.cursor.execute(f"SHOW TABLES FROM `{db_name}`")
                tables = self.cursor.fetchall()
                for table_dict in tables:
                    # The key is something like 'Tables_in_eaas_core'
                    table_name = list(table_dict.values())[0]
                    self.explorer_tree.insert(item_id, tk.END, text=table_name, values=("table", db_name, table_name))
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load tables for {db_name}: {e}")

    def on_tree_select(self, event):
        item_id = self.explorer_tree.focus()
        item_values = self.explorer_tree.item(item_id, "values")
        
        if not item_values or item_values[0] != "table":
            return
            
        db_name = item_values[1]
        table_name = item_values[2]
        
        self.load_table_data(db_name, table_name)

    def load_table_data(self, db_name, table_name):
        # Clear existing data
        self.data_tree.delete(*self.data_tree.get_children())
        
        try:
            # Get columns
            self.cursor.execute(f"SHOW COLUMNS FROM `{db_name}`.`{table_name}`")
            columns = [col['Field'] for col in self.cursor.fetchall()]
            
            # Configure Data Treeview columns
            self.data_tree["columns"] = columns
            for col in columns:
                self.data_tree.heading(col, text=col)
                self.data_tree.column(col, width=120, anchor=tk.W)
                
            # Get Data
            self.cursor.execute(f"SELECT * FROM `{db_name}`.`{table_name}` LIMIT 100")
            rows = self.cursor.fetchall()
            
            for row in rows:
                # Extract values in the correct order
                values = [row[col] for col in columns]
                self.data_tree.insert("", tk.END, values=values)
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load data from {table_name}: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    
    # Optional: Apply a cleaner theme if available (like clam)
    style = ttk.Style()
    if 'clam' in style.theme_names():
        style.theme_use('clam')
        
    app = EaaSInspectorApp(root)
    root.mainloop()
