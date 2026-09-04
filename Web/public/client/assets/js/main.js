var notyf = new Notyf({
  duration: 3000,
  position: {
    x:'right',
    y:'top'
  },
  dismissible: true
});

(function() {
  var liveRegion = document.getElementById('sr-live-region');
  if (!liveRegion) return;
  ['success', 'error'].forEach(function(method) {
    var orig = notyf[method].bind(notyf);
    notyf[method] = function(msg) {
      liveRegion.textContent = '';
      setTimeout(function() { liveRegion.textContent = typeof msg === 'string' ? msg : (msg && msg.message) || ''; }, 50);
      return orig(msg);
    };
  });
})();

const notifyData = sessionStorage.getItem("notify");
if(notifyData) {
  const { type, message } = JSON.parse(notifyData);
  if(type == "error") {
    notyf.error(message);
  } else if(type == "success") {
    notyf.success(message);
  }
  sessionStorage.removeItem("notify");
}

const drawNotify = (type, message) => {
  sessionStorage.setItem("notify", JSON.stringify({
    type: type,
    message: message
  }));
}

// Disable a submit trigger and show a spinner while an async request is in flight.
// Returns an unlock() to call when the request settles (skip it when the page navigates on success).
const lockSubmit = (trigger) => {
  if(!trigger) return () => {};
  const originalHtml = trigger.innerHTML;
  const label = (trigger.textContent || "").trim() || "Please wait";
  trigger.disabled = true;
  trigger.setAttribute("aria-busy", "true");
  trigger.style.pointerEvents = "none";
  trigger.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${label}`;
  return () => {
    trigger.disabled = false;
    trigger.removeAttribute("aria-busy");
    trigger.style.pointerEvents = "";
    trigger.innerHTML = originalHtml;
  };
}

// Ask the shared confirm modal before running a destructive action.
const confirmAction = (message, onConfirm) => {
  const modalEl = document.querySelector("#modalConfirm");
  if(!modalEl || typeof bootstrap === "undefined") {
    if(window.confirm(message)) onConfirm();
    return;
  }
  modalEl.querySelector("#modalConfirmMessage").textContent = message;
  const okBtn = modalEl.querySelector("#modalConfirmOk");
  const freshOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(freshOk, okBtn);
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  freshOk.addEventListener("click", () => {
    modal.hide();
    onConfirm();
  });
  modal.show();
}

// Markup for an empty list/collection view (wishlist, compare, cart).
const emptyStateHTML = (icon, title, text, ctaText, ctaHref) => `
  <div class="store_empty_state">
    <i class="fas ${icon}" aria-hidden="true"></i>
    <p class="store_empty_title">${title}</p>
    <p class="store_empty_text">${text}</p>
    <a class="common_btn" href="${ctaHref}">${ctaText}<i class="fas fa-long-arrow-right" aria-hidden="true"></i></a>
  </div>
`;

// Highlight the category the viewer is currently browsing in the mega/mobile menu.
(function() {
  const path = window.location.pathname;
  if (!path.startsWith("/product/category/")) return;
  document.querySelectorAll('.menu_category_area a[href], .mobile_menu_area a[href], .menu_cat_item a[href], .mobile_menu_list a[href]').forEach(a => {
    if (a.getAttribute("href") === path) {
      a.setAttribute("aria-current", "page");
    }
  });
})();

const pagination = document.querySelector(".pagination");
if(pagination) {
  const url = new URL(window.location.href);

  const listItem = pagination.querySelectorAll(".page-item [page]");
  listItem.forEach(item => {
    item.addEventListener("click", () => {
      const value = item.getAttribute("page");
      if(value) {
        url.searchParams.set("page", value);
      } else {
        url.searchParams.delete("page");
      }
      window.location.href = url.href;
    })
  })
}

const listButtonShare = document.querySelectorAll("[button-share]");
if(listButtonShare.length > 0) {
  listButtonShare.forEach(button => {
    button.href = button.href + window.location.href;
  })
}

const listFilterProductStatus = document.querySelectorAll("[filter-product-status]");
if(listFilterProductStatus.length > 0) {
  const url = new URL(window.location.href);

  listFilterProductStatus.forEach(input => {
    const name = input.value;

    input.addEventListener("change", () => {
      const value = input.checked;
      if(value) {
        url.searchParams.set(name, value);
      } else {
        url.searchParams.delete(name);
      }
      window.location.href = url.href;
    })

    const valueCurrent = url.searchParams.get(name);
    if(valueCurrent) {
      input.checked = true;
    }
  })
}

const listButtonSlug = document.querySelectorAll("[button-slug]");
if(listButtonSlug.length > 0) {
  const url = new URL(window.location.href);

  listButtonSlug.forEach(button => {
    button.addEventListener("click", () => {
      const slug = button.getAttribute("button-slug");
      if(slug) {
        url.pathname = `/product/category/${slug}`;
        window.location.href = url.href;
      }
    })
  })
}

const listFilterAttribute = document.querySelectorAll("[filter-attribute]");
if(listFilterAttribute.length > 0) {
  const url = new URL(window.location.href);

  listFilterAttribute.forEach(filterAttribute => {
    const id = filterAttribute.getAttribute("filter-attribute");
    const listInput = filterAttribute.querySelectorAll(`input[type="checkbox"]`);

    listInput.forEach(input => {
      input.addEventListener("change", () => {
        const listInputChecked = filterAttribute.querySelectorAll(`input[type="checkbox"]:checked`);
        const listValue = [];
        listInputChecked.forEach(inputChecked => listValue.push(inputChecked.value));
        if(listValue.length > 0) {
          url.searchParams.set(`attribute_${id}`, listValue.join(","));
        } else {
          url.searchParams.delete(`attribute_${id}`);
        }
        window.location.href = url.href;
      })
    })

    const listValueCurrent = url.searchParams.get(`attribute_${id}`);
    if(listValueCurrent) {
      const listValue = listValueCurrent.split(",");
      listInput.forEach(input => {
        if(listValue.includes(input.value)) {
          input.checked = true;
        }
      })
    }
  })
}

const formSearch = document.querySelector("[form-search]");
if(formSearch) {
  const url = new URL(window.location.href);

  const keywordCurrent = url.searchParams.get("keyword");
  const keywordField = formSearch.querySelector("input[name='keyword']") || formSearch.keyword;
  const categoryField = formSearch.querySelector("select[name='category']") || formSearch.category;

  if(categoryField) {
    const categoryCurrent = url.pathname.split("/").pop();
    if(categoryCurrent && categoryCurrent != "category") {
      categoryField.value = categoryCurrent;
    }
  }

  if(keywordField && keywordCurrent) {
    keywordField.value = keywordCurrent;
  }

  formSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    const keyword = keywordField ? keywordField.value.trim() : "";
    const category = categoryField ? categoryField.value : "";

    const targetUrl = new URL("/search", window.location.origin);

    if(category) {
      targetUrl.pathname = `/product/category/${category}`;
    }

    if(keyword) {
      targetUrl.searchParams.set("keyword", keyword);
    } else {
      targetUrl.searchParams.delete("keyword");
    }

    window.location.href = targetUrl.href;
  });

  const buttonVoice = document.querySelector("[button-voice]");
  if(buttonVoice && keywordField) {
    const originalPlaceholder = keywordField.placeholder;
    const listeningTexts = {
      "vi": "Đang nghe...",
      "en": "Listening...",
      "ja": "聞いています...",
      "ko": "듣고 있습니다...",
      "zh-CN": "正在聆听...",
      "fr": "Écoute...",
      "de": "Hören...",
      "es": "Escuchando...",
      "ru": "Слушаю...",
      "th": "กำลังฟัง..."
    };

    buttonVoice.addEventListener("click", () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Try using Chrome or Safari.");
        return;
      }

      const voice = new SpeechRecognition();

      let activeLang = "vi";
      const match = document.cookie.match(/googtrans=([^;]+)/);
      if (match) {
        const parts = match[1].split('/');
        if (parts.length > 2) {
          activeLang = parts[2];
        }
      } else {
        const selectedLangEl = document.querySelector(".gtranslate_wrapper .gt_selected a");
        if (selectedLangEl) {
          const href = selectedLangEl.getAttribute("href");
          if (href && href.includes("googtrans")) {
            const parts = href.match(/googtrans\(([^)]+)\)/);
            if (parts && parts[1]) {
              const langParts = parts[1].split('|');
              if (langParts.length > 1) {
                activeLang = langParts[1];
              }
            }
          }
        }
      }

      const localeMap = {
        "vi": "vi-VN",
        "en": "en-US",
        "ja": "ja-JP",
        "ko": "ko-KR",
        "zh-CN": "zh-CN",
        "zh-TW": "zh-TW",
        "fr": "fr-FR",
        "de": "de-DE",
        "es": "es-ES",
        "ru": "ru-RU",
        "th": "th-TH"
      };

      voice.lang = localeMap[activeLang] || `${activeLang}-${activeLang.toUpperCase()}`;

      voice.onstart = () => {
        buttonVoice.classList.add("recording");
        keywordField.placeholder = listeningTexts[activeLang] || "Listening...";
        keywordField.value = "";
      };

      voice.onend = () => {
        buttonVoice.classList.remove("recording");
        keywordField.placeholder = originalPlaceholder;
      };

      voice.onerror = () => {
        buttonVoice.classList.remove("recording");
        keywordField.placeholder = originalPlaceholder;
      };

      voice.onresult = (event) => {
        const value = event.results[0][0].transcript;
        if(value) {
          keywordField.value = value;
          formSearch.dispatchEvent(new Event("submit"));
        }
      };

      voice.start();
    });
  }

  const input = formSearch.querySelector(`input[name="keyword"]`);
  const boxSuggest = formSearch.querySelector(`.inner-suggest`);
  const boxSuggestList = boxSuggest.querySelector(`.inner-list`);
  let timeout;

  input.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const keyword = input.value;
      if(keyword) {
        fetch(`/product/suggest?keyword=${keyword}`)
          .then(res => res.json())
          .then(data => {
            if(data.code == "success") {
              const htmlArray = data.list.map(item => {
                return `
                  <a class="inner-item" href="/product/detail/${item.slug}">
                    <img class="inner-image" src="${domainCDN}${item.images[0]}">
                    <div class="inner-info">
                      <div class="inner-name">${item.name}</div>
                      <div class="inner-prices">
                        <div class="inner-price-new">
                          ${item.priceNew.toLocaleString('vi-VN')} VND
                        </div>
                        <div class="inner-price-old">
                          ${item.priceOld.toLocaleString('vi-VN')} VND
                        </div>
                      </div>
                    </div>
                  </a>
                `;
              })
              boxSuggestList.innerHTML = htmlArray.join("");
              refreshCurrencyDisplay(boxSuggestList);
              if(data.list.length > 0) {
                boxSuggest.style.display = "block";
              } else {
                boxSuggest.style.display = "none";
              }
            }
          })
      } else {
        boxSuggest.style.display = "none";
      }
    }, 500);
  })
}

const currencyConfig = (() => {
  const defaults = {
    base: "VND",
    defaultCurrency: "VND",
    supported: ["VND", "USD", "EUR", "JPY", "GBP", "CNY"],
    rates: {},
    digits: {
      VND: 0,
      JPY: 0,
      USD: 2,
      EUR: 2,
      GBP: 2,
      CNY: 2
    }
  };

  const override = window.currencySettings || {};
  return {
    ...defaults,
    ...override,
    rates: { ...defaults.rates, ...(override.rates || {}) },
    digits: { ...defaults.digits, ...(override.digits || {}) }
  };
})();

const currencyState = {
  current: localStorage.getItem("currency") || currencyConfig.defaultCurrency
};

window.currencyConfig = currencyConfig;
window.currencyState = currencyState;

const CURRENCY_RATES_STORAGE_KEY = "currencyRates";
const CURRENCY_RATES_TTL = 1000 * 60 * 60 * 6;
const CURRENCY_RATES_TIMEOUT = 5000;
const CURRENCY_RATES_MIN_REFRESH = 1000 * 60;
let lastRatesFetch = 0;

const loadCachedRates = ({ allowStale = false } = {}) => {
  const cached = localStorage.getItem(CURRENCY_RATES_STORAGE_KEY);
  if(!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if(!parsed.timestamp || !parsed.rates) return null;
    const isStale = Date.now() - parsed.timestamp > CURRENCY_RATES_TTL;
    if(isStale && !allowStale) return null;
    return { rates: parsed.rates, stale: isStale };
  } catch (error) {
    return null;
  }
};

const saveCachedRates = (rates) => {
  localStorage.setItem(
    CURRENCY_RATES_STORAGE_KEY,
    JSON.stringify({ timestamp: Date.now(), rates })
  );
};

const loadLiveRates = async ({ force = false } = {}) => {
  let hasCachedRates = false;
  if(!force) {
    const cachedRates = loadCachedRates();
    if(cachedRates?.rates) {
      currencyConfig.rates = { ...currencyConfig.rates, ...cachedRates.rates };
      hasCachedRates = true;
      if(!cachedRates.stale) return true;
    }
  }

  if(Date.now() - lastRatesFetch < CURRENCY_RATES_MIN_REFRESH) {
    return Object.keys(currencyConfig.rates).length > 0 || hasCachedRates;
  }

  const symbols = currencyConfig.supported
    .filter(code => code !== currencyConfig.base)
    .join(",");
  const endpoints = [
    {
      url: `https://api.exchangerate.host/latest?base=${currencyConfig.base}&symbols=${symbols}`,
      parse: (data) => data?.rates || null
    },
    {
      url: `https://open.er-api.com/v6/latest/${currencyConfig.base}`,
      parse: (data) => {
        if(!data?.rates) return null;
        const filtered = {};
        currencyConfig.supported.forEach(code => {
          if(data.rates[code]) {
            filtered[code] = data.rates[code];
          }
        });
        return Object.keys(filtered).length ? filtered : null;
      }
    }
  ];

  lastRatesFetch = Date.now();

  for(const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CURRENCY_RATES_TIMEOUT);
      const response = await fetch(endpoint.url, {
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeoutId);
      if(!response.ok) continue;
      const data = await response.json();
      const rates = endpoint.parse(data);
      if(!rates) continue;
      currencyConfig.rates = { ...currencyConfig.rates, ...rates };
      saveCachedRates(rates);
      return true;
    } catch (error) {
    }
  }

  if(!hasCachedRates) {
    const staleRates = loadCachedRates({ allowStale: true });
    if(staleRates?.rates) {
      currencyConfig.rates = { ...currencyConfig.rates, ...staleRates.rates };
      return true;
    }
  }

  return false;
};

const PRICE_TEXT_REGEX = /^\s*(-?[\d.,]+)\s*(VND|₫)\s*(?:×\s*(\d+))?\s*$/i;
const currencyFormatters = new Map();

const getCurrencyFormatter = (currency) => {
  if(!currencyFormatters.has(currency)) {
    const digits = currencyConfig.digits[currency] ?? 2;
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "code",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    );
  }
  return currencyFormatters.get(currency);
};

const formatCurrencyAmount = (amountVnd, currency) => {
  const rate = currency === currencyConfig.base ? 1 : currencyConfig.rates[currency];
  if(!rate && currency !== currencyConfig.base) {
    return getCurrencyFormatter(currencyConfig.base).format(amountVnd);
  }
  const value = amountVnd * (rate || 1);
  return getCurrencyFormatter(currency).format(value);
};

const wrapBasePriceNodes = (root = document.body) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if(!node.parentElement) return NodeFilter.FILTER_REJECT;
      const text = node.textContent;
      if(!text || !PRICE_TEXT_REGEX.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while(walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(node => {
    const text = node.textContent;
    const match = text.match(PRICE_TEXT_REGEX);
    if(!match) return;
    const amount = parseFloat(match[1].replace(/[.,]/g, ""));
    if(Number.isNaN(amount)) return;

    const span = document.createElement("span");
    span.className = "currency-amount";
    span.dataset.basePrice = amount;
    span.dataset.baseCurrency = currencyConfig.base;
    if(match[3]) {
      span.dataset.baseSuffix = match[3];
    }

    node.parentNode.replaceChild(span, node);
  });
};

const refreshCurrencyDisplay = (root = document.body) => {
  wrapBasePriceNodes(root);
  const currency = currencyState.current;
  root.querySelectorAll("[data-base-price]").forEach(el => {
    const basePrice = parseFloat(el.dataset.basePrice);
    if(Number.isNaN(basePrice)) return;
    const formatted = formatCurrencyAmount(basePrice, currency);
    const suffix = el.dataset.baseSuffix;
    el.textContent = suffix ? `${formatted} × ${suffix}` : formatted;
  });
};

const initCurrencySwitcher = (ratesReady) => {
  const switchers = document.querySelectorAll("[data-currency-switcher]");
  if(!switchers.length) return;

  const fallbackCurrency = currencyConfig.supported.includes(currencyState.current)
    ? currencyState.current
    : currencyConfig.defaultCurrency;

  currencyState.current = fallbackCurrency;

  const handleCurrencyChange = async (nextCurrency, { forceRefresh = false } = {}) => {
    if(!currencyConfig.supported.includes(nextCurrency)) return;
    currencyState.current = nextCurrency;
    localStorage.setItem("currency", nextCurrency);
    switchers.forEach(item => (item.value = nextCurrency));
    refreshCurrencyDisplay(document.body);
    const cacheStatus = loadCachedRates({ allowStale: true });
    const shouldForce = forceRefresh || (!cacheStatus?.rates || cacheStatus.stale);
    const ratesReadyNow = await loadLiveRates({ force: shouldForce });
    if(ratesReadyNow) {
      refreshCurrencyDisplay(document.body);
    }
    if(window.initPriceRangeSlider) {
      window.initPriceRangeSlider();
    }
  };

  switchers.forEach(select => {
    select.value = currencyState.current;
    select.disabled = false;
    select.addEventListener("change", (event) => {
      handleCurrencyChange(event.target.value, { forceRefresh: true });
    });
  });

  document.addEventListener("click", (event) => {
    const option = event.target.closest(".nice-select .option");
    if(!option) return;
    const niceSelect = option.closest(".nice-select");
    const select = niceSelect ? niceSelect.previousElementSibling : null;
    if(!select || !select.matches("[data-currency-switcher]")) return;
    const optionValue = option.getAttribute("data-value");
    const nextValue = optionValue || select.value;
    select.value = nextValue;
    handleCurrencyChange(nextValue, { forceRefresh: true });
  });

  refreshCurrencyDisplay(document.body);
};

const initCurrencyModule = async () => {
  const ratesReady = await loadLiveRates();
  initCurrencySwitcher(Boolean(ratesReady));
  if(window.initPriceRangeSlider) {
    window.initPriceRangeSlider();
  }
};

initCurrencyModule();

const existCart = localStorage.getItem("cart");
if(!existCart) {
  localStorage.setItem("cart", JSON.stringify([]));
}

const miniCartQuantity = () => {
  const cart = JSON.parse(localStorage.getItem("cart"));
  const listElementMiniCartQuantity = document.querySelectorAll("[mini-cart-quantity]");
  listElementMiniCartQuantity.forEach(item => {
    item.innerHTML = cart.length;
  });
}
miniCartQuantity();

const eventRemoveItemInCart = () => {
  const listButtonRemoveItem = document.querySelectorAll("[button-remove-item]");
  listButtonRemoveItem.forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest("[cart-item]");
      const productId = item.getAttribute("product-id");
      let variant = item.getAttribute("variant");
      if(variant) {
        variant = JSON.parse(decodeURIComponent(variant));
      }

      let cart = JSON.parse(localStorage.getItem("cart"));
      cart = cart.filter(cartItem => {
        const sameProduct = cartItem.productId == productId;

        const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
        const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
        const sameVariant = variantItemInCart == variantItemRemove;

        return !(sameProduct && sameVariant);
      });

      localStorage.setItem("cart", JSON.stringify(cart));
      drawCart();
      miniCartQuantity();
    })
  })
}

const eventCheckItemInCart = () => {
  const listInputCheckItem = document.querySelectorAll("[cart-table] .cart_page_checkbox input");
  listInputCheckItem.forEach(input => {
    input.addEventListener("change", () => {
      const checked = input.checked;
      const item = input.closest("[cart-item]");
      const productId = item.getAttribute("product-id");
      let variant = item.getAttribute("variant");
      if(variant) {
        variant = JSON.parse(decodeURIComponent(variant));
      }

      const cart = JSON.parse(localStorage.getItem("cart"));
      const itemUpdate = cart.find(cartItem => {
        const sameProduct = cartItem.productId == productId;

        const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
        const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
        const sameVariant = variantItemInCart == variantItemRemove;

        return (sameProduct && sameVariant);
      })

      itemUpdate.checked = checked;
      localStorage.setItem("cart", JSON.stringify(cart));
      drawCart();
    })
  })
}

const eventQuantityItemInCart = () => {
  const listBoxQuantity = document.querySelectorAll("[cart-table] .cart_page_quantity");
  listBoxQuantity.forEach(box => {
    const inputQuantity = box.querySelector("input");
    const buttonPlus = box.querySelector(".plus");
    const buttonMinus = box.querySelector(".minus");

    const item = box.closest("[cart-item]");
    const productId = item.getAttribute("product-id");
    let variant = item.getAttribute("variant");
    if(variant) {
      variant = JSON.parse(decodeURIComponent(variant));
    }

    const cart = JSON.parse(localStorage.getItem("cart"));
    const itemUpdate = cart.find(cartItem => {
      const sameProduct = cartItem.productId == productId;

      const variantItemInCart = cartItem.variant ? JSON.stringify(cartItem.variant) : "[]";
      const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
      const sameVariant = variantItemInCart == variantItemRemove;

      return (sameProduct && sameVariant);
    })

    if(itemUpdate) {
      const quantity = parseInt(inputQuantity.value);
      const max = parseInt(inputQuantity.max);
      if(quantity > max) {
        const itemAlert = document.createElement("div");
        itemAlert.style.color = "red";
        itemAlert.style.fontSize = "12px";
        itemAlert.innerHTML = `Only ${max} products!`;
        box.appendChild(itemAlert);
      }

      buttonPlus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const max = parseInt(inputQuantity.max);
        if(quantity < max) {
          itemUpdate.quantity = quantity + 1;
          localStorage.setItem("cart", JSON.stringify(cart));
          drawCart();
        }
      })

      buttonMinus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const min = parseInt(inputQuantity.min);
        if(quantity > min) {
          itemUpdate.quantity = quantity - 1;
          localStorage.setItem("cart", JSON.stringify(cart));
          drawCart();
        }
      })
    }
  })
}

const getUserAddress = () => {
  let userAddress = null;
  const inputUserAddressChecked = document.querySelector(`input[name="userAddress"]:checked`);
  if(inputUserAddressChecked) {
    const dataInfo = inputUserAddressChecked.getAttribute("data-info");
    if(dataInfo) {
      userAddress = JSON.parse(dataInfo);
    } else {
      const inputLongitude = document.querySelector(`input[name="longitude"]`);
      const inputLatitude = document.querySelector(`input[name="latitude"]`);
      const longitude = inputLongitude.value;
      const latitude = inputLatitude.value;
      if(longitude && latitude) {
        userAddress = {
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude)
        };
      }
    }
  }
  return userAddress;
}

const eventCheckShipping = () => {
  const listInput = document.querySelectorAll(`[shipping-list] input[name="shippingMethod"]`);
  listInput.forEach(input => {
    input.addEventListener("change", () => {
      drawCart();
    })
  })
}

const drawCart = () => {
  const cart = JSON.parse(localStorage.getItem("cart"));
  const userAddress = getUserAddress();

  if(cart.length > 0) {
    fetch(`/cart/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cart: cart,
        userAddress: userAddress
      })
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          localStorage.setItem("cart", JSON.stringify([]));
        }

        if(data.code == "success") {
          localStorage.setItem("cart", JSON.stringify(data.cart));

          let subTotal = 0;
          let shippingFee = 0;

          let htmlMiniCart = "";
          let htmlCartTable = "";
          let htmlCartSummary = "";
          let htmlShipping = "";

          data.cart.forEach(item => {
            const { detail } = item;
            let priceOld = 0;
            let priceNew = 0;
            let stock = 0;
            let htmlVariant = "";
            let htmlVariantSummary = "";

            if(item.variant) {
              const variantMatched = detail.variants.find(variantItem => {
                return (
                  variantItem.attributeValue.every(attr => {
                    const selected = item.variant.find(v => v.attrId === attr.attrId);
                    return selected && selected.value === attr.value;
                  })
                );
              });
              priceOld = variantMatched.priceOld;
              priceNew = variantMatched.priceNew;
              stock = variantMatched.stock;

              detail.attributeList.forEach(attr => {
                const variant = item.variant.find(v => v.attrId === attr._id);
                htmlVariant += `
                  <span>
                    <b>${attr.name}:</b> ${variant.label}
                  </span>
                `;

                htmlVariantSummary += `
                  <p>${attr.name}: ${variant.label}</p>
                `;
              })
            } else {
              priceOld = detail.priceOld;
              priceNew = detail.priceNew;
              stock = detail.stock;
            }

            if(item.checked) {
              subTotal += priceNew * item.quantity;
            }

            htmlMiniCart += `
              <li
                cart-item
                product-id=${item.productId}
                ${item.variant ? `variant="${encodeURIComponent(JSON.stringify(item.variant))}"` : ''}
              >
                <a class="cart_img" href="/product/detail/${detail.slug}">
                  <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                </a>
                <div class="cart_text">
                  <a class="cart_title" href="/product/detail/${detail.slug}">
                    ${detail.name}
                  </a>
                  <p>
                    ${priceNew.toLocaleString('vi-VN')} VND
                    <del>${priceOld.toLocaleString('vi-VN')} VND</del>
                  </p>
                  <span>
                    <b>Quantity:</b> ${item.quantity}
                  </span>
                  ${htmlVariant}
                </div>
                <a class="del_icon" href="javascript:;" button-remove-item>
                  <i class="fas fa-times" aria-hidden="true"></i>
                </a>
              </li>
            `;

            htmlCartTable += `
              <tr
                cart-item
                product-id=${item.productId}
                ${item.variant ? `variant="${encodeURIComponent(JSON.stringify(item.variant))}"` : ''}
              >
                <td class="cart_page_checkbox">
                  <div class="form-check">
                    <input class="form-check-input" value="" type="checkbox" ${item.checked && "checked"} />
                  </div>
                </td>
                <td class="cart_page_img">
                  <div class="img">
                    <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}" />
                  </div>
                </td>
                <td class="cart_page_details">
                  <a class="title" href="/product/detail/${detail.slug}">${detail.name}</a>
                  <p>
                    ${priceNew.toLocaleString('vi-VN')} VND
                    <del>${priceOld.toLocaleString('vi-VN')} VND</del>
                  </p>
                  ${htmlVariant}
                </td>
                <td class="cart_page_price">
                  <h3>${priceNew.toLocaleString('vi-VN')} VND</h3>
                </td>
                <td class="cart_page_quantity">
                  <div class="details_qty_input">
                    <button class="minus">
                      <i class="fas fa-minus" aria-hidden="true"></i>
                    </button>
                    <input
                      value="${item.quantity}"
                      type="number"
                      readonly=""
                      min="1"
                      max="${stock}"
                    />
                    <button class="plus">
                      <i class="fas fa-plus" aria-hidden="true"></i>
                    </button>
                  </div>
                </td>
                <td class="cart_page_total">
                  <h3>${(priceNew * item.quantity).toLocaleString('vi-VN')} VND</h3>
                </td>
                <td class="cart_page_action">
                  <a href="javascript:;" button-remove-item>
                    <i class="fas fa-times" aria-hidden="true"></i> Delete
                  </a>
                </td>
              </tr>
            `;

            if(item.checked) {
              htmlCartSummary += `
                <li>
                  <a class="img" href="/product/detail/${detail.slug}">
                    <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                  </a>
                  <div class="text">
                    <a class="title" href="/product/detail/${detail.slug}">
                      ${detail.name}
                    </a>
                    <p>${priceNew.toLocaleString('vi-VN')} VND × ${item.quantity}</p>
                    ${htmlVariantSummary}
                  </div>
                </li>
              `;
            }
          })

          if(data.shippingOptions) {
            const inputChecked = document.querySelector(`[shipping-list] [name="shippingMethod"]:checked`);
            let idInputChecked = null;
            if(inputChecked) {
              idInputChecked = inputChecked.id;
            }

            data.shippingOptions.forEach((item, index) => {
              const checked = idInputChecked == `shippingMethod${index}` ? "checked" : "";

              htmlShipping += `
                <div class="form-check">
                  <input
                    ${checked}
                    class="form-check-input"
                    id="shippingMethod${index}"
                    name="shippingMethod"
                    type="radio"
                    value="${item.id}"
                  >
                  <label class="form-check-label" for="shippingMethod${index}">
                    <small>${item.carrier_name} (${item.service} - ${item.expected}):</small>
                    <span>
                      <span>(+) </span>
                      <span>${item.total_fee.toLocaleString('vi-VN')} VND</span>
                    </span>
                  </label>
                </div>
              `;

              if(checked == "checked") {
                shippingFee = item.total_fee;
              }
            });
          }

          let discount = 0;
          let couponDetail = sessionStorage.getItem("couponDetail");
          if(couponDetail) {
            couponDetail = JSON.parse(couponDetail);

            if (subTotal >= couponDetail.minOrderValue) {
              if (couponDetail.typeDiscount === "percentage") {
                discount = (subTotal * couponDetail.value) / 100;

                if (couponDetail.maxDiscountValue > 0 && discount > couponDetail.maxDiscountValue) {
                  discount = couponDetail.maxDiscountValue;
                }

              } else if (couponDetail.typeDiscount === "fixed") {
                discount = couponDetail.value;
              }

              const elementViewCoupon = document.querySelector("#applyCouponForm .inner-view-coupon");
              if(elementViewCoupon) {
                const elementCoupon = elementViewCoupon.querySelector(".inner-coupon");
                elementViewCoupon.style.display = "flex";
                elementCoupon.innerHTML = couponDetail.code;
              }
            } else {
              notyf.error(`Order has not reached minimum value: ${couponDetail.minOrderValue} VND`);
              sessionStorage.removeItem("couponDetail");
            }
          }

          let pointData = data.point || null;
          let maxPointDiscount = 0;
          if(pointData && pointData.canUsePoint > 0) {
            maxPointDiscount = pointData.canUsePoint * pointData.POINT_TO_MONEY;
          }

          let pointDiscount = 0;

          let total = Math.max(0, subTotal + shippingFee - discount - pointDiscount);

          const ulMiniCart = miniCart.querySelector(".offcanvas-body ul");
          ulMiniCart.innerHTML = htmlMiniCart;

          const cartTable = document.querySelector("[cart-table]");
          if(cartTable) {
            cartTable.innerHTML = htmlCartTable;
          }

          const cartSummary = document.querySelector("[cart-summary]");
          if(cartSummary) {
            cartSummary.innerHTML = htmlCartSummary;
          }

          const listElementSubTotal = document.querySelectorAll("[sub-total]");
          listElementSubTotal.forEach(item => {
            item.dataset.basePrice = subTotal;
            item.innerHTML = formatCurrencyAmount(subTotal, currencyState.current);
          })

          const elementDiscount = document.querySelector("[discount]");
          if(elementDiscount) {
            elementDiscount.dataset.basePrice = discount;
            elementDiscount.innerHTML = formatCurrencyAmount(discount, currencyState.current);
          }

          const pointRow = document.querySelector("[point-row]");
          if(pointRow && pointData && pointData.canUsePoint > 0) {
            pointRow.style.display = "";
            const availablePointEl = pointRow.querySelector("[available-point]");
            if(availablePointEl) {
              availablePointEl.textContent = `(${pointData.canUsePoint} points)`;
            }
          }

          const elementPointDiscount = document.querySelector("[point-discount]");
          if(elementPointDiscount) {
            elementPointDiscount.dataset.basePrice = pointDiscount;
            elementPointDiscount.innerHTML = formatCurrencyAmount(pointDiscount, currencyState.current);
          }

          const elementTotal = document.querySelector("[total]");
          if(elementTotal) {
            elementTotal.dataset.basePrice = total;
            elementTotal.innerHTML = formatCurrencyAmount(total, currencyState.current);
          }

          const usePointCheckbox = document.querySelector("[use-point-checkbox]");
          if(usePointCheckbox) {
            usePointCheckbox.addEventListener("change", function() {
              pointDiscount = this.checked ? maxPointDiscount : 0;
              total = Math.max(0, subTotal + shippingFee - discount - pointDiscount);

              if(elementPointDiscount) {
                elementPointDiscount.dataset.basePrice = pointDiscount;
                elementPointDiscount.innerHTML = formatCurrencyAmount(pointDiscount, currencyState.current);
              }
              if(elementTotal) {
                elementTotal.dataset.basePrice = total;
                elementTotal.innerHTML = formatCurrencyAmount(total, currencyState.current);
              }
              refreshCurrencyDisplay(document.body);
            });
          }

          const elementShippingList = document.querySelector("[shipping-list]");
          if(elementShippingList) {
            elementShippingList.innerHTML = htmlShipping;
          }

          refreshCurrencyDisplay(document.body);

          eventRemoveItemInCart();
          eventQuantityItemInCart();
          eventCheckItemInCart();
          eventCheckShipping();
        }
      })
  } else {
    const ulMiniCart = miniCart.querySelector(".offcanvas-body ul");
    ulMiniCart.innerHTML = "Your cart is empty.";

    const cartTable = document.querySelector("[cart-table]");
    if(cartTable) {
      cartTable.innerHTML = `
        <tr>
          <td colspan="7">
            ${emptyStateHTML("fa-shopping-bag", "Your cart is empty", "Browse the store and add something you like.", "Continue Shopping", "/product")}
          </td>
        </tr>
      `;
    }

    const cartSummary = document.querySelector("[cart-summary]");
    if(cartSummary) {
      cartSummary.innerHTML = "";
    }

    const listElementSubTotal = document.querySelectorAll("[sub-total]");
    listElementSubTotal.forEach(item => {
      item.dataset.basePrice = 0;
      item.innerHTML = formatCurrencyAmount(0, currencyState.current);
    })
  }
}

const existCompareList = localStorage.getItem("compare");
if(!existCompareList) {
  localStorage.setItem("compare", JSON.stringify([]));
}

const miniCompareQuantity = () => {
  const compareList = JSON.parse(localStorage.getItem("compare"));
  const miniCompareQuantity = document.querySelector("[mini-compare-quantity]");
  miniCompareQuantity.innerHTML = compareList.length;
}
miniCompareQuantity();

const existWishlist = localStorage.getItem("wishlist");
if(!existWishlist) {
  localStorage.setItem("wishlist", JSON.stringify([]));
}

const miniWishlistQuantity = () => {
  const wishlist = JSON.parse(localStorage.getItem("wishlist"));
  const miniWishlistQuantity = document.querySelector("[mini-wishlist-quantity]");
  miniWishlistQuantity.innerHTML = wishlist.length;
}
miniWishlistQuantity();

const shopDetailsText = document.querySelector(".shop_details_text");
if(shopDetailsText) {
  const elementStock = shopDetailsText.querySelector(".stock");
  const elementPriceNew = shopDetailsText.querySelector(".price-new");
  const elementPriceOld = shopDetailsText.querySelector(".price-old");
  const listElementLiVariant = shopDetailsText.querySelectorAll(".details_single_variant li");
  const inputQuantity = shopDetailsText.querySelector(".input-quantity");
  const buttonPlus = shopDetailsText.querySelector(".plus");
  const buttonMinus = shopDetailsText.querySelector(".minus");
  const buttonAddCart = shopDetailsText.querySelector("[button-add-cart]");

  const selected = {};
  let variantSelected = null;

  listElementLiVariant.forEach(item => {
    item.addEventListener("click", () => {
      const attributeId = item.getAttribute("attribute-id");
      const variant = item.getAttribute("variant");

      item.closest("ul").querySelectorAll("li").forEach(li => li.classList.remove("active"));

      item.classList.add("active");

      selected[attributeId] = variant;

      const selectedValues = Object.values(selected);
      if(selectedValues.length > 0) {
        const variantMatched = productVariants.find(variantItem => {
          return variantItem.attributeValue.every(attr => selected[attr.attrId] == attr.value)
        })

        if(variantMatched) {
          elementPriceNew.innerHTML = variantMatched.priceNew.toLocaleString('vi-VN') + ' VND';
          elementPriceOld.innerHTML = variantMatched.priceOld.toLocaleString('vi-VN') + ' VND';

          if(variantMatched.stock > 0) {
            elementStock.innerHTML = `In stock (${variantMatched.stock})`;
            elementStock.classList.remove("out_stock");
            inputQuantity.value = 1;
            variantSelected = variantMatched;
          } else {
            elementStock.innerHTML = `Out of stock`;
            elementStock.classList.add("out_stock");
            inputQuantity.value = 0;
            variantSelected = null;
          }

          inputQuantity.max = variantMatched.stock;
        }
      }
    })
  })

  buttonPlus.addEventListener("click", () => {
    const quantity = parseInt(inputQuantity.value);
    const max = parseInt(inputQuantity.max);
    if(quantity < max) {
      inputQuantity.value = quantity + 1;
    }
  })

  buttonMinus.addEventListener("click", () => {
    const quantity = parseInt(inputQuantity.value);
    const min = parseInt(inputQuantity.min);
    if(quantity > min) {
      inputQuantity.value = quantity - 1;
    }
  })

  buttonAddCart.addEventListener("click", () => {
    const productId = buttonAddCart.getAttribute("product-id");
    const quantity = parseInt(inputQuantity.value);
    if(productId && quantity > 0) {
      const dataItem = {
        productId: productId,
        quantity: quantity,
        checked: true
      };
      const cart = JSON.parse(localStorage.getItem("cart"));

      if(productVariants && productVariants.length > 0 && variantSelected) {
        dataItem.variant = variantSelected.attributeValue;

        const existItem = cart.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Cart quantity updated successfully!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      } else {
        const existItem = cart.find(item => item.productId === dataItem.productId);

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Cart quantity updated successfully!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      miniCartQuantity();
      drawCart();
    }
  })

  const buttonAddCompare = shopDetailsText.querySelector("[button-add-compare]");
  buttonAddCompare.addEventListener("click", () => {
    const productId = buttonAddCompare.getAttribute("product-id");
    if(productId) {
      const dataItem = {
        productId: productId
      };
      const compareList = JSON.parse(localStorage.getItem("compare"));

      if(compareList.length < 5) {
        if(productVariants && productVariants.length > 0 && variantSelected) {
          dataItem.variant = variantSelected.attributeValue;

          const existItem = compareList.find(item => {
            if(item.productId !== dataItem.productId) {
              return false;
            }

            const oldAttrs = item.variant;
            const newAttrs = dataItem.variant;

            if(oldAttrs.length !== newAttrs.length) {
              return false;
            }

            return oldAttrs.every(attr => {
              const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
              return match ? true : false;
            });
          })

          if(existItem) {
            notyf.success("Product is already in comparison list!");
          } else {
            compareList.push(dataItem);
            notyf.success("Added to comparison list!");
          }
        } else {
          const existItem = compareList.find(item => item.productId === dataItem.productId);

          if(existItem) {
            notyf.success("Product is already in comparison list!");
          } else {
            compareList.push(dataItem);
            notyf.success("Added to comparison list!");
          }
        }

        localStorage.setItem("compare", JSON.stringify(compareList));
        miniCompareQuantity();
      } else {
        notyf.error("Maximum number of products for comparison reached!");
      }
    }
  })

  const buttonAddWishlist = shopDetailsText.querySelector("[button-add-wishlist]");
  buttonAddWishlist.addEventListener("click", () => {
    const productId = buttonAddWishlist.getAttribute("product-id");
    const quantity = parseInt(inputQuantity.value);
    if(productId && quantity > 0) {
      const dataItem = {
        productId: productId,
        quantity: quantity
      };
      const wishlist = JSON.parse(localStorage.getItem("wishlist"));

      if(productVariants && productVariants.length > 0 && variantSelected) {
        dataItem.variant = variantSelected.attributeValue;

        const existItem = wishlist.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          notyf.success("Product is already in wishlist!");
        } else {
          wishlist.unshift(dataItem);
          notyf.success("Added to wishlist!");
        }
      } else {
        const existItem = wishlist.find(item => item.productId === dataItem.productId);

        if(existItem) {
          notyf.success("Product is already in wishlist!");
        } else {
          wishlist.unshift(dataItem);
          notyf.success("Added to wishlist!");
        }
      }

      localStorage.setItem("wishlist", JSON.stringify(wishlist));
      miniWishlistQuantity();
    }
  })
}

const miniCart = document.querySelector("[mini-cart]");
if(miniCart) {
  drawCart();
}

const inputCartCheckAll = document.querySelector("[input-cart-check-all]");
if(inputCartCheckAll) {
  inputCartCheckAll.addEventListener("change", () => {
    const checked = inputCartCheckAll.checked;
    const cart = JSON.parse(localStorage.getItem("cart"));
    cart.forEach(item => item.checked = checked);
    localStorage.setItem("cart", JSON.stringify(cart));
    drawCart();
  })
}

const eventAddItemToCartInCompare = () => {
  const listButtonAdd = document.querySelectorAll("[button-add]");
  listButtonAdd.forEach(button => {
    button.addEventListener("click", () => {
      const index = button.getAttribute("button-add");
      const compareList = JSON.parse(localStorage.getItem("compare"));
      const compareItem = compareList[index];
      const dataItem = {
        productId: compareItem.productId,
        quantity: 1,
        checked: true
      };

      const cart = JSON.parse(localStorage.getItem("cart"));

      if(compareItem.variant) {
        dataItem.variant = compareItem.variant;

        const existItem = cart.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          notyf.success("Product is already in cart!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      } else {
        const existItem = cart.find(item => item.productId === dataItem.productId);

        if(existItem) {
          notyf.success("Product is already in cart!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      miniCartQuantity();
      drawCart();
    })
  })
}

const eventRemoveItemInCompare = () => {
  const listButtonRemove = document.querySelectorAll("[button-remove]");
  listButtonRemove.forEach(button => {
    button.addEventListener("click", () => {
      const index = parseInt(button.getAttribute("button-remove"));
      const compareList = JSON.parse(localStorage.getItem("compare"));
      compareList.splice(index, 1);
      localStorage.setItem("compare", JSON.stringify(compareList));
      drawNotify("success", "Product removed from comparison list!");
      window.location.reload();
    })
  })
}

const drawComparePage = () => {
  const compareList = JSON.parse(localStorage.getItem("compare"));
  if(compareList.length > 0) {
    fetch(`/compare/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(compareList)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          localStorage.setItem("compare", JSON.stringify([]));
        }

        if(data.code == "success") {
          localStorage.setItem("compare", JSON.stringify(data.compareList));

          let html1 = "";
          let html2 = "";
          let html3 = "";
          let html4 = "";
          let html5 = "";
          let html6 = "";

          data.compareList.forEach((item, index) => {
            const { detail } = item;
            let priceOld = 0;
            let priceNew = 0;
            let stock = 0;
            let htmlVariant = "";

            if(item.variant) {
              const variantMatched = detail.variants.find(variantItem => {
                return (
                  variantItem.attributeValue.every(attr => {
                    const selected = item.variant.find(v => v.attrId === attr.attrId);
                    return selected && selected.value === attr.value;
                  })
                );
              });
              priceOld = variantMatched.priceOld;
              priceNew = variantMatched.priceNew;
              stock = variantMatched.stock;

              detail.attributeList.forEach(attr => {
                const variant = item.variant.find(v => v.attrId === attr._id);
                htmlVariant += `
                  <p>${attr.name}: ${variant.label}</p>
                `;
              })
            } else {
              priceOld = detail.priceOld;
              priceNew = detail.priceNew;
              stock = detail.stock;
            }

            html1 += `
              <td>
                <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                <a class="title" href="/product/detail/${detail.slug}">${detail.name}</a>
              </td>
            `;

            html2 += `
              <td>
                ${detail.description}
              </td>
            `;

            html3 += `
              <td>
                <p>
                  ${priceNew.toLocaleString('vi-VN')} VND
                  <del>${priceOld.toLocaleString('vi-VN')} VND</del>
                </p>
              </td>
            `;

            html4 += `
              <td>
                ${htmlVariant}
              </td>
            `;

            html5 += `
              <td>
                <p class="rating">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <i class="far fa-star" aria-hidden="true"></i>
                </p>
              </td>
            `;

            html6 += `
              <td>
                ${
                  stock > 0 ?
                  '<a class="common_btn" href="javascript:;" button-add="'+index+'">Add to Cart</a>'
                  :
                  '<div class="text-danger">Out of stock</div>'
                }
                <a class="remove common_btn" href="javascript:;" button-remove="${index}">
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </a>
              </td>
            `;
          })

          const elementHtml1 = document.querySelector("[html-1]");
          elementHtml1.outerHTML = html1;

          const elementHtml2 = document.querySelector("[html-2]");
          elementHtml2.outerHTML = html2;

          const elementHtml3 = document.querySelector("[html-3]");
          elementHtml3.outerHTML = html3;

          const elementHtml4 = document.querySelector("[html-4]");
          elementHtml4.outerHTML = html4;

          const elementHtml5 = document.querySelector("[html-5]");
          elementHtml5.outerHTML = html5;

          const elementHtml6 = document.querySelector("[html-6]");
          elementHtml6.outerHTML = html6;

          eventAddItemToCartInCompare();
          eventRemoveItemInCompare();
        }
      })
  } else {
    const area = document.querySelector(".compare_list_area");
    if(area) {
      area.innerHTML = emptyStateHTML("fa-layer-group", "Nothing to compare yet", "Add products from the store to compare them side by side.", "Continue Shopping", "/product");
    }
  }
}

const comparePage = document.querySelector(".compare_page");
if(comparePage) {
  drawComparePage();
}

const eventQuantityItemInWishlist = () => {
  const listBoxQuantity = document.querySelectorAll("[wishlist-table] .cart_page_quantity");
  listBoxQuantity.forEach(box => {
    const inputQuantity = box.querySelector("input");
    const buttonPlus = box.querySelector(".plus");
    const buttonMinus = box.querySelector(".minus");

    const item = box.closest("[cart-item]");
    const productId = item.getAttribute("product-id");
    let variant = item.getAttribute("variant");
    if(variant) {
      variant = JSON.parse(decodeURIComponent(variant));
    }

    const wishlist = JSON.parse(localStorage.getItem("wishlist"));
    const itemUpdate = wishlist.find(wishItem => {
      const sameProduct = wishItem.productId == productId;

      const variantItemInCart = wishItem.variant ? JSON.stringify(wishItem.variant) : "[]";
      const variantItemRemove = variant ? JSON.stringify(variant) : "[]";
      const sameVariant = variantItemInCart == variantItemRemove;

      return (sameProduct && sameVariant);
    })

    if(itemUpdate) {
      const quantity = parseInt(inputQuantity.value);
      const max = parseInt(inputQuantity.max);
      if(quantity > max) {
        const itemAlert = document.createElement("div");
        itemAlert.style.color = "red";
        itemAlert.style.fontSize = "12px";
        itemAlert.innerHTML = `Only ${max} products!`;
        box.appendChild(itemAlert);
      }

      buttonPlus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const max = parseInt(inputQuantity.max);
        if(quantity < max) {
          itemUpdate.quantity = quantity + 1;
          localStorage.setItem("wishlist", JSON.stringify(wishlist));
          drawWishlistPage();
        } else {
          notyf.error(`Only ${max} products.`);
        }
      })

      buttonMinus.addEventListener("click", () => {
        const quantity = parseInt(inputQuantity.value);
        const min = parseInt(inputQuantity.min);
        if(quantity > min) {
          itemUpdate.quantity = quantity - 1;
          localStorage.setItem("wishlist", JSON.stringify(wishlist));
          drawWishlistPage();
        }
      })
    }
  })
}

const eventAddItemToCartInWishlist = () => {
  const listButtonAdd = document.querySelectorAll("[button-add]");
  listButtonAdd.forEach(button => {
    button.addEventListener("click", () => {
      const index = button.getAttribute("button-add");
      const wishlist = JSON.parse(localStorage.getItem("wishlist"));
      const wishItem = wishlist[index];
      const dataItem = {
        productId: wishItem.productId,
        quantity: wishItem.quantity,
        checked: true
      };

      const cart = JSON.parse(localStorage.getItem("cart"));

      if(wishItem.variant) {
        dataItem.variant = wishItem.variant;

        const existItem = cart.find(item => {
          if(item.productId !== dataItem.productId) {
            return false;
          }

          const oldAttrs = item.variant;
          const newAttrs = dataItem.variant;

          if(oldAttrs.length !== newAttrs.length) {
            return false;
          }

          return oldAttrs.every(attr => {
            const match = newAttrs.find(a => a.attrId === attr.attrId && a.value === attr.value);
            return match ? true : false;
          });
        })

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Product is already in cart!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      } else {
        const existItem = cart.find(item => item.productId === dataItem.productId);

        if(existItem) {
          existItem.quantity = dataItem.quantity;
          notyf.success("Product is already in cart!");
        } else {
          cart.unshift(dataItem);
          notyf.success("Added to cart!");
        }
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      miniCartQuantity();
      drawCart();
    })
  })
}

const eventRemoveItemInWishlist = () => {
  const listButtonRemove = document.querySelectorAll("[button-remove]");
  listButtonRemove.forEach(button => {
    button.addEventListener("click", () => {
      const index = parseInt(button.getAttribute("button-remove"));
      const wishlist = JSON.parse(localStorage.getItem("wishlist"));
      wishlist.splice(index, 1);
      localStorage.setItem("wishlist", JSON.stringify(wishlist));
      drawNotify("success", "Product removed from wishlist!");
      window.location.reload();
    })
  })
}

const drawWishlistPage = () => {
  const wishlist = JSON.parse(localStorage.getItem("wishlist"));
  if(wishlist.length > 0) {
    fetch(`/wishlist/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(wishlist)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          localStorage.setItem("wishlist", JSON.stringify([]));
        }

        if(data.code == "success") {
          localStorage.setItem("wishlist", JSON.stringify(data.wishlist));

          let htmlWishlistTable = "";

          data.wishlist.forEach((item, index) => {
            const { detail } = item;
            let priceOld = 0;
            let priceNew = 0;
            let stock = 0;
            let htmlVariant = "";

            if(item.variant) {
              const variantMatched = detail.variants.find(variantItem => {
                return (
                  variantItem.attributeValue.every(attr => {
                    const selected = item.variant.find(v => v.attrId === attr.attrId);
                    return selected && selected.value === attr.value;
                  })
                );
              });
              priceOld = variantMatched.priceOld;
              priceNew = variantMatched.priceNew;
              stock = variantMatched.stock;

              detail.attributeList.forEach(attr => {
                const variant = item.variant.find(v => v.attrId === attr._id);
                htmlVariant += `
                  <span>
                    <b>${attr.name}:</b> ${variant.label}
                  </span>
                `;
              })
            } else {
              priceOld = detail.priceOld;
              priceNew = detail.priceNew;
              stock = detail.stock;
            }

            htmlWishlistTable += `
              <tr
                cart-item
                product-id="${item.productId}"
                ${item.variant ? `variant="${encodeURIComponent(JSON.stringify(item.variant))}"` : ''}
              >
                <td class="cart_page_img">
                  <div class="img">
                    <img class="img-fluid w-100" alt="${detail.name}" src="${domainCDN}${detail.images[0]}">
                  </div>
                </td>
                <td class="cart_page_details">
                  <a class="title" href="/product/detail/${detail.slug}">${detail.name}</a>
                  <p>
                    ${priceNew.toLocaleString('vi-VN')} VND
                    <del>${priceOld.toLocaleString('vi-VN')} VND</del>
                  </p>
                  ${htmlVariant}
                </td>
                <td class="cart_page_price">
                  <h3>${priceNew.toLocaleString('vi-VN')} VND</h3>
                </td>
                <td class="cart_page_quantity">
                  <div class="details_qty_input">
                    <button class="minus">
                      <i class="fas fa-minus" aria-hidden="true"></i>
                    </button>
                    <input
                      value="${item.quantity}"
                      type="number"
                      readonly=""
                      min="1"
                      max="${stock}"
                    />
                    <button class="plus">
                      <i class="fas fa-plus" aria-hidden="true"></i>
                    </button>
                  </div>
                </td>
                <td class="cart_page_price">
                  <h3>${(item.quantity*priceNew).toLocaleString('vi-VN')} VND</h3>
                </td>
                <td class="cart_page_action">
                  ${
                    stock > 0 ?
                    '<a class="common_btn" href="javascript:;" button-add="'+index+'">Add to Cart</a>'
                    :
                    '<div class="text-danger">Out of stock</div>'
                  }
                  <a class="remove common_btn" href="javascript:;" button-remove="${index}">Delete</a>
                </td>
              </tr>
            `;
          })

          const wishlistTable = document.querySelector("[wishlist-table]");
          wishlistTable.innerHTML = htmlWishlistTable;

          eventQuantityItemInWishlist();
          eventAddItemToCartInWishlist();
          eventRemoveItemInWishlist();
        }
      })
  } else {
    const area = document.querySelector(".wishlist_page .cart_table_area");
    if(area) {
      area.innerHTML = emptyStateHTML("fa-heart", "Your wishlist is empty", "Save products you love and find them here later.", "Continue Shopping", "/product");
    }
  }
}

const wishlistPage = document.querySelector(".wishlist_page");
if(wishlistPage) {
  drawWishlistPage();
}

const registerForm = document.querySelector("#registerForm");
if(registerForm) {
  const validation = new JustValidate('#registerForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#phone', [
      {
        rule: 'required',
        errorMessage: 'Please enter phone number!'
      },
      {
        rule: 'customRegexp',
        value: /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/,
        errorMessage: "Invalid phone number format!"
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: "Please enter password!"
      },
      {
        rule: 'minLength',
        value: 8,
        errorMessage: "Password must be at least 8 characters long!"
      },
      {
        rule: 'customRegexp',
        value: /[A-Z]/,
        errorMessage: "Password must contain at least one uppercase letter!"
      },
      {
        rule: 'customRegexp',
        value: /[a-z]/,
        errorMessage: "Password must contain at least one lowercase letter!"
      },
      {
        rule: 'customRegexp',
        value: /\d/,
        errorMessage: "Password must contain at least one digit!"
      },
      {
        rule: 'customRegexp',
        value: /[~!@#$%^&*]/,
        errorMessage: "Password must contain at least one special character! (~!@#$%^&*)"
      },
    ])
    .addField('#confirmPassword', [
      {
        rule: 'required',
        errorMessage: 'Please confirm your password!',
      },
      {
        validator: (value, fields) => {
          const password = fields['#password'].elem.value;
          return value == password;
        },
        errorMessage: 'Confirm password does not match!',
      }
    ])
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const phone = event.target.phone.value;
      const password = event.target.password.value;

      const dataFinal = {
        fullName: fullName,
        email: email,
        phone: phone,
        password: password,
      };

      const unlock = lockSubmit(event.target.querySelector('button[type="submit"]'));

      fetch(`/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
            unlock();
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            window.location.href = `/`;
          }
        })
        .catch(() => {
          notyf.error("Something went wrong, please try again!");
          unlock();
        })
    })
  ;
}

const loginForm = document.querySelector("#loginForm");
if(loginForm) {
  const validation = new JustValidate('#loginForm');

  validation
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: "Please enter password!"
      },
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      const password = event.target.password.value;
      const rememberPassword = event.target.rememberPassword.checked;

      const dataFinal = {
        email: email,
        password: password,
        rememberPassword: rememberPassword
      };

      const unlock = lockSubmit(event.target.querySelector('button[type="submit"]'));

      fetch(`/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
            unlock();
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            window.location.href = `/`;
          }
        })
        .catch(() => {
          notyf.error("Something went wrong, please try again!");
          unlock();
        })
    })
  ;
}

const forgotPasswordForm = document.querySelector("#forgotPasswordForm");
if(forgotPasswordForm) {
  const validation = new JustValidate('#forgotPasswordForm');

  validation
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;

      const dataFinal = {
        email: email
      };

      fetch(`/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            window.location.href = `/auth/otp-password?email=${email}`;
          }
        })
    })
  ;
}

const otpPasswordForm = document.querySelector("#otpPasswordForm");
if(otpPasswordForm) {
  const validation = new JustValidate('#otpPasswordForm');

  validation
    .addField('#otp', [
      {
        rule: 'required',
        errorMessage: 'Please enter OTP code!',
      },
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      const otp = event.target.otp.value;

      const dataFinal = {
        email: email,
        otp: otp
      };

      fetch(`/auth/otp-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            window.location.href = `/auth/reset-password`;
          }
        })
    })
  ;
}

const resetPasswordForm = document.querySelector("#resetPasswordForm");
if(resetPasswordForm) {
  const validation = new JustValidate('#resetPasswordForm');

  validation
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: "Please enter new password!"
      },
      {
        rule: 'minLength',
        value: 8,
        errorMessage: "Password must be at least 8 characters long!"
      },
      {
        rule: 'customRegexp',
        value: /[A-Z]/,
        errorMessage: "Password must contain at least one uppercase letter!"
      },
      {
        rule: 'customRegexp',
        value: /[a-z]/,
        errorMessage: "Password must contain at least one lowercase letter!"
      },
      {
        rule: 'customRegexp',
        value: /\d/,
        errorMessage: "Password must contain at least one digit!"
      },
      {
        rule: 'customRegexp',
        value: /[~!@#$%^&*]/,
        errorMessage: "Password must contain at least one special character! (~!@#$%^&*)"
      },
    ])
    .addField('#confirmPassword', [
      {
        rule: 'required',
        errorMessage: 'Please confirm your password!',
      },
      {
        validator: (value, fields) => {
          const password = fields['#password'].elem.value;
          return value == password;
        },
        errorMessage: 'Confirm password does not match!',
      }
    ])
    .onSuccess((event) => {
      const password = event.target.password.value;

      const dataFinal = {
        password: password,
      };

      fetch(`/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            const dataHrefSuccess = resetPasswordForm.getAttribute("data-href-success");
            window.location.href = dataHrefSuccess ? dataHrefSuccess : `/`;
          }
        })
    })
  ;
}

const dashboardProfileEditForm = document.querySelector("#dashboardProfileEditForm");
if(dashboardProfileEditForm) {
  const validation = new JustValidate('#dashboardProfileEditForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#phone', [
      {
        rule: 'customRegexp',
        value: /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/,
        errorMessage: "Invalid phone number format!"
      },
    ])
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const phone = event.target.phone.value;

      const dataFinal = {
        fullName: fullName,
        email: email,
        phone: phone,
      };

      fetch(`/dashboard/profile/edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}

const dashboardAddressCreateForm = document.querySelector("#dashboardAddressCreateForm");
if(dashboardAddressCreateForm) {
  const validation = new JustValidate('#dashboardAddressCreateForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#phone', [
      {
        rule: 'required',
        errorMessage: 'Please enter phone number!'
      },
      {
        rule: 'customRegexp',
        value: /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/,
        errorMessage: "Invalid phone number format!"
      },
    ])
    .addField('#address', [
      {
        rule: 'required',
        errorMessage: 'Please enter street name, building, house number!',
      },
    ])
    .addField('#longitude', [
      {
        rule: 'required',
        errorMessage: 'Invalid address!',
      },
    ])
    .addField('#latitude', [
      {
        rule: 'required',
        errorMessage: 'Invalid address!',
      },
    ])
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const phone = event.target.phone.value;
      const address = event.target.address.value;
      const longitude = event.target.longitude.value;
      const latitude = event.target.latitude.value;
      const isDefault = event.target.isDefault.checked;

      const dataFinal = {
        fullName: fullName,
        phone: phone,
        address: address,
        longitude: longitude,
        latitude: latitude,
        isDefault: isDefault,
      };

      fetch(`/dashboard/address/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            window.location.href = `/dashboard/address`;
          }
        })
    })
  ;
}

const listButtonApi = document.querySelectorAll("[button-api]");
if(listButtonApi.length > 0) {
  const runButtonApi = (button) => {
    const method = button.getAttribute("data-method");
    const api = button.getAttribute("data-api");
    const unlock = lockSubmit(button);

    fetch(api, {
      method: method || "GET"
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
          unlock();
        }

        if(data.code == "success") {
          drawNotify(data.code, data.message);
          location.reload();
        }
      })
      .catch(() => {
        notyf.error("Something went wrong, please try again!");
        unlock();
      });
  };

  listButtonApi.forEach(button => {
    button.addEventListener("click", () => {
      const confirmMessage = button.getAttribute("data-confirm");
      if(confirmMessage) {
        confirmAction(confirmMessage, () => runButtonApi(button));
        return;
      }
      runButtonApi(button);
    })
  })
}

const boxMap = document.querySelector("#boxMap");
let map = null;
if(boxMap) {

  map = new ol.Map({
    target: 'boxMap',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([105.8163212, 21.0227384]),
      zoom: 13
    })
  });

  const markerLayer = new ol.layer.Vector({ source: new ol.source.Vector() });
  map.addLayer(markerLayer);

  const setMarker = (lon, lat) => {
    markerLayer.getSource().clear();
    const marker = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
    });

    marker.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 1],
        src: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        scale: 0.5
      })
    }));

    markerLayer.getSource().addFeature(marker);
  }

  const inputLon = document.querySelector(`[name="longitude"]`);
  const inputLat = document.querySelector(`[name="latitude"]`);
  if(inputLon.value && inputLat.value) {
    const lon = parseFloat(inputLon.value);
    const lat = parseFloat(inputLat.value);
    setMarker(lon, lat);
    map.getView().animate({ center: ol.proj.fromLonLat([lon, lat]), zoom: 15 });
  }

  map.on('click', (event) => {
    const coord = ol.proj.toLonLat(event.coordinate);
    const lon = coord[0];
    const lat = coord[1];
    setMarker(lon, lat);

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(data => {
        if(data && data.display_name) {
          const inputAddress = document.querySelector(`[name="address"]`);
          inputAddress.value = data.display_name;

          const inputLon = document.querySelector(`[name="longitude"]`);
          inputLon.value = lon;

          const inputLat = document.querySelector(`[name="latitude"]`);
          inputLat.value = lat;

          drawCart();
        } else {
          notyf.error("Address not found!");
        }
      })
  });

  const searchInput = document.querySelector("#mapSearchInput");
  const searchBtn = document.querySelector("#mapSearchBtn");
  searchBtn.addEventListener("click", () => {
    const keyword = searchInput.value;
    if(!keyword) {
      notyf.error("Please enter search address!");
      return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&countrycodes=vn`)
      .then(res => res.json())
      .then(data => {
        if(data && data.length > 0) {
          const firstResult = data[0];
          const lon = parseFloat(firstResult.lon);
          const lat = parseFloat(firstResult.lat);
          setMarker(lon, lat);
          map.getView().animate({ center: ol.proj.fromLonLat([lon, lat]), zoom: 15 });

          const inputAddress = document.querySelector(`[name="address"]`);
          inputAddress.value = firstResult.display_name;

          const inputLon = document.querySelector(`[name="longitude"]`);
          inputLon.value = lon;

          const inputLat = document.querySelector(`[name="latitude"]`);
          inputLat.value = lat;
        } else {
          notyf.error("Address not found!");
        }
	  });
  })
}

const dashboardAddressEditForm = document.querySelector("#dashboardAddressEditForm");
if(dashboardAddressEditForm) {
  const validation = new JustValidate('#dashboardAddressEditForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#phone', [
      {
        rule: 'required',
        errorMessage: 'Please enter phone number!'
      },
      {
        rule: 'customRegexp',
        value: /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/,
        errorMessage: "Invalid phone number format!"
      },
    ])
    .addField('#address', [
      {
        rule: 'required',
        errorMessage: 'Please enter street name, building, house number!',
      },
    ])
    .addField('#longitude', [
      {
        rule: 'required',
        errorMessage: 'Invalid address!',
      },
    ])
    .addField('#latitude', [
      {
        rule: 'required',
        errorMessage: 'Invalid address!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const fullName = event.target.fullName.value;
      const phone = event.target.phone.value;
      const address = event.target.address.value;
      const longitude = parseFloat(event.target.longitude.value);
      const latitude = parseFloat(event.target.latitude.value);
      const isDefault = event.target.isDefault.checked;

      const dataFinal = {
        fullName: fullName,
        phone: phone,
        address: address,
        longitude: longitude,
        latitude: latitude,
        isDefault: isDefault,
      };

      fetch(`/dashboard/address/edit/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}

const profilePhoto = document.querySelector("#profile_photo");
if(profilePhoto) {
  profilePhoto.addEventListener("change", (event) => {
    const avatar = event.target.files[0];
    if(avatar) {
      const formData = new FormData();
      formData.append("avatar", avatar);

      fetch(`/dashboard/profile/change-avatar`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            const profilePhotoPreview = document.querySelector("[profile-photo-preview]");
            profilePhotoPreview.src = `${domainCDN}${data.linkAvatar}`;
            notyf.success(data.message);
          }
        })
    }
  })
}

const applyCouponForm = document.querySelector("#applyCouponForm");

function checkCoupon(coupon) {
  const elementViewCoupon = document.querySelector("#applyCouponForm .inner-view-coupon");
  const elementCoupon = elementViewCoupon.querySelector(".inner-coupon");

  const dataFinal = {
    coupon: coupon,
  };

  fetch(`/coupon/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(dataFinal)
  })
    .then(res => res.json())
    .then(data => {
      if(data.code == "error") {
        notyf.error(data.message);
        elementViewCoupon.style.display = "none";
        sessionStorage.removeItem("couponDetail");
      }

      if(data.code == "success") {
        notyf.success(data.message);
        elementViewCoupon.style.display = "flex";
        elementCoupon.innerHTML = coupon;
        sessionStorage.setItem("couponDetail", JSON.stringify(data.couponDetail));
      }

      drawCart();
    })
}

if(applyCouponForm) {
  applyCouponForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const coupon = event.target.coupon.value;
    if(!coupon) {
      notyf.error("Please enter coupon code!");
      return;
    }
    checkCoupon(coupon);
  })

  const buttonRemove = document.querySelector("#applyCouponForm .inner-view-coupon .inner-remove");
  if(buttonRemove) {
    const elementViewCoupon = document.querySelector("#applyCouponForm .inner-view-coupon");
    buttonRemove.addEventListener("click", () => {
      elementViewCoupon.style.display = "none";
      sessionStorage.removeItem("couponDetail");
      drawCart();
    })
  }
}

const checkoutPage = document.querySelector(".checkout_page");
if(checkoutPage) {
  const listInputUserAddress = checkoutPage.querySelectorAll(`input[name="userAddress"]`);

  const collapseEl = checkoutPage.querySelector("#collapseThree");
  const collapse = new bootstrap.Collapse(collapseEl, { toggle: false });

  listInputUserAddress.forEach(input => {
    input.addEventListener("change", () => {
      listInputUserAddress.forEach(i => {
        if(input.value == i.value) {
          i.checked = true;
        } else {
          i.checked = false;
        }
      });
      if(input.value == "") {
        collapse.show();
      } else {
        collapse.hide();
      }
      if(map) {
        map.updateSize();
      }

      drawCart();
    })
  })
}

const buttonOrder = document.querySelector("[button-order]");
if(buttonOrder) {
  buttonOrder.addEventListener("click", () => {
    const inputUserAddressChecked = document.querySelector(`input[name="userAddress"]:checked`);
    if(!inputUserAddressChecked) {
      notyf.error("Please enter address!");
      return;
    }
    const dataUser = {};
    if(inputUserAddressChecked.value) {
      const info = JSON.parse(inputUserAddressChecked.getAttribute("data-info"));
      dataUser.fullName = info.fullName;
      dataUser.phone = info.phone;
      dataUser.address = info.address;
      dataUser.longitude = info.longitude;
      dataUser.latitude = info.latitude;
    } else {
      const checkoutAddressForm = document.querySelector("#checkoutAddressForm");
      dataUser.fullName = checkoutAddressForm.fullName.value;
      dataUser.phone = checkoutAddressForm.phone.value;
      dataUser.address = checkoutAddressForm.address.value;
      dataUser.longitude = parseFloat(checkoutAddressForm.longitude.value);
      dataUser.latitude = parseFloat(checkoutAddressForm.latitude.value);
    }
    const textareaNote = document.querySelector(`textarea[name="note"]`);
    dataUser.note = textareaNote.value;

    let dataCart = JSON.parse(localStorage.getItem("cart"));
    dataCart = dataCart.filter(item => {
      delete item.detail;
      return item.checked;
    });

    let dataCoupon = "";
    let coupon = sessionStorage.getItem("couponDetail");
    if(coupon) {
      coupon = JSON.parse(coupon);
      dataCoupon = coupon.code;
    }

    const inputPaymentMethodChecked = document.querySelector(`input[name="paymentMethod"]:checked`);
    const dataPaymentMethod = inputPaymentMethodChecked.value;

    const inputShippingMethodChecked = document.querySelector(`input[name="shippingMethod"]:checked`);
    const dataShippingMethod = inputShippingMethodChecked?.value;
    if(!dataShippingMethod) {
      notyf.error("Please select shipping method!");
      return;
    }

    const usePointCheckbox = document.querySelector("[use-point-checkbox]");
    const dataUsePoint = usePointCheckbox ? usePointCheckbox.checked : false;

    const dataFinal = {
      ...dataUser,
      items: dataCart,
      coupon: dataCoupon,
      paymentMethod: dataPaymentMethod,
      shippingMethod: dataShippingMethod,
      usePoint: dataUsePoint
    };

    const unlock = lockSubmit(buttonOrder);

    fetch(`/order/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataFinal)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
          unlock();
        }

        if(data.code == "success") {
          let cart = JSON.parse(localStorage.getItem("cart"));
          cart = cart.filter(item => item.checked == false);
          localStorage.setItem("cart", JSON.stringify(cart));

          sessionStorage.removeItem("couponDetail");

          switch (dataPaymentMethod) {
            case "money":
              drawNotify(data.code, data.message);
              window.location.href = `/order/success?orderCode=${data.orderCode}&phone=${data.phone}`;
              break;
            case "zalopay":
              window.location.href = `/order/payment-zalopay?orderCode=${data.orderCode}&phone=${data.phone}`;
              break;
            case "vnpay":
              window.location.href = `/order/payment-vnpay?orderCode=${data.orderCode}&phone=${data.phone}`;
              break;
            default:
              window.location.href = "/";
              break;
          }
        }
      })
      .catch(() => {
        notyf.error("Something went wrong, please try again!");
        unlock();
      })
  })
}

const listButtonReview = document.querySelectorAll("[data-bs-target='#modalReview']");
if(listButtonReview.length > 0) {
  const modalReview = document.querySelector("#modalReview");
  const formReview = document.querySelector("[form-review]");
  let productName = "";
  let orderItemId = "";
  let variant = "";
  listButtonReview.forEach(button => {
    button.addEventListener("click", () => {
      productName = button.getAttribute("product-name");
      orderItemId = button.getAttribute("order-item-id");
      variant = button.getAttribute("variant");
      variant = variant ? `(${variant})` : "";

      const modalTitle = modalReview.querySelector("[product-name]");
      modalTitle.innerHTML = `${productName} ${variant}`;

      formReview.orderItemId.value = orderItemId;

      const listStar = formReview.querySelectorAll(`[rating] i`);
      listStar.forEach(star => star.classList.remove("active"));

      formReview.comment.value = "";

      const listPreviewImage = formReview.querySelectorAll("[images] .gallery .apnd-img");
      listPreviewImage.forEach(img => img.remove());
      const listInputImage = formReview.querySelectorAll("[images] .gallery input");
      listInputImage.forEach(input => input.remove());
    })
  })

  formReview.addEventListener("submit", (event) => {
    event.preventDefault();
    const orderId = formReview.orderId.value;
    const orderItemId = formReview.orderItemId.value;
    const rating = formReview.querySelectorAll(`[rating] i.active`).length;
    const comment = formReview.comment.value.trim();
    const inputImages = formReview.querySelectorAll("[images] .gallery input");
    const images = [];
    inputImages.forEach(input => {
      if(input.files[0]) {
        images.push(input.files[0]);
      }
    });

    if(!orderId || !orderItemId) {
      notyf.error("An error occurred, please try again!");
      return;
    }

    if(rating == 0) {
      notyf.error("Please select rating stars!");
      return;
    }
    if(comment.length == 0) {
      notyf.error("Please enter review comment!");
      return;
    }
    if(comment.length > 300) {
      notyf.error("Comment cannot exceed 300 characters!");
      return;
    }

    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("orderItemId", orderItemId);
    formData.append("rating", rating);
    formData.append("comment", comment);
    images.forEach(image => {
      formData.append(`images`, image);
    });

    fetch(`/dashboard/order/review`, {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
        }
        if(data.code == "success") {
          drawNotify(data.code, data.message);
          window.location.reload();
        }
      })
  })
}

const modalReportReview = document.getElementById("modalReportReview");
const btnConfirmReport = document.getElementById("btnConfirmReport");
if (modalReportReview && btnConfirmReport) {
  let pendingReviewId = null;
  let pendingBtn = null;

  modalReportReview.addEventListener("show.bs.modal", (e) => {
    const trigger = e.relatedTarget;
    if (trigger) {
      pendingReviewId = trigger.getAttribute("data-review-id");
      pendingBtn = trigger;
    }
  });

  btnConfirmReport.addEventListener("click", async () => {
    if (!pendingReviewId) return;
    const reviewId = pendingReviewId;
    const btn = pendingBtn;

    bootstrap.Modal.getInstance(modalReportReview).hide();
    btnConfirmReport.disabled = true;

    try {
      const res = await fetch(`/product/review/report/${reviewId}`, { method: "POST" });
      const data = await res.json();
      if (data.code === "success") {
        if (btn) btn.outerHTML = `<span class="review-report-done"><i class="fas fa-flag"></i> Reported</span>`;
        notyf.success(data.message);
      } else {
        notyf.error(data.message);
      }
    } catch {
      notyf.error("Something went wrong!");
    }

    btnConfirmReport.disabled = false;
    pendingReviewId = null;
    pendingBtn = null;
  });
}

const listInputFilterRating = document.querySelectorAll(`.sidebar_rating input[name="rating"]`);
if(listInputFilterRating.length > 0) {
  const url = new URL(window.location.href);

  listInputFilterRating.forEach(input => {
    input.addEventListener("change", () => {
      const listInputChecked = document.querySelectorAll(`.sidebar_rating input[name="rating"]:checked`);
      if(listInputChecked.length > 0) {
        const listValue = [];
        listInputChecked.forEach(input => {
          listValue.push(input.value);
        });
        url.searchParams.set("rating", listValue.join(","));
      } else {
        url.searchParams.delete("rating");
      }
      window.location.href = url.href;
    })
  })

  const rating = url.searchParams.get("rating");
  if(rating) {
    const listRating = rating.split(",");
    listRating.forEach(item => {
      const input = document.querySelector(`.sidebar_rating input[name="rating"][value="${item}"]`);
      if(input) {
        input.checked = true;
      }
    })
  }
}

let savedLang = localStorage.getItem("selectedLanguage");
if (!savedLang) {
  savedLang = "en";
  localStorage.setItem("selectedLanguage", "en");
}

document.cookie = "googtrans=; path=" + window.location.pathname + "; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";

document.cookie = `googtrans=/en/${savedLang}; path=/; max-age=31536000;`;

const gtranslateWrapper = document.querySelector(".gtranslate_wrapper");
if(gtranslateWrapper) {
  window.gtranslateSettings = {
    "default_language":"en",
    "native_language_names":true,
    "detect_browser_language":false,
    "wrapper_selector":".gtranslate_wrapper",
    "flag_size":24,
    "globe_size":0,
    "switcher_horizontal_position":"inline"
  }

  setInterval(() => {
    let currentLang = "";

    const cookieMatch = document.cookie.match(/googtrans=([^;]+)/);
    if (cookieMatch) {
      const parts = cookieMatch[1].split('/');
      if (parts.length > 2) {
        currentLang = parts[2];
      }
    }

    if (!currentLang) {
      const selectedLangEl = gtranslateWrapper.querySelector(".gt_selected a") || gtranslateWrapper.querySelector(".gt_selected");
      if (selectedLangEl) {
        const text = selectedLangEl.textContent.trim().toLowerCase();
        if (text.includes("english") || text === "en") {
          currentLang = "en";
        } else if (text.includes("tiếng việt") || text === "vietnamese" || text === "vi") {
          currentLang = "vi";
        } else {
          const href = selectedLangEl.getAttribute("href");
          if (href && href.includes("googtrans")) {
            const match = href.match(/googtrans\(([^)]+)\)/);
            if (match && match[1]) {
              const parts = match[1].split('|');
              if (parts.length > 1) {
                currentLang = parts[1];
              }
            }
          }
        }
      }
    }

    if (currentLang && localStorage.getItem("selectedLanguage") !== currentLang) {
      localStorage.setItem("selectedLanguage", currentLang);
      document.cookie = "googtrans=; path=" + window.location.pathname + "; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";

      document.cookie = `googtrans=/en/${currentLang}; path=/; max-age=31536000;`;
    }
  }, 1000);

  const sortGtranslateOptions = () => {
    const optionContainer = gtranslateWrapper.querySelector(".gt_option");
    if(!optionContainer) return false;
    const links = Array.from(optionContainer.querySelectorAll("a"));
    if(links.length < 2) return false;

    links.sort((a, b) => {
      const textA = a.textContent.trim();
      const textB = b.textContent.trim();
      return textA.localeCompare(textB, "en", { sensitivity: "base" });
    });

    links.forEach(link => optionContainer.appendChild(link));
    return true;
  };

  const observer = new MutationObserver((mutations, obs) => {
    if(sortGtranslateOptions()) {
      obs.disconnect();
    }
  });
  observer.observe(gtranslateWrapper, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    setTimeout(sortGtranslateOptions, 1000);
  });
}

document.addEventListener('click', (e) => {
  const btnCart = e.target.closest('[btn-cart-quick]');
  if (btnCart) {
    e.preventDefault();
    const productId = btnCart.getAttribute('data-product-id');
    if (!productId) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find(i => i.productId === productId && !i.variant);
    if (existing) {
      existing.quantity += 1;
      notyf.success('Cart quantity updated!');
    } else {
      cart.unshift({ productId, quantity: 1, checked: true });
      notyf.success('Added to cart!');
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    miniCartQuantity();
    if (document.querySelector('[mini-cart]')) drawCart();
    return;
  }

  const btnCompare = e.target.closest('[btn-compare-quick]');
  if (btnCompare) {
    e.preventDefault();
    const productId = btnCompare.getAttribute('data-product-id');
    if (!productId) return;
    const compareList = JSON.parse(localStorage.getItem('compare') || '[]');
    if (compareList.length >= 5) { notyf.error('Maximum products for comparison reached!'); return; }
    if (compareList.find(i => i.productId === productId)) {
      notyf.success('Product already in comparison list!');
    } else {
      compareList.push({ productId });
      localStorage.setItem('compare', JSON.stringify(compareList));
      miniCompareQuantity();
      notyf.success('Added to comparison list!');
    }
    return;
  }

  const btnWishlist = e.target.closest('[btn-wishlist-quick]');
  if (btnWishlist) {
    e.preventDefault();
    const productId = btnWishlist.getAttribute('data-product-id');
    if (!productId) return;
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    if (wishlist.find(i => i.productId === productId)) {
      notyf.success('Product already in wishlist!');
    } else {
      wishlist.unshift({ productId, quantity: 1 });
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
      miniWishlistQuantity();
      notyf.success('Added to wishlist!');
    }
    return;
  }
});

document.addEventListener('click', (e) => {
  const telLink = e.target.closest('a[href^="tel:"]');
  if (telLink) {
    e.preventDefault();
    const href = telLink.getAttribute('href');
    const text = telLink.textContent.trim();

    const modalEl = document.querySelector('#modalPhoneConfirm');
    if (modalEl) {
      const msgEl = modalEl.querySelector('#modalPhoneConfirmMessage');
      const callBtn = modalEl.querySelector('#modalPhoneConfirmCall');

      if (msgEl) {
        msgEl.textContent = `Would you like to call ${text || href.replace('tel:', '')}?`;
      }
      if (callBtn) {
        callBtn.setAttribute('href', href);
      }

      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      callBtn.addEventListener('click', () => {
        bsModal.hide();
      }, { once: true });
    } else {
      window.location.href = href;
    }
  }
});

const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  const validation = new JustValidate('#contact-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter your name!',
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Name cannot exceed 50 characters!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#subject', [
      {
        validator: (value) => {
          if (!value) return true;
          return value.length >= 5 && value.length <= 100;
        },
        errorMessage: 'Subject must be between 5 and 100 characters!',
      }
    ])
    .addField('#message', [
      {
        rule: 'required',
        errorMessage: 'Please enter your message!',
      },
      {
        rule: 'minLength',
        value: 10,
        errorMessage: 'Message must be at least 10 characters long!',
      },
      {
        rule: 'maxLength',
        value: 500,
        errorMessage: 'Message cannot exceed 500 characters!',
      },
    ])
    .onSuccess(async (event) => {
      const name = event.target.querySelector('#name').value.trim();
      const email = event.target.querySelector('#email').value.trim();
      const subject = event.target.querySelector('#subject').value.trim();
      const message = event.target.querySelector('#message').value.trim();

      const btn = event.target.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      try {
        const res = await fetch('/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email, subject, message }),
        });
        const data = await res.json();
        if (data.code === 'success') {
          notyf.success(data.message);
          event.target.reset();
          validation.reset();
        } else {
          notyf.error(data.message);
        }
      } catch (err) {
        console.error('[Contact submit error]', err);
        notyf.error('Something went wrong. Please try again.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
}
