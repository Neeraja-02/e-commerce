// Global variables
let currentProducts = [];
let cart = [];

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalSpan = document.getElementById('cart-total');
const subtotalSpan = document.getElementById('subtotal');
const cartCountSpan = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutForm = document.getElementById('checkout-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.dataset.category;
            filterProducts(category);
        });
    });
    
    // Shop now button
    const shopNowBtn = document.querySelector('.shop-now');
    if (shopNowBtn) {
        shopNowBtn.addEventListener('click', () => {
            document.querySelector('.products-grid').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Modal close
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            checkoutModal.style.display = 'none';
        });
    }
    
    // Checkout button
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', showCheckoutModal);
    }
    
    // Checkout form
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === checkoutModal) {
            checkoutModal.style.display = 'none';
        }
    });
    
    // Card number formatting
    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');
    
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', () => formatCardNumber(cardNumberInput));
    }
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', () => formatExpiryDate(cardExpiryInput));
    }
}

// Format card number with spaces
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
    }
    input.value = formatted;
}

// Format expiry date
function formatExpiryDate(input) {
    let value = input.value.replace(/\//g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
        input.value = value.slice(0, 2) + '/' + value.slice(2);
    } else {
        input.value = value;
    }
}

// Payment method handling
function setupPaymentMethods() {
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    const creditCardFields = document.getElementById('credit-card-fields');
    const paypalFields = document.getElementById('paypal-fields');
    const upiFields = document.getElementById('upi-fields');
    const codMessage = document.getElementById('cod-message');
    
    if (paymentRadios.length > 0) {
        paymentRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                // Hide all fields
                if (creditCardFields) creditCardFields.style.display = 'none';
                if (paypalFields) paypalFields.style.display = 'none';
                if (upiFields) upiFields.style.display = 'none';
                if (codMessage) codMessage.style.display = 'none';
                
                // Show selected payment fields
                switch(e.target.value) {
                    case 'credit_card':
                        if (creditCardFields) creditCardFields.style.display = 'block';
                        break;
                    case 'paypal':
                        if (paypalFields) paypalFields.style.display = 'block';
                        break;
                    case 'upi':
                        if (upiFields) upiFields.style.display = 'block';
                        break;
                    case 'cod':
                        if (codMessage) codMessage.style.display = 'block';
                        break;
                }
            });
        });
    }
}

// Load products from API
async function loadProducts() {
    try {
        console.log("Loading products...");
        const response = await fetch('/api/products');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        currentProducts = await response.json();
        console.log("Products loaded:", currentProducts.length);
        
        if (currentProducts.length === 0) {
            if (productsGrid) {
                productsGrid.innerHTML = '<div class="empty-cart">No products found. Please check database.</div>';
            }
        } else {
            renderProducts(currentProducts);
        }
        
    } catch (error) {
        console.error('Error loading products:', error);
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="empty-cart">Failed to load products. Please refresh the page.</div>';
        }
    }
}

// Filter products by category
function filterProducts(category) {
    if (category === 'all') {
        renderProducts(currentProducts);
    } else {
        const filtered = currentProducts.filter(p => p.category === category);
        renderProducts(filtered);
    }
}

// Render products grid
function renderProducts(products) {
    if (!productsGrid) return;
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<div class="empty-cart">No products found.</div>';
        return;
    }
    
    let html = '';
    products.forEach(product => {
        html += `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300?text=Product'">
                </div>
                <div class="product-info">
                    <div class="product-title">${escapeHtml(product.name)}</div>
                    <div class="product-description">${escapeHtml(product.description.substring(0, 80))}...</div>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <button class="add-to-cart" data-id="${product.id}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
    });
    
    productsGrid.innerHTML = html;
    
    // Attach add to cart events
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const productId = parseInt(btn.dataset.id);
            await addToCart(productId);
        });
    });
}

// Add to cart with authentication check
async function addToCart(productId, quantity = 1) {
    try {
        const response = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, quantity: quantity })
        });
        
        if (response.status === 401) {
            showToast('Please login first to add items to cart!', 'error');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }
        
        if (response.ok) {
            await loadCart();
            showToast('Item added to cart!');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Failed to add item to cart', 'error');
    }
}

// Load cart
async function loadCart() {
    try {
        const response = await fetch('/api/cart');
        if (response.status === 401) {
            return;
        }
        cart = await response.json();
        updateCartUI();
        updateCartCount();
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// Update cart UI
function updateCartUI() {
    if (!cartItemsContainer) return;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket fa-3x"></i>
                <p>Your cart is empty</p>
                <a href="/" class="btn-primary">Continue Shopping</a>
            </div>
        `;
        if (cartTotalSpan) cartTotalSpan.textContent = '0.00';
        if (subtotalSpan) subtotalSpan.textContent = '0.00';
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item" data-cart-id="${item.cart_id}">
                <div class="cart-item-image">
                    <i class="fas fa-box"></i>
                </div>
                <div class="cart-item-details">
                    <h4>${escapeHtml(item.name)}</h4>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" data-action="decr">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" data-action="incr">+</button>
                </div>
                <button class="remove-item" data-action="remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = html;
    if (cartTotalSpan) cartTotalSpan.textContent = total.toFixed(2);
    if (subtotalSpan) subtotalSpan.textContent = total.toFixed(2);
    
    // Attach cart action events
    document.querySelectorAll('.cart-item').forEach(cartItemDiv => {
        const cartId = parseInt(cartItemDiv.dataset.cartId);
        
        const incrBtn = cartItemDiv.querySelector('[data-action="incr"]');
        const decrBtn = cartItemDiv.querySelector('[data-action="decr"]');
        const removeBtn = cartItemDiv.querySelector('[data-action="remove"]');
        
        if (incrBtn) incrBtn.addEventListener('click', () => updateQuantity(cartId, 'incr'));
        if (decrBtn) decrBtn.addEventListener('click', () => updateQuantity(cartId, 'decr'));
        if (removeBtn) removeBtn.addEventListener('click', () => removeCartItem(cartId));
    });
}

// Update cart count badge
function updateCartCount() {
    if (!cartCountSpan) return;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountSpan.textContent = totalItems;
}

// Update quantity
async function updateQuantity(cartId, action) {
    const item = cart.find(i => i.cart_id === cartId);
    if (!item) return;
    
    let newQty = item.quantity;
    if (action === 'incr') newQty++;
    else if (action === 'decr') newQty--;
    
    if (newQty <= 0) {
        await removeCartItem(cartId);
    } else {
        try {
            await fetch(`/api/cart/${cartId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });
            await loadCart();
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    }
}

// Remove cart item
async function removeCartItem(cartId) {
    try {
        await fetch(`/api/cart/${cartId}`, { method: 'DELETE' });
        await loadCart();
        showToast('Item removed from cart');
    } catch (error) {
        console.error('Error removing item:', error);
    }
}

// Show checkout modal
function showCheckoutModal() {
    if (cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }
    if (checkoutModal) {
        checkoutModal.style.display = 'flex';
        setupPaymentMethods();
    }
}

// Handle checkout
async function handleCheckout(e) {
    e.preventDefault();
    
    const name = document.getElementById('customer-name')?.value;
    const email = document.getElementById('customer-email')?.value;
    const address = document.getElementById('customer-address')?.value;
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    
    if (!name || !email || !address) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (!paymentMethod) {
        showToast('Please select a payment method', 'error');
        return;
    }
    
    let paymentDetails = {};
    
    if (paymentMethod === 'credit_card') {
        const cardNumber = document.getElementById('card-number')?.value.replace(/\s/g, '');
        const cardExpiry = document.getElementById('card-expiry')?.value;
        const cardCvv = document.getElementById('card-cvv')?.value;
        
        if (!cardNumber || cardNumber.length < 16) {
            showToast('Please enter valid card number', 'error');
            return;
        }
        if (!cardExpiry || cardExpiry.length < 5) {
            showToast('Please enter valid expiry date', 'error');
            return;
        }
        if (!cardCvv || cardCvv.length < 3) {
            showToast('Please enter valid CVV', 'error');
            return;
        }
        
        paymentDetails = { card_number: `****${cardNumber.slice(-4)}`, card_expiry: cardExpiry };
    }
    else if (paymentMethod === 'paypal') {
        const paypalEmail = document.getElementById('paypal-email')?.value;
        if (!paypalEmail) {
            showToast('Please enter PayPal email', 'error');
            return;
        }
        paymentDetails = { paypal_email: paypalEmail };
    }
    else if (paymentMethod === 'upi') {
        const upiId = document.getElementById('upi-id')?.value;
        if (!upiId || !upiId.includes('@')) {
            showToast('Please enter valid UPI ID (e.g., username@bank)', 'error');
            return;
        }
        paymentDetails = { upi_id: upiId };
    }
    
    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                email, 
                address, 
                payment_method: paymentMethod,
                payment_details: paymentDetails
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            checkoutModal.style.display = 'none';
            checkoutForm.reset();
            cart = [];
            updateCartUI();
            updateCartCount();
            showPaymentSuccess(data.order, paymentMethod);
            showToast('Order placed successfully! Cart has been cleared.');
            
            setTimeout(() => {
                window.location.href = '/orders';
            }, 3000);
        } else {
            showToast(data.message || 'Checkout failed', 'error');
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        showToast('Checkout failed. Please try again.', 'error');
    }
}

// Show payment success modal
function showPaymentSuccess(order, paymentMethod) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    let paymentText = '';
    
    switch(paymentMethod) {
        case 'credit_card':
            paymentText = 'Payment processed via Credit Card';
            break;
        case 'paypal':
            paymentText = 'Payment processed via PayPal';
            break;
        case 'upi':
            paymentText = 'Payment processed via UPI';
            break;
        case 'cod':
            paymentText = 'Cash on Delivery - Pay when you receive';
            break;
        default:
            paymentText = 'Order confirmed';
    }
    
    modal.innerHTML = `
        <div class="modal-content payment-success-modal">
            <i class="fas fa-check-circle"></i>
            <h2>Order Confirmed!</h2>
            <p>Thank you for your purchase</p>
            <div class="transaction-id">
                <strong>Order ID:</strong> #${order.id}<br>
                <strong>Total:</strong> $${order.total.toFixed(2)}<br>
                <strong>Payment:</strong> ${paymentText}<br>
                ${order.transaction_id ? `<strong>Transaction ID:</strong> ${order.transaction_id}` : ''}
            </div>
            <button onclick="this.closest('.modal').remove()" class="btn-primary">Continue Shopping</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Load orders (for orders page)
async function loadOrders() {
    const ordersList = document.getElementById('orders-list');
    if (!ordersList) return;
    
    try {
        const response = await fetch('/api/orders');
        if (response.status === 401) {
            ordersList.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-lock fa-3x"></i>
                    <p>Please login to view your orders</p>
                    <a href="/login" class="btn-primary">Login</a>
                </div>
            `;
            return;
        }
        
        const orders = await response.json();
        
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-truck fa-3x"></i>
                    <p>No orders yet</p>
                    <a href="/" class="btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }
        
        let html = '';
        orders.forEach(order => {
            let itemsText = '';
            try {
                const items = JSON.parse(order.items);
                itemsText = items.map(i => `${i.name} (x${i.quantity})`).join(', ');
            } catch(e) {
                itemsText = order.items;
            }
            
            let paymentDisplay = '';
            if (order.payment_method) {
                switch(order.payment_method) {
                    case 'credit_card':
                        paymentDisplay = '💳 Credit Card';
                        break;
                    case 'paypal':
                        paymentDisplay = '💰 PayPal';
                        break;
                    case 'upi':
                        paymentDisplay = '📱 UPI';
                        break;
                    case 'cod':
                        paymentDisplay = '💵 Cash on Delivery';
                        break;
                    default:
                        paymentDisplay = order.payment_method;
                }
            } else {
                paymentDisplay = 'Payment completed';
            }
            
            html += `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-id">Order #${order.id}</span>
                        <span class="order-total">$${order.total.toFixed(2)}</span>
                    </div>
                    <div class="order-date">
                        <i class="far fa-calendar-alt"></i> ${new Date(order.order_date).toLocaleDateString()}
                    </div>
                    <div class="order-address">
                        <i class="fas fa-location-dot"></i> ${escapeHtml(order.address)}
                    </div>
                    <div class="payment-badge">
                        <i class="fas fa-credit-card"></i> ${paymentDisplay}
                        ${order.transaction_id ? `<br><small>Transaction: ${order.transaction_id}</small>` : ''}
                    </div>
                    <div class="order-items">
                        <strong>Items:</strong> ${escapeHtml(itemsText)}
                    </div>
                </div>
            `;
        });
        
        ordersList.innerHTML = html;
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersList.innerHTML = '<div class="empty-cart">Failed to load orders</div>';
    }
}

// Helper: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Helper: Show toast notification
function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#0f172a';
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Load orders if on orders page
if (window.location.pathname === '/orders') {
    document.addEventListener('DOMContentLoaded', loadOrders);
}

// Reload cart when on cart page
if (window.location.pathname === '/cart') {
    document.addEventListener('DOMContentLoaded', () => {
        loadCart();
    });
}