import sqlite3
import json
import os
from datetime import datetime
import hashlib
import uuid

# Get the absolute path for the database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)
DATABASE = os.path.join(INSTANCE_DIR, 'ecommerce.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    """Initialize database with tables and sample data"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            image TEXT,
            category TEXT,
            stock INTEGER DEFAULT 10
        )
    ''')
    
    # Create cart table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    ''')
    
    # Create orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            customer_name TEXT,
            email TEXT,
            address TEXT,
            total REAL,
            items TEXT,
            order_date TEXT,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Create payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            payment_method TEXT,
            payment_status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            payment_date TEXT,
            card_number TEXT,
            upi_id TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )
    ''')
    
    # Check if products table is empty
    cursor.execute('SELECT COUNT(*) FROM products')
    if cursor.fetchone()[0] == 0:
        # Insert sample products
        sample_products = [
            ('Wireless Headphones', 79.99, 'Premium sound quality, noise cancelling, 20hr battery', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300', 'Electronics', 15),
            ('Smart Watch', 199.99, 'Fitness tracker, heart rate monitor, GPS', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300', 'Electronics', 10),
            ('Cotton T-Shirt', 24.99, '100% soft cotton, available in multiple colors', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300', 'Clothing', 30),
            ('Coffee Mug', 12.99, 'Ceramic, 15oz, dishwasher safe', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=300', 'Home', 50),
            ('Backpack', 49.99, 'Water resistant, laptop compartment, durable', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300', 'Accessories', 20),
            ('Desk Lamp', 34.99, 'LED, adjustable brightness, modern design', 'https://tse1.mm.bing.net/th/id/OIP.E_QKtwLRH3fPh_1p0XFHuQHaHa?pid=Api&P=0&h=180', 'Home', 25),
            ('Running Shoes', 89.99, 'Lightweight, cushioned sole, breathable mesh', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300', 'Clothing', 12),
            ('Wireless Mouse', 29.99, 'Ergonomic, silent clicks, 2 year battery', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300', 'Electronics', 40),
        ]
        cursor.executemany('INSERT INTO products (name, price, description, image, category, stock) VALUES (?, ?, ?, ?, ?, ?)', sample_products)
        print("Sample products added!")
    
    conn.commit()
    conn.close()
    print(f"Database initialized successfully at: {DATABASE}")

class UserModel:
    @staticmethod
    def create_user(username, email, password):
        conn = get_db()
        try:
            hashed_pw = hash_password(password)
            cursor = conn.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                (username, email, hashed_pw)
            )
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()
            return {'id': user_id, 'username': username, 'email': email}
        except sqlite3.IntegrityError:
            conn.close()
            return None
        except Exception as e:
            conn.close()
            print(f"Error creating user: {e}")
            return None
    
    @staticmethod
    def authenticate_user(username, password):
        conn = get_db()
        try:
            hashed_pw = hash_password(password)
            user = conn.execute(
                'SELECT * FROM users WHERE username = ? AND password = ?',
                (username, hashed_pw)
            ).fetchone()
            conn.close()
            return dict(user) if user else None
        except Exception as e:
            conn.close()
            print(f"Authentication error: {e}")
            return None
    
    @staticmethod
    def get_user_by_id(user_id):
        conn = get_db()
        user = conn.execute('SELECT id, username, email FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        return dict(user) if user else None

class ProductModel:
    @staticmethod
    def get_all():
        conn = get_db()
        products = conn.execute('SELECT * FROM products').fetchall()
        conn.close()
        return [dict(product) for product in products]
    
    @staticmethod
    def get_by_id(product_id):
        conn = get_db()
        product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        conn.close()
        return dict(product) if product else None
    
    @staticmethod
    def get_by_category(category):
        conn = get_db()
        products = conn.execute('SELECT * FROM products WHERE category = ?', (category,)).fetchall()
        conn.close()
        return [dict(product) for product in products]

class CartModel:
    @staticmethod
    def get_cart(user_id):
        conn = get_db()
        cart_items = conn.execute('''
            SELECT cart.id as cart_id, cart.product_id, cart.quantity, 
                   products.name, products.price, products.image, products.stock
            FROM cart 
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        ''', (user_id,)).fetchall()
        conn.close()
        return [dict(item) for item in cart_items]
    
    @staticmethod
    def add_item(user_id, product_id, quantity=1):
        conn = get_db()
        existing = conn.execute(
            'SELECT * FROM cart WHERE user_id = ? AND product_id = ?', 
            (user_id, product_id)
        ).fetchone()
        
        if existing:
            conn.execute(
                'UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
                (quantity, user_id, product_id)
            )
        else:
            conn.execute(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                (user_id, product_id, quantity)
            )
        conn.commit()
        conn.close()
        return True
    
    @staticmethod
    def update_quantity(user_id, cart_id, quantity):
        conn = get_db()
        if quantity <= 0:
            conn.execute('DELETE FROM cart WHERE id = ? AND user_id = ?', (cart_id, user_id))
        else:
            conn.execute('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?', (quantity, cart_id, user_id))
        conn.commit()
        conn.close()
        return True
    
    @staticmethod
    def remove_item(user_id, cart_id):
        conn = get_db()
        conn.execute('DELETE FROM cart WHERE id = ? AND user_id = ?', (cart_id, user_id))
        conn.commit()
        conn.close()
        return True
    
    @staticmethod
    def clear_cart(user_id):
        conn = get_db()
        conn.execute('DELETE FROM cart WHERE user_id = ?', (user_id,))
        conn.commit()
        conn.close()
        return True

class OrderModel:
    @staticmethod
    def create_order(user_id, customer_name, email, address, payment_method, payment_details):
        conn = get_db()
        cart_items = conn.execute('''
            SELECT cart.product_id, cart.quantity, products.name, products.price
            FROM cart 
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        ''', (user_id,)).fetchall()
        
        if not cart_items:
            conn.close()
            return None
        
        total = sum(item['price'] * item['quantity'] for item in cart_items)
        items_json = json.dumps([dict(item) for item in cart_items])
        order_date = datetime.now().isoformat()
        
        # Insert order
        cursor = conn.execute('''
            INSERT INTO orders (user_id, customer_name, email, address, total, items, order_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, customer_name, email, address, total, items_json, order_date, 'pending'))
        
        order_id = cursor.lastrowid
        
        # Insert payment record
        transaction_id = str(uuid.uuid4())[:8] if payment_method != 'cod' else None
        conn.execute('''
            INSERT INTO payments (order_id, payment_method, payment_status, transaction_id, payment_date, card_number, upi_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            order_id, 
            payment_method, 
            'completed' if payment_method != 'cod' else 'pending',
            transaction_id,
            datetime.now().isoformat() if payment_method != 'cod' else None,
            payment_details.get('card_number') if payment_method == 'credit_card' else None,
            payment_details.get('upi_id') if payment_method == 'upi' else None
        ))
        
        # IMPORTANT: Clear the cart after successful order
        conn.execute('DELETE FROM cart WHERE user_id = ?', (user_id,))
        
        conn.commit()
        conn.close()
        
        return {'id': order_id, 'total': total, 'payment_method': payment_method, 'transaction_id': transaction_id}
    
    @staticmethod
    def get_user_orders(user_id):
        conn = get_db()
        orders = conn.execute('''
            SELECT orders.*, payments.payment_method, payments.payment_status, payments.transaction_id
            FROM orders 
            LEFT JOIN payments ON orders.id = payments.order_id
            WHERE orders.user_id = ? 
            ORDER BY orders.order_date DESC
        ''', (user_id,)).fetchall()
        conn.close()
        return [dict(order) for order in orders]

# Initialize database when module is imported
init_db()