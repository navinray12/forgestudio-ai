// runtime.js for the static bundle (client-side behaviour of the published widgets). Moved verbatim from
// staticCompiler.ts.

export function generateRuntimeJs(): string {
  return `/* ForgeStudio Static Runtime */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Intercept form submissions for ForgeStudio API integration
    document.querySelectorAll('form').forEach(function(form) {
      form.addEventListener('submit', async function(e) {
        var action = form.getAttribute('action') || '';
        if (action.indexOf('/api/forms/submit') !== -1) {
          e.preventDefault();
          var submitBtn = form.querySelector('button[type="submit"]');
          var originalBtnText = submitBtn ? submitBtn.innerText : '';
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Submitting...';
          }
          var statusBox = form.querySelector('.fs-form-status');
          if (statusBox) {
            statusBox.style.display = 'none';
          }

          var formData = new FormData(form);
          var data = {};
          var websiteId = formData.get('websiteId') || '';
          var formId = formData.get('formId') || form.id || '';
          var honeypotValue = formData.get('_fs_hp_check') || '';

          formData.forEach(function(val, key) {
            if (key !== 'websiteId' && key !== 'formId' && key !== '_fs_hp_check') {
              data[key] = val;
            }
          });

          var payload = {
            websiteId: String(websiteId),
            formId: String(formId),
            data: data,
            honeypotValue: String(honeypotValue)
          };

          try {
            var response = await fetch('/api/forms/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            var result = await response.json();
            if (response.ok && result.success !== false) {
              if (statusBox) {
                statusBox.textContent = result.message || 'Thank you! Your submission has been received.';
                statusBox.style.display = 'block';
                statusBox.style.color = '#155724';
                statusBox.style.backgroundColor = '#d4edda';
                statusBox.style.border = '1px solid #c3e6cb';
              }
              form.reset();
              var redirectUrl = form.getAttribute('data-redirect') || result.redirectUrl;
              if (redirectUrl) {
                setTimeout(function() {
                  window.location.href = redirectUrl;
                }, 1000);
              }
            } else {
              throw new Error(result.error || result.message || 'Submission failed');
            }
          } catch (err) {
            if (statusBox) {
              statusBox.textContent = err.message || 'An error occurred. Please try again.';
              statusBox.style.display = 'block';
              statusBox.style.color = '#721c24';
              statusBox.style.backgroundColor = '#f8d7da';
              statusBox.style.border = '1px solid #f5c6cb';
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = originalBtnText;
            }
          }
        }
      });
    });
  });

  // Standalone Client-Side E-Commerce Store Engine
  var CART_KEY = 'fs_static_cart';
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}
    updateCartBadges();
    renderCartTable();
    renderCheckoutReview();
  }
  function updateCartBadges() {
    var cart = getCart();
    var count = cart.reduce(function(acc, item) { return acc + (item.quantity || 1); }, 0);
    document.querySelectorAll('.fs-cart-count').forEach(function(el) {
      el.textContent = String(count);
    });
  }
  function renderCartTable() {
    var tbody = document.getElementById('fs-cart-tbody');
    var subtotalEl = document.getElementById('fs-cart-subtotal');
    if (!tbody) return;
    var cart = getCart();
    if (cart.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px;">Your cart is currently empty.</td></tr>';
      if (subtotalEl) subtotalEl.textContent = '$0.00';
      return;
    }
    var total = 0;
    var html = '';
    cart.forEach(function(item, index) {
      var itemTotal = (item.price || 0) * (item.quantity || 1);
      total += itemTotal;
      html += '<tr>' +
        '<td><strong>' + (item.title || 'Product') + '</strong>' + (item.options ? '<br><small style="color: #64748b;">' + item.options + '</small>' : '') + '</td>' +
        '<td>$' + (item.price || 0).toFixed(2) + '</td>' +
        '<td><input type="number" min="1" class="qty-stepper" data-idx="' + index + '" value="' + (item.quantity || 1) + '" style="width: 50px; padding: 4px;" /></td>' +
        '<td>$' + itemTotal.toFixed(2) + '</td>' +
        '<td><button type="button" class="btn-cart-remove" data-idx="' + index + '" style="color: #ef4444; background: none; border: none; cursor: pointer;">✕</button></td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
    if (subtotalEl) subtotalEl.textContent = '$' + total.toFixed(2);
  }
  function renderCheckoutReview() {
    var reviewEl = document.getElementById('fs-checkout-items');
    if (!reviewEl) return;
    var cart = getCart();
    if (cart.length === 0) {
      reviewEl.innerHTML = '<p style="color: #64748b;">No items in cart.</p>';
      return;
    }
    var total = 0;
    var html = '<ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">';
    cart.forEach(function(item) {
      var itemTotal = (item.price || 0) * (item.quantity || 1);
      total += itemTotal;
      html += '<li style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">' +
        '<span>' + (item.title || 'Product') + ' × ' + (item.quantity || 1) + '</span>' +
        '<span>$' + itemTotal.toFixed(2) + '</span>' +
      '</li>';
    });
    html += '</ul><div style="font-weight: 700; font-size: 16px; display: flex; justify-content: space-between;"><span>Total:</span><span>$' + total.toFixed(2) + '</span></div>';
    reviewEl.innerHTML = html;
  }

  // Bind Add to Cart Clicks
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target) return;
    if (target.classList && target.classList.contains('btn-add-to-cart')) {
      var card = target.closest('.fs-wc-product-card') || target.closest('.fs-wc-add-to-cart') || target.closest('.fs-wc-custom-btn') || target.closest('.fs-wc-catalog') || document;
      var titleEl = card ? card.querySelector('.title, .fs-wc-title, h3, h2') : null;
      var priceEl = card ? card.querySelector('.price, .fs-wc-price, .fs-price') : null;
      var title = titleEl ? titleEl.textContent.trim() : 'Store Product';
      var price = 49.99;
      if (priceEl) {
        var num = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) price = num;
      }
      var cart = getCart();
      var existing = cart.find(function(it) { return it.title === title; });
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push({ id: 'item-' + Date.now(), title: title, price: price, quantity: 1 });
      }
      saveCart(cart);
      alert('Added "' + title + '" to your cart!');
    }
    if (target.classList && target.classList.contains('btn-cart-remove')) {
      var idx = parseInt(target.getAttribute('data-idx') || '-1', 10);
      if (idx >= 0) {
        var c = getCart();
        c.splice(idx, 1);
        saveCart(c);
      }
    }
  });

  // Bind Quantity Changes
  document.addEventListener('change', function(e) {
    var target = e.target;
    if (target && target.classList && target.classList.contains('qty-stepper')) {
      var idx = parseInt(target.getAttribute('data-idx') || '-1', 10);
      var val = parseInt(target.value || '1', 10);
      if (idx >= 0 && val >= 1) {
        var c = getCart();
        if (c[idx]) {
          c[idx].quantity = val;
          saveCart(c);
        }
      }
    }
  });

  // Bind Checkout Submission
  var checkoutForm = document.getElementById('fs-checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var cart = getCart();
      if (cart.length === 0) {
        alert('Your cart is empty. Please add items before checking out.');
        return;
      }
      var formData = new FormData(checkoutForm);
      var customer = {
        name: formData.get('customerName') || 'Guest Customer',
        email: formData.get('customerEmail') || 'customer@example.com',
        address: formData.get('address') || '',
        city: formData.get('city') || ''
      };
      var subtotal = cart.reduce(function(acc, it) { return acc + (it.price * (it.quantity || 1)); }, 0);
      var websiteId = document.body.getAttribute('data-website-id') || window.location.pathname.split('/')[2] || 'site-main';
      var payload = {
        items: cart.map(function(it) {
          return { productId: it.id || 'prod', name: it.title, quantity: it.quantity || 1, unitPrice: it.price };
        }),
        subtotal: subtotal,
        total: subtotal,
        customer: customer
      };
      try {
        var res = await fetch('/api/websites/' + encodeURIComponent(websiteId) + '/commerce/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          saveCart([]);
          alert('Order placed successfully! Thank you for your purchase.');
          window.location.href = 'purchase-summary.html';
        } else {
          alert('Order recorded locally. Thank you for your purchase!');
          saveCart([]);
        }
      } catch (err) {
        alert('Order recorded locally. Thank you for your purchase!');
        saveCart([]);
      }
    });
  }

  // Initialize store state on load
  updateCartBadges();
  renderCartTable();
  renderCheckoutReview();
})();
`;
}
