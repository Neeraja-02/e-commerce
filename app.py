from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from database import ProductModel, CartModel, OrderModel, UserModel
import webbrowser
import threading
import time
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'

# Authentication middleware
def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Please login first'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Routes for pages
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/cart')
def cart():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('cart.html')

@app.route('/orders')
def orders():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('orders.html')

# API Routes
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'All fields are required'}), 400
        
        user = UserModel.create_user(username, email, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'user': user})
        else:
            return jsonify({'success': False, 'message': 'Username or email already exists'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
        user = UserModel.authenticate_user(username, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        return jsonify({'authenticated': True, 'username': session['username']})
    return jsonify({'authenticated': False})

@app.route('/api/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    if category and category != 'all':
        products = ProductModel.get_by_category(category)
    else:
        products = ProductModel.get_all()
    return jsonify(products)

@app.route('/api/cart', methods=['GET'])
@login_required
def get_cart():
    cart_items = CartModel.get_cart(session['user_id'])
    return jsonify(cart_items)

@app.route('/api/cart', methods=['POST'])
@login_required
def add_to_cart():
    data = request.json
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)
    CartModel.add_item(session['user_id'], product_id, quantity)
    return jsonify({'success': True, 'message': 'Item added to cart'})

@app.route('/api/cart/<int:cart_id>', methods=['PUT'])
@login_required
def update_cart_item(cart_id):
    data = request.json
    quantity = data.get('quantity')
    CartModel.update_quantity(session['user_id'], cart_id, quantity)
    return jsonify({'success': True, 'message': 'Cart updated'})

@app.route('/api/cart/<int:cart_id>', methods=['DELETE'])
@login_required
def remove_cart_item(cart_id):
    CartModel.remove_item(session['user_id'], cart_id)
    return jsonify({'success': True, 'message': 'Item removed'})

@app.route('/api/cart/clear', methods=['DELETE'])
@login_required
def clear_cart():
    CartModel.clear_cart(session['user_id'])
    return jsonify({'success': True, 'message': 'Cart cleared'})

@app.route('/api/checkout', methods=['POST'])
@login_required
def checkout():
    try:
        data = request.json
        order = OrderModel.create_order(
            session['user_id'],
            data.get('name'),
            data.get('email'),
            data.get('address'),
            data.get('payment_method', 'cod'),
            data.get('payment_details', {})
        )
        
        if order:
            return jsonify({'success': True, 'order': order, 'clear_cart': True})
        else:
            return jsonify({'success': False, 'message': 'Cart is empty'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/orders', methods=['GET'])
@login_required
def get_orders():
    orders = OrderModel.get_user_orders(session['user_id'])
    return jsonify(orders)

# This is the key part - it opens Chrome automatically
if __name__ == '__main__':
    # Open Chrome after 2 seconds
    def open_chrome():
        time.sleep(2)
        webbrowser.open('http://localhost:5000')
    
    # Start the browser opening in background
    threading.Thread(target=open_chrome, daemon=True).start()
    
    # Run the app
    app.run(debug=True, port=5000, use_reloader=False)