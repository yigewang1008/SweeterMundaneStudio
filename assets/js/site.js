/* ==========================================================================
   Sweeter Mundane Studio — storefront logic
   Vanilla JS, no build step. Works from file:// and from any static host.
   ========================================================================== */
(function () {
  "use strict";

  var PRODUCTS = window.SMS_PRODUCTS || [];
  var CATEGORIES = window.SMS_CATEGORIES || [];

  var BAG_KEY = "sms.bag.v1";
  var STATE_KEY = "sms.state.v1";

  /* ----------------------------------------------------------- utilities */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
  }

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  function productBySlug(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    return null;
  }

  /* --------------------------------------------------------------- price */

  // "FROM $25.00" when the listing has a range; "$40.00" when it does not.
  function priceLabel(p) {
    if (p.priceHigh > p.priceLow) {
      return "FROM " + money(p.priceLow) + " <span>&ndash; " + money(p.priceHigh) + "</span>";
    }
    return money(p.priceLow);
  }

  /* ----------------------------------------------------------------- bag */

  var Bag = {
    items: readJSON(BAG_KEY, []),

    save: function () { writeJSON(BAG_KEY, Bag.items); },

    count: function () {
      return Bag.items.reduce(function (n, it) { return n + it.qty; }, 0);
    },

    subtotal: function () {
      return Bag.items.reduce(function (n, it) { return n + it.price * it.qty; }, 0);
    },

    add: function (product, variant, qty) {
      var key = product.id + "|" + (variant ? variant.label : "Standard");
      var existing = null;
      for (var i = 0; i < Bag.items.length; i++) {
        if (Bag.items[i].key === key) { existing = Bag.items[i]; break; }
      }
      if (existing) {
        existing.qty += qty;
      } else {
        Bag.items.push({
          key: key,
          id: product.id,
          slug: product.slug,
          title: product.title,
          variant: variant ? variant.label : "Standard",
          price: variant ? variant.price : product.priceLow,
          qty: qty,
          image: product.images.length ? product.images[0].src : "",
          etsyUrl: product.etsyUrl
        });
      }
      Bag.save();
      renderBagCount();
      openBag();
    },

    setQty: function (key, qty) {
      if (qty <= 0) {
        Bag.items = Bag.items.filter(function (it) { return it.key !== key; });
      } else {
        Bag.items.forEach(function (it) { if (it.key === key) it.qty = qty; });
      }
      Bag.save();
      renderBagCount();
      renderBagItems();
    },

    clear: function () { Bag.items = []; Bag.save(); renderBagCount(); renderBagItems(); }
  };

  /* ------------------------------------------------------- bag rendering */

  function renderBagCount() {
    $$("[data-bag-count]").forEach(function (el) {
      el.textContent = "BAG (" + Bag.count() + ")";
    });
  }

  function renderBagItems() {
    var list = $("[data-bag-items]");
    if (!list) return;

    if (!Bag.items.length) {
      list.innerHTML = '<p class="bag__empty">Your bag is empty</p>';
      $("[data-bag-total]").textContent = "$0";
      $("[data-bag-checkout]").disabled = true;
      return;
    }

    list.innerHTML = Bag.items.map(function (it) {
      return '<div class="bag__item">' +
        '<img src="' + esc(it.image) + '" alt="">' +
        '<div>' +
          '<h3>' + esc(it.title) + "</h3>" +
          "<p>" + esc(it.variant) + "</p>" +
          '<p class="bag__price">' + money(it.price) + " &times; " + it.qty + "</p>" +
          '<button class="bag__remove" data-bag-remove="' + esc(it.key) + '">Remove</button>' +
        "</div>" +
      "</div>";
    }).join("");

    $("[data-bag-total]").textContent = money(Bag.subtotal());
    $("[data-bag-checkout]").disabled = false;
  }

  function openBag() {
    var bag = $("[data-bag]");
    if (!bag) return;
    renderBagItems();
    bag.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var close = $("[data-bag-close]");
    if (close) close.focus();
  }

  function closeBag() {
    var bag = $("[data-bag]");
    if (!bag) return;
    bag.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------ card grid */

  function cardHTML(p) {
    var img = p.images.length ? p.images[0].src : "";
    var sold = p.quantity !== null && p.quantity !== undefined && p.quantity <= 0;
    return '<a class="card" href="product.html?p=' + encodeURIComponent(p.slug) + '">' +
      '<div class="card__media">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy">' : "") +
        '<span class="card__tag">' + esc(p.categoryLabel) + "</span>" +
        (sold ? '<span class="card__soldout">Sold out</span>' : "") +
      "</div>" +
      '<div class="card__body">' +
        "<div>" +
          '<h3 class="card__title">' + esc(p.title) + "</h3>" +
          '<p class="card__price">' + priceLabel(p) + "</p>" +
        "</div>" +
        '<svg class="card__plus" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
          '<path d="M14.25 31.75V17.75H0.25V14.25H14.25V0.25H17.75V14.25H31.75V17.75H17.75V31.75H14.25Z" fill="#1D1D1B"></path>' +
        "</svg>" +
      "</div>" +
    "</a>";
  }

  /* ----------------------------------------------------------- catalogue */

  var state = readJSON(STATE_KEY, { category: "all", sort: "featured", q: "" });

  function filtered() {
    var list = PRODUCTS.slice();

    if (state.category !== "all") {
      list = list.filter(function (p) { return p.category === state.category; });
    }
    if (state.q) {
      var q = state.q.toLowerCase();
      list = list.filter(function (p) {
        return (p.title + " " + p.description + " " + p.tags.join(" ")).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (state.sort === "price-asc") list.sort(function (a, b) { return a.priceLow - b.priceLow; });
    else if (state.sort === "price-desc") list.sort(function (a, b) { return b.priceLow - a.priceLow; });
    else if (state.sort === "name") list.sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (state.sort === "new") list.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });

    return list;
  }

  function renderCatalogue() {
    var grid = $("[data-grid]");
    if (!grid) return;

    var list = filtered();

    var count = $("[data-count]");
    if (count) count.textContent = list.length + " " + (list.length === 1 ? "piece" : "pieces");

    if (!list.length) {
      grid.innerHTML = '<p class="empty">Nothing matches that yet</p>';
    } else {
      grid.innerHTML = list.map(cardHTML).join("");
    }

    $$("[data-filter]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-filter") === state.category));
    });
  }

  /* ------------------------------------------------------------- product */

  function renderProduct() {
    var slug = new URLSearchParams(location.search).get("p");
    var p = slug ? productBySlug(slug) : null;
    var host = $("[data-product]");
    if (!host) return;

    if (!p) {
      host.innerHTML = '<p class="empty">That piece is no longer available</p>';
      return;
    }

    document.title = p.title + " — Sweeter Mundane Studio";

    var stage = '<div class="product__stage"><img id="product-stage-img" src="' +
      esc(p.images.length ? p.images[0].src : "") + '" alt="' + esc(p.title) + '"></div>';

    var thumbs = p.images.length > 1
      ? '<div class="product__thumbs">' + p.images.map(function (im, i) {
          return '<button type="button" data-thumb="' + esc(im.src) + '"' +
            (i === 0 ? ' aria-current="true"' : "") +
            ' aria-label="View image ' + (i + 1) + '"><img src="' + esc(im.src) + '" alt=""></button>';
        }).join("") + "</div>"
      : "";

    /* option groups ------------------------------------------------------ */
    var optionsHTML = "";
    if (p.variants.length) {
      var names = p.optionNames.length ? p.optionNames : ["Option"];
      optionsHTML = names.map(function (name) {
        var seen = [];
        var values = [];
        p.variants.forEach(function (v) {
          var val = v.options[name];
          if (val && seen.indexOf(val) === -1) { seen.push(val); values.push(val); }
        });
        if (!values.length) return "";
        return '<div class="product__section">' +
          '<h3>' + esc(name) + "</h3>" +
          '<div class="opt-group"><div class="opt-row" data-opt="' + esc(name) + '">' +
          values.map(function (val) {
            return '<button type="button" class="opt" data-value="' + esc(val) + '" aria-pressed="false">' + esc(val) + "</button>";
          }).join("") + "</div></div></div>";
      }).join("");
    }

    var priceHTML = p.priceHigh > p.priceLow
      ? money(p.priceLow) + " <small>&ndash; " + money(p.priceHigh) + " depending on options</small>"
      : money(p.priceLow);

    var desc = p.description || "";
    var details = "";
    if (p.materials && p.materials.length) {
      details += "<p><b>Materials</b> &middot; " + esc(p.materials.join(", ")) + "</p>";
    }
    if (p.isPersonalizable) details += "<p><b>Personalizable</b> &middot; Add your own names, dates, or details at checkout.</p>";
    if (p.isCustomizable) details += "<p><b>Custom orders</b> &middot; Color and size changes available on request.</p>";

    host.innerHTML =
      '<div class="product__media">' + stage + thumbs + "</div>" +
      '<div class="product__info">' +
        '<p class="product__crumb"><a href="index.html">Shop</a> / ' + esc(p.categoryLabel) + "</p>" +
        '<h1 class="product__title">' + esc(p.title) + "</h1>" +
        '<p class="product__price">' + priceHTML + "</p>" +
        (desc ? '<p class="product__desc">' + esc(desc) + "</p>" : "") +
        optionsHTML +
        '<div class="product__section">' +
          '<h3>Quantity</h3>' +
          '<div class="qty"><button type="button" data-qty="-1" aria-label="Decrease quantity">&minus;</button>' +
          '<span data-qty-value>1</span>' +
          '<button type="button" data-qty="1" aria-label="Increase quantity">+</button></div>' +
        "</div>" +
        '<div class="product__actions">' +
          '<button class="btn" data-add-to-bag>Add to bag</button>' +
          '<a class="btn btn--ghost" href="' + esc(p.etsyUrl) + '" target="_blank" rel="noopener">Buy on Etsy</a>' +
        "</div>" +
        '<div class="product__meta">' + details +
          "<p>Printed to order in our Houston studio. Ships in 3&ndash;7 business days.</p>" +
          "<p><b>Questions?</b> Message us on Etsy for sizing or custom requests.</p>" +
        "</div>" +
      "</div>";

    wireProduct(p);
  }

  function wireProduct(p) {
    var selected = {};          // optionName -> chosen value
    var qty = 1;
    var qtyEl = $("[data-qty-value]");

    function matchingVariants(ignoreUnset) {
      var names = p.optionNames;
      if (!names.length) return p.variants;
      return p.variants.filter(function (v) {
        return names.every(function (n) {
          if (ignoreUnset && !selected[n]) return true;
          return selected[n] && v.options[n] === selected[n];
        });
      });
    }

    function refresh() {
      // option availability: a value is live if some variant pairs it with the
      // other currently-chosen options and is itself available.
      $$("[data-opt]").forEach(function (row) {
        var name = row.getAttribute("data-opt");
        $$(".opt", row).forEach(function (btn) {
          var val = btn.getAttribute("data-value");
          var probe = Object.assign({}, selected);
          probe[name] = val;
          var names = p.optionNames;
          var ok = p.variants.some(function (v) {
            if (!v.available) return false;
            return names.every(function (n) { return !probe[n] || v.options[n] === probe[n]; });
          });
          btn.disabled = !ok;
        });
      });

      // Narrow the price using the options chosen so far. Variants consistent
      // with the current picks (ignoring options not yet chosen) give the range
      // the shopper can still land on.
      var partial = matchingVariants(true);
      var lo = Infinity, hi = -Infinity;
      partial.forEach(function (v) {
        lo = Math.min(lo, v.price);
        hi = Math.max(hi, v.priceHigh);
      });
      if (!isFinite(lo)) { lo = p.priceLow; hi = p.priceHigh; }

      var priceEl = $(".product__price");
      priceEl.innerHTML = (hi > lo)
        ? money(lo) + " <small>&ndash; " + money(hi) + " depending on options</small>"
        : money(lo);

      var addBtn = $("[data-add-to-bag]");
      if (addBtn) {
        var complete = p.optionNames.every(function (n) { return selected[n]; });
        addBtn.disabled = !complete;
        addBtn.textContent = complete ? "Add to bag" : "Choose options";
      }
    }

    $$("[data-opt]").forEach(function (row) {
      var name = row.getAttribute("data-opt");
      $$(".opt", row).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var val = btn.getAttribute("data-value");
          selected[name] = selected[name] === val ? undefined : val;
          if (!selected[name]) delete selected[name];
          $$(".opt", row).forEach(function (b) {
            b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === selected[name]));
          });
          refresh();
        });
      });
    });

    $$("[data-qty]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        qty = Math.max(1, Math.min(99, qty + parseInt(btn.getAttribute("data-qty"), 10)));
        qtyEl.textContent = qty;
      });
    });

    $$("[data-thumb]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var src = btn.getAttribute("data-thumb");
        var img = $("#product-stage-img");
        if (img) img.src = src;
        $$("[data-thumb]").forEach(function (b) { b.removeAttribute("aria-current"); });
        btn.setAttribute("aria-current", "true");
      });
    });

    var addBtn = $("[data-add-to-bag]");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var matches = matchingVariants(false);
        if (p.optionNames.length && !matches.length) return;
        var chosen = matches.length ? matches[0] : null;
        Bag.add(p, chosen, qty);
      });
    }

    refresh();
  }

  /* ------------------------------------------------------------- related */

  function renderRelated() {
    var slug = new URLSearchParams(location.search).get("p");
    var p = slug ? productBySlug(slug) : null;
    var host = $("[data-related]");
    if (!host || !p) return;

    var same = PRODUCTS.filter(function (x) {
      return x.category === p.category && x.id !== p.id;
    }).slice(0, 3);

    if (!same.length) return;

    $("[data-related-title]").textContent = "More in " + p.categoryLabel;
    host.innerHTML = same.map(cardHTML).join("");
  }

  /* ---------------------------------------------------------- init / wire */

  function init() {
    renderBagCount();

    // bag open/close
    $$("[data-bag-open]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); openBag(); });
    });
    $$("[data-bag-close]").forEach(function (el) {
      el.addEventListener("click", closeBag);
    });
    var scrim = $("[data-bag-scrim]");
    if (scrim) scrim.addEventListener("click", closeBag);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeBag();
    });

    document.addEventListener("click", function (e) {
      var rm = e.target.closest ? e.target.closest("[data-bag-remove]") : null;
      if (rm) {
        Bag.setQty(rm.getAttribute("data-bag-remove"), 0);
        return;
      }
    });

    // checkout -> Etsy (this build has no payment processor wired up)
    var checkout = $("[data-bag-checkout]");
    if (checkout) {
      checkout.addEventListener("click", function () {
        if (!Bag.items.length) return;
        var first = Bag.items[0];
        // Multiple items: hand off to the shop; single item: its listing.
        window.open(first.etsyUrl || "https://www.etsy.com/shop/SweeterMundaneStudio",
                    "_blank", "noopener");
      });
    }

    // catalogue filters — only the real filter buttons, not footer links
    $$("[data-filter]").forEach(function (btn) {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", function () {
        state.category = btn.getAttribute("data-filter");
        writeJSON(STATE_KEY, state);
        renderCatalogue();
      });
    });

    // footer category links: set the filter, then let the anchor navigate
    $$("a[data-filter]").forEach(function (link) {
      link.addEventListener("click", function () {
        state.category = link.getAttribute("data-filter");
        writeJSON(STATE_KEY, state);
      });
    });

    var sortSel = $("[data-sort]");
    if (sortSel) {
      sortSel.value = state.sort;
      sortSel.addEventListener("change", function () {
        state.sort = sortSel.value;
        writeJSON(STATE_KEY, state);
        renderCatalogue();
      });
    }

    var search = $("[data-search]");
    if (search) {
      search.value = state.q;
      var t = null;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () {
          state.q = search.value.trim();
          writeJSON(STATE_KEY, state);
          renderCatalogue();
        }, 140);
      });
    }

    var reset = $("[data-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        state = { category: "all", sort: "featured", q: "" };
        writeJSON(STATE_KEY, state);
        if (sortSel) sortSel.value = "featured";
        if (search) search.value = "";
        renderCatalogue();
      });
    }

    renderCatalogue();
    renderProduct();
    renderRelated();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SMS = { Bag: Bag, money: money, esc: esc, PRODUCTS: PRODUCTS };
})();
