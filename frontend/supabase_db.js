// TAHOTO Supabase Cloud PostgreSQL Engine (PostgREST Connector)
(function () {
  const SUPABASE_URL_KEY = "tahoto_supabase_url";
  const SUPABASE_ANON_KEY = "tahoto_supabase_anon_key";

  function getConfig() {
    const url = (localStorage.getItem(SUPABASE_URL_KEY) || "").trim().replace(/\/+$/, "");
    const key = (localStorage.getItem(SUPABASE_ANON_KEY) || "").trim();
    return { url, key, isConfigured: Boolean(url && key) };
  }

  function setConfig(url, key) {
    const cleanUrl = (url || "").trim().replace(/\/+$/, "");
    const cleanKey = (key || "").trim();
    if (cleanUrl && cleanKey) {
      localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
      localStorage.setItem(SUPABASE_ANON_KEY, cleanKey);
    } else {
      localStorage.removeItem(SUPABASE_URL_KEY);
      localStorage.removeItem(SUPABASE_ANON_KEY);
    }
  }

  async function pgFetch(tableAndQuery, options = {}) {
    const { url, key, isConfigured } = getConfig();
    if (!isConfigured) throw new Error("Chưa cấu hình kết nối Supabase PostgreSQL");

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    };

    const res = await fetch(`${url}/rest/v1/${tableAndQuery}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      let msg = `Supabase HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = err.message || err.details || err.hint || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function testConnection(customUrl, customKey) {
    const cleanUrl = (customUrl || "").trim().replace(/\/+$/, "");
    const cleanKey = (customKey || "").trim();
    if (!cleanUrl || !cleanKey) throw new Error("Vui lòng nhập đầy đủ Project URL và API Key");

    const res = await fetch(`${cleanUrl}/rest/v1/products?select=id&limit=1`, {
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
    });
    if (!res.ok) {
      let msg = `Lỗi kết nối (${res.status}). Hãy đảm bảo bạn đã chạy file supabase_schema.sql trong SQL Editor.`;
      try {
        const err = await res.json();
        if (err.message) msg = err.message;
      } catch (_) {}
      throw new Error(msg);
    }
    return true;
  }

  function toIsoDate(d) {
    const pad = (v) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Handle all /api/* endpoints directly against Supabase PostgreSQL
  async function handleSupabaseApi(urlStr, options = {}) {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (options.method || "GET").toUpperCase();
    const body = options.body && typeof options.body === "string" ? JSON.parse(options.body) : null;
    const now = Date.now();

    // 1. System Info
    if (path === "/api/system/info" && method === "GET") {
      const [prods, custs, invs, debts] = await Promise.all([
        pgFetch("products?select=id,stock,min_stock_threshold"),
        pgFetch("customers?select=id"),
        pgFetch("invoices?select=id"),
        pgFetch("debt_records?select=id,is_settled&is_settled=eq.false"),
      ]);
      const lowStock = (prods || []).filter((p) => Number(p.stock) <= Number(p.min_stock_threshold ?? 5)).length;
      return {
        store_name: "TẠP HÓA TỔNG HỢP THỌ HÒA",
        store_address: "Mai Hạ - Trường Phú - Quảng Trị",
        store_phone: "0976896458",
        database_engine: "Supabase Cloud PostgreSQL",
        counts: {
          products: (prods || []).length,
          customers: (custs || []).length,
          invoices: (invs || []).length,
          debts_pending: (debts || []).length,
          low_stock: lowStock,
        },
      };
    }

    // 2. Overview
    if (path === "/api/overview" && method === "GET") {
      const startParam = url.searchParams.get("start_date");
      const endParam = url.searchParams.get("end_date");
      const today = new Date();
      const sDate = startParam ? new Date(startParam + "T00:00:00") : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const eDate = endParam ? new Date(endParam + "T23:59:59.999") : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      const startMs = sDate.getTime();
      const endMs = eDate.getTime();

      const [invInRange, allDebts, itemsInRange, prods] = await Promise.all([
        pgFetch(`invoices?select=*&date=gte.${startMs}&date=lte.${endMs}&order=date.asc`),
        pgFetch(`debt_records?select=*`),
        pgFetch(`invoice_items?select=*,invoices!inner(date)&invoices.date=gte.${startMs}&invoices.date=lte.${endMs}`),
        pgFetch(`products?select=*`),
      ]);

      const daysMap = {};
      const cur = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const endDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
      while (cur <= endDay) {
        const dStr = toIsoDate(cur);
        const pad = (v) => String(v).padStart(2, "0");
        daysMap[dStr] = {
          date: dStr,
          label: `${pad(cur.getDate())}/${pad(cur.getMonth() + 1)}`,
          orders: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          debt_outstanding: 0,
          debt_settled: 0,
        };
        cur.setDate(cur.getDate() + 1);
      }

      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, "0")}:00`,
        revenue: 0,
        orders: 0,
      }));

      (invInRange || []).forEach((inv) => {
        const dt = new Date(Number(inv.date));
        const dStr = toIsoDate(dt);
        if (daysMap[dStr]) {
          daysMap[dStr].orders += 1;
          daysMap[dStr].revenue += Number(inv.total_amount);
          daysMap[dStr].cost += Number(inv.total_cost);
          daysMap[dStr].profit += Number(inv.total_amount) - Number(inv.total_cost);
        }
        hourly[dt.getHours()].revenue += Number(inv.total_amount);
        hourly[dt.getHours()].orders += 1;
      });

      (allDebts || [])
        .filter((d) => Number(d.created_at) >= startMs && Number(d.created_at) <= endMs)
        .forEach((debt) => {
          const dStr = toIsoDate(new Date(Number(debt.created_at)));
          if (daysMap[dStr]) {
            const rem = debt.is_settled ? 0 : Math.max(0, Number(debt.amount) - Number(debt.paid_amount || 0));
            const settled = debt.is_settled ? Number(debt.amount) : Number(debt.paid_amount || 0);
            daysMap[dStr].debt_outstanding += rem;
            daysMap[dStr].debt_settled += settled;
          }
        });

      const daysList = Object.values(daysMap);
      const totalRevenue = daysList.reduce((s, d) => s + d.revenue, 0);
      const totalCost = daysList.reduce((s, d) => s + d.cost, 0);
      const totalOrders = daysList.reduce((s, d) => s + d.orders, 0);
      const pendingDebts = (allDebts || []).filter((d) => !d.is_settled);
      const allTimeDebt = pendingDebts.reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.paid_amount || 0)), 0);

      const prodMap = new Map((prods || []).map((p) => [p.id, p]));
      const perfMap = {};
      (itemsInRange || []).forEach((it) => {
        const prod = prodMap.get(it.product_id);
        const key = it.product_id;
        if (!perfMap[key]) {
          perfMap[key] = {
            product_id: key,
            product_name: prod ? prod.name : it.product_name_snapshot,
            unit: prod ? prod.unit : it.unit_snapshot,
            total_quantity: 0,
            total_revenue: 0,
          };
        }
        perfMap[key].total_quantity += Number(it.quantity);
        perfMap[key].total_revenue += Number(it.sub_total);
      });

      const perfList = Object.values(perfMap);
      const best_sellers = [...perfList].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 8);
      const slow_sellers = [...perfList].sort((a, b) => a.total_quantity - b.total_quantity).slice(0, 8);
      const low_stock_products = (prods || [])
        .filter((p) => Number(p.stock) <= Number(p.min_stock_threshold ?? 5))
        .sort((a, b) => Number(a.stock) - Number(b.stock));

      return {
        start_date: toIsoDate(sDate),
        end_date: toIsoDate(eDate),
        is_single_day: toIsoDate(sDate) === toIsoDate(eDate),
        summary: {
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_profit: totalRevenue - totalCost,
          total_orders: totalOrders,
          debt_in_range: daysList.reduce((s, d) => s + d.debt_outstanding, 0),
          all_time_outstanding_debt: allTimeDebt,
          pending_debt_count: pendingDebts.length,
        },
        days: daysList,
        hourly,
        best_sellers,
        slow_sellers,
        low_stock_products,
      };
    }

    // 3. Categories & Units
    if (path === "/api/categories" && method === "GET") {
      return await pgFetch("categories?select=*&order=name.asc");
    }
    if (path === "/api/units" && method === "GET") {
      return await pgFetch("units?select=*&order=name.asc");
    }

    // 4. Products
    if (path === "/api/products" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const cat = (url.searchParams.get("category") || "").trim();
      const low = url.searchParams.get("low_stock_only") === "true";
      const rows = await pgFetch("products?select=*&order=updated_at.desc,id.desc");
      return (rows || []).filter((p) => {
        if (cat && p.category_name !== cat) return false;
        if (low && Number(p.stock) > Number(p.min_stock_threshold ?? 5)) return false;
        if (!q) return true;
        return (
          (p.name || "").toLowerCase().includes(q) ||
          (p.english_name || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.category_name || "").toLowerCase().includes(q)
        );
      });
    }

    if (path === "/api/products" && method === "POST") {
      const catName = (body.category_name || "").trim();
      if (catName) {
        await pgFetch("categories?on_conflict=name", {
          method: "POST",
          prefer: "resolution=ignore-duplicates",
          body: { name: catName, english_name: catName, created_at: now },
        }).catch(() => {});
      }
      const unitName = (body.unit || "").trim();
      if (unitName) {
        await pgFetch("units?on_conflict=name", {
          method: "POST",
          prefer: "resolution=ignore-duplicates",
          body: { name: unitName, english_name: unitName },
        }).catch(() => {});
      }

      const created = await pgFetch("products", {
        method: "POST",
        body: {
          name: body.name.trim(),
          english_name: body.english_name || null,
          barcode: body.barcode || null,
          category_name: catName,
          unit: unitName,
          price: Number(body.price || 0),
          cost: Number(body.cost || 0),
          stock: Number(body.stock || 0),
          min_stock_threshold: Number(body.min_stock_threshold ?? 5),
          created_at: now,
          updated_at: now,
        },
      });
      const prod = created[0];
      if (Number(prod.stock) !== 0) {
        await pgFetch("stock_movements", {
          method: "POST",
          body: {
            product_id: prod.id,
            movement_type: "INITIAL",
            quantity_change: Number(prod.stock),
            stock_before: 0,
            stock_after: Number(prod.stock),
            reference_code: "CREATE",
            note: "Khởi tạo sản phẩm",
            created_at: now,
          },
        });
      }
      return prod;
    }

    const prodMatch = path.match(/^\/api\/products\/(\d+)$/);
    if (prodMatch && method === "PUT") {
      const pid = Number(prodMatch[1]);
      const existingRows = await pgFetch(`products?id=eq.${pid}&select=*`);
      if (!existingRows || !existingRows.length) throw new Error("Không tìm thấy sản phẩm");
      const oldStock = Number(existingRows[0].stock);
      const newStock = Number(body.stock || 0);

      const updated = await pgFetch(`products?id=eq.${pid}`, {
        method: "PATCH",
        body: {
          name: body.name.trim(),
          english_name: body.english_name || null,
          barcode: body.barcode || null,
          category_name: (body.category_name || "").trim(),
          unit: (body.unit || "").trim(),
          price: Number(body.price || 0),
          cost: Number(body.cost || 0),
          stock: newStock,
          min_stock_threshold: Number(body.min_stock_threshold ?? 5),
          updated_at: now,
        },
      });

      if (Math.abs(newStock - oldStock) > 1e-6) {
        await pgFetch("stock_movements", {
          method: "POST",
          body: {
            product_id: pid,
            movement_type: "ADJUSTMENT",
            quantity_change: newStock - oldStock,
            stock_before: oldStock,
            stock_after: newStock,
            reference_code: "EDIT",
            note: "Cập nhật tồn kho trực tiếp",
            created_at: now,
          },
        });
      }
      return updated[0];
    }

    if (prodMatch && method === "DELETE") {
      const pid = Number(prodMatch[1]);
      const used = await pgFetch(`invoice_items?product_id=eq.${pid}&select=id&limit=1`);
      if (used && used.length > 0) {
        throw new Error("Không thể xóa sản phẩm này vì đang được sử dụng trong các hóa đơn hiện có.");
      }
      await pgFetch(`products?id=eq.${pid}`, { method: "DELETE" });
      return { status: "deleted", id: pid };
    }

    const adjMatch = path.match(/^\/api\/products\/(\d+)\/adjust-stock$/);
    if (adjMatch && method === "POST") {
      const pid = Number(adjMatch[1]);
      const existingRows = await pgFetch(`products?id=eq.${pid}&select=*`);
      if (!existingRows || !existingRows.length) throw new Error("Không tìm thấy sản phẩm");
      const oldStock = Number(existingRows[0].stock);
      const change = Number(body.quantity_change);
      const newStock = oldStock + change;

      const updated = await pgFetch(`products?id=eq.${pid}`, {
        method: "PATCH",
        body: { stock: newStock, updated_at: now },
      });
      await pgFetch("stock_movements", {
        method: "POST",
        body: {
          product_id: pid,
          movement_type: body.movement_type || "ADJUSTMENT",
          quantity_change: change,
          stock_before: oldStock,
          stock_after: newStock,
          reference_code: "MANUAL",
          note: body.note || "Điều chỉnh tồn kho",
          created_at: now,
        },
      });
      return updated[0];
    }

    const movMatch = path.match(/^\/api\/products\/(\d+)\/movements$/);
    if (movMatch && method === "GET") {
      const pid = Number(movMatch[1]);
      return await pgFetch(`stock_movements?product_id=eq.${pid}&order=created_at.desc&limit=100`);
    }

    // 5. Customers
    if (path === "/api/customers" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const [custs, debts, invs] = await Promise.all([
        pgFetch("customers?select=*&order=name.asc"),
        pgFetch("debt_records?select=customer_id,amount,paid_amount,is_settled&is_settled=eq.false"),
        pgFetch("invoices?select=customer_id"),
      ]);
      return (custs || [])
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q))
        .map((c) => {
          const outDebt = (debts || [])
            .filter((d) => d.customer_id === c.id)
            .reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.paid_amount || 0)), 0);
          const invCount = (invs || []).filter((i) => i.customer_id === c.id).length;
          return { ...c, outstanding_debt: outDebt, invoice_count: invCount };
        });
    }

    if (path === "/api/customers" && method === "POST") {
      const created = await pgFetch("customers", {
        method: "POST",
        body: {
          name: body.name.trim(),
          phone: body.phone.trim(),
          address: (body.address || "").trim(),
          note: "",
          created_at: now,
          updated_at: now,
        },
      });
      return { ...created[0], outstanding_debt: 0, invoice_count: 0 };
    }

    const custMatch = path.match(/^\/api\/customers\/(\d+)$/);
    if (custMatch && method === "PUT") {
      const cid = Number(custMatch[1]);
      const updated = await pgFetch(`customers?id=eq.${cid}`, {
        method: "PATCH",
        body: {
          name: body.name.trim(),
          phone: body.phone.trim(),
          address: (body.address || "").trim(),
          updated_at: now,
        },
      });
      return updated[0];
    }

    if (custMatch && method === "DELETE") {
      const cid = Number(custMatch[1]);
      await pgFetch(`customers?id=eq.${cid}`, { method: "DELETE" });
      return { status: "deleted", id: cid };
    }

    // 6. Invoices & Checkout
    if (path === "/api/invoices" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const pm = (url.searchParams.get("payment_method") || "").trim();
      const [invs, custs, items] = await Promise.all([
        pgFetch("invoices?select=*&order=date.desc,id.desc"),
        pgFetch("customers?select=id,name,phone,address"),
        pgFetch("invoice_items?select=invoice_id,product_name_snapshot,quantity"),
      ]);
      const custMap = new Map((custs || []).map((c) => [c.id, c]));
      const itemsByInv = {};
      (items || []).forEach((it) => {
        if (!itemsByInv[it.invoice_id]) itemsByInv[it.invoice_id] = [];
        itemsByInv[it.invoice_id].push(it);
      });

      return (invs || [])
        .map((inv) => {
          const cust = custMap.get(inv.customer_id);
          const invItems = itemsByInv[inv.id] || [];
          const top = invItems.length ? invItems.reduce((a, b) => (a.quantity >= b.quantity ? a : b)) : null;
          return {
            ...inv,
            profit: Number(inv.total_amount) - Number(inv.total_cost),
            items_count: invItems.length,
            customer_name: cust ? cust.name : null,
            customer_phone: cust ? cust.phone : null,
            customer_address: cust ? cust.address : null,
            top_product_name: top ? top.product_name_snapshot : null,
            top_product_quantity: top ? top.quantity : 0,
          };
        })
        .filter((inv) => {
          if (pm && inv.payment_method !== pm) return false;
          if (!q) return true;
          return (
            inv.code.toLowerCase().includes(q) ||
            (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
            (inv.customer_phone && inv.customer_phone.toLowerCase().includes(q))
          );
        });
    }

    const invMatch = path.match(/^\/api\/invoices\/(\d+)$/);
    if (invMatch && method === "GET") {
      const iid = Number(invMatch[1]);
      const [invRows, items] = await Promise.all([
        pgFetch(`invoices?id=eq.${iid}&select=*`),
        pgFetch(`invoice_items?invoice_id=eq.${iid}&select=*`),
      ]);
      if (!invRows || !invRows.length) throw new Error("Không tìm thấy hóa đơn");
      const inv = invRows[0];
      let cust = null;
      if (inv.customer_id) {
        const cRows = await pgFetch(`customers?id=eq.${inv.customer_id}&select=*`);
        cust = cRows?.[0] || null;
      }
      return {
        ...inv,
        profit: Number(inv.total_amount) - Number(inv.total_cost),
        items_count: (items || []).length,
        customer_name: cust ? cust.name : null,
        customer_phone: cust ? cust.phone : null,
        customer_address: cust ? cust.address : null,
        items: (items || []).map((it) => ({
          ...it,
          product_name: it.product_name_snapshot,
          unit: it.unit_snapshot,
        })),
      };
    }

    if (path === "/api/checkout" && method === "POST") {
      const prods = await pgFetch("products?select=*");
      const prodMap = new Map((prods || []).map((p) => [p.id, p]));
      let subtotal = 0;
      let totalCost = 0;
      const prepared = [];

      body.items.forEach((itemIn) => {
        const prod = prodMap.get(Number(itemIn.product_id));
        if (!prod) return;
        const price = Number(itemIn.price ?? prod.price);
        const qty = Number(itemIn.quantity);
        const sub = Math.round(price * qty);
        const cSub = Math.round(Number(prod.cost) * qty);
        subtotal += sub;
        totalCost += cSub;
        prepared.push({ prod, qty, price, cost: Number(prod.cost), sub });
      });

      const discount = Math.max(0, Number(body.discount_amount || 0));
      const payable = Math.max(0, subtotal - discount);

      const lastInvs = await pgFetch("invoices?select=id&order=id.desc&limit=1");
      const nextNum = (lastInvs && lastInvs.length ? Number(lastInvs[0].id) : 0) + 1;
      const tempCode = `HD${nextNum}_${now.toString().slice(-4)}`;

      const createdInvRows = await pgFetch("invoices", {
        method: "POST",
        body: {
          code: tempCode,
          date: now,
          subtotal_amount: subtotal,
          discount_amount: discount,
          total_amount: payable,
          total_cost: totalCost,
          payment_method: body.payment_method || "cash",
          note: body.payment_method || "cash",
          customer_id: body.customer_id ? Number(body.customer_id) : null,
        },
      });
      const inv = createdInvRows[0];
      const finalCode = `HD${inv.id}`;
      await pgFetch(`invoices?id=eq.${inv.id}`, {
        method: "PATCH",
        body: { code: finalCode },
      }).catch(() => {});

      for (const item of prepared) {
        await pgFetch("invoice_items", {
          method: "POST",
          body: {
            invoice_id: inv.id,
            product_id: item.prod.id,
            product_name_snapshot: item.prod.name,
            unit_snapshot: item.prod.unit || "",
            quantity: item.qty,
            price: item.price,
            cost: item.cost,
            sub_total: item.sub,
          },
        });
        const oldStock = Number(item.prod.stock);
        const newStock = Number((oldStock - item.qty).toFixed(4));
        await pgFetch(`products?id=eq.${item.prod.id}`, {
          method: "PATCH",
          body: { stock: newStock, updated_at: now },
        });
        await pgFetch("stock_movements", {
          method: "POST",
          body: {
            product_id: item.prod.id,
            movement_type: "SALE",
            quantity_change: -item.qty,
            stock_before: oldStock,
            stock_after: newStock,
            reference_code: finalCode,
            note: `Bán hàng theo hóa đơn ${finalCode}`,
            created_at: now,
          },
        });
      }

      if (body.payment_method === "debt" && payable > 0) {
        await pgFetch("debt_records", {
          method: "POST",
          body: {
            invoice_id: inv.id,
            customer_id: body.customer_id ? Number(body.customer_id) : null,
            customer_name: body.customer_name || "Khách lẻ",
            customer_phone: body.customer_phone || null,
            amount: payable,
            paid_amount: 0,
            note: `Ghi nợ hóa đơn ${finalCode}`,
            created_at: now,
            is_settled: false,
          },
        });
      }

      if (body.draft_id) {
        await pgFetch(`invoice_drafts?id=eq.${Number(body.draft_id)}`, { method: "DELETE" }).catch(() => {});
      }

      return await handleSupabaseApi(`/api/invoices/${inv.id}`);
    }

    // 7. Drafts
    if (path === "/api/drafts" && method === "GET") {
      return await pgFetch("invoice_drafts?select=*&order=updated_at.desc");
    }
    if (path === "/api/drafts" && method === "POST") {
      const created = await pgFetch("invoice_drafts", {
        method: "POST",
        body: {
          created_at: now,
          updated_at: now,
          total_amount: body.total_amount,
          total_items: body.total_items,
          items_json: body.items_json,
          customer_id: body.customer_id || null,
          customer_name: body.customer_name || null,
          note: body.note || "",
        },
      });
      return created[0];
    }
    const draftMatch = path.match(/^\/api\/drafts\/(\d+)$/);
    if (draftMatch && method === "DELETE") {
      const did = Number(draftMatch[1]);
      await pgFetch(`invoice_drafts?id=eq.${did}`, { method: "DELETE" });
      return { status: "deleted", id: did };
    }

    // 8. Debts
    if (path === "/api/debts" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const status = url.searchParams.get("status") || "all";
      const rows = await pgFetch("debt_records?select=*&order=is_settled.asc,created_at.desc");
      return (rows || [])
        .filter((d) => {
          if (status === "pending" && d.is_settled) return false;
          if (status === "settled" && !d.is_settled) return false;
          if (!q) return true;
          return (
            (d.customer_name || "").toLowerCase().includes(q) ||
            (d.customer_phone || "").toLowerCase().includes(q) ||
            (d.note || "").toLowerCase().includes(q)
          );
        })
        .map((d) => ({
          ...d,
          invoice_code: d.invoice_id ? `HD${d.invoice_id}` : null,
          remaining_amount: d.is_settled ? 0 : Math.max(0, Number(d.amount) - Number(d.paid_amount || 0)),
        }));
    }

    if (path === "/api/debts" && method === "POST") {
      const created = await pgFetch("debt_records", {
        method: "POST",
        body: {
          customer_id: body.customer_id ? Number(body.customer_id) : null,
          customer_name: body.customer_name.trim(),
          customer_phone: body.customer_phone || null,
          amount: Number(body.amount),
          paid_amount: 0,
          note: body.note || "",
          created_at: now,
          is_settled: false,
        },
      });
      const d = created[0];
      return { ...d, remaining_amount: d.amount };
    }

    const debtToggleMatch = path.match(/^\/api\/debts\/(\d+)\/toggle-settle$/);
    if (debtToggleMatch && method === "POST") {
      const did = Number(debtToggleMatch[1]);
      const rows = await pgFetch(`debt_records?id=eq.${did}&select=*`);
      if (!rows || !rows.length) throw new Error("Không tìm thấy khoản nợ");
      const cur = rows[0];
      const nextSettled = !cur.is_settled;
      const updated = await pgFetch(`debt_records?id=eq.${did}`, {
        method: "PATCH",
        body: {
          is_settled: nextSettled,
          paid_amount: nextSettled ? cur.amount : 0,
          settled_at: nextSettled ? now : null,
        },
      });
      return updated[0];
    }

    const debtPayMatch = path.match(/^\/api\/debts\/(\d+)\/pay$/);
    if (debtPayMatch && method === "POST") {
      const did = Number(debtPayMatch[1]);
      const rows = await pgFetch(`debt_records?id=eq.${did}&select=*`);
      if (!rows || !rows.length) throw new Error("Không tìm thấy khoản nợ");
      const cur = rows[0];
      const newPaid = Number(cur.paid_amount || 0) + Number(body.amount);
      const isSettled = newPaid >= Number(cur.amount);
      await pgFetch("debt_payments", {
        method: "POST",
        body: {
          debt_id: did,
          amount: Number(body.amount),
          payment_method: body.payment_method || "cash",
          note: body.note || "Thu nợ một phần",
          paid_at: now,
        },
      });
      const updated = await pgFetch(`debt_records?id=eq.${did}`, {
        method: "PATCH",
        body: {
          paid_amount: isSettled ? cur.amount : newPaid,
          is_settled: isSettled,
          settled_at: isSettled ? now : null,
        },
      });
      return updated[0];
    }

    const debtDelMatch = path.match(/^\/api\/debts\/(\d+)$/);
    if (debtDelMatch && method === "DELETE") {
      const did = Number(debtDelMatch[1]);
      await pgFetch(`debt_records?id=eq.${did}`, { method: "DELETE" });
      return { status: "deleted", id: did };
    }

    // 9. Banks & VietQR
    if (path === "/api/banks/directory" && method === "GET") {
      return window.TAHOTO_BROWSER_DB.handleLocalApi("/api/banks/directory");
    }
    if (path === "/api/bank-accounts" && method === "GET") {
      return await pgFetch("bank_accounts?select=*&order=is_active.desc,id.asc");
    }
    if (path === "/api/bank-accounts" && method === "POST") {
      const created = await pgFetch("bank_accounts", {
        method: "POST",
        body: { ...body, created_at: now },
      });
      return created[0];
    }
    const bankMatch = path.match(/^\/api\/bank-accounts\/(\d+)$/);
    if (bankMatch && method === "PUT") {
      const bid = Number(bankMatch[1]);
      const updated = await pgFetch(`bank_accounts?id=eq.${bid}`, {
        method: "PATCH",
        body,
      });
      return updated[0];
    }
    if (bankMatch && method === "DELETE") {
      const bid = Number(bankMatch[1]);
      await pgFetch(`bank_accounts?id=eq.${bid}`, { method: "DELETE" });
      return { status: "deleted", id: bid };
    }

    if (path === "/api/vietqr" && method === "GET") {
      const amount = Number(url.searchParams.get("amount") || 0);
      const description = url.searchParams.get("description") || "Thanh toan TAHOTO";
      const accs = await pgFetch("bank_accounts?select=*&order=is_active.desc,id.asc");
      const acc = (accs || [])[0];
      if (!acc) throw new Error("Chưa có tài khoản ngân hàng.");
      // Reuse EMVCo generator via browser_db helper
      const localQr = await window.TAHOTO_BROWSER_DB.handleLocalApi(
        `/api/vietqr?amount=${amount}&description=${encodeURIComponent(description)}`
      );
      return {
        account: acc,
        amount,
        description,
        emv_payload: localQr.emv_payload,
      };
    }

    return window.TAHOTO_BROWSER_DB.handleLocalApi(urlStr, options);
  }

  window.TAHOTO_SUPABASE = {
    getConfig,
    setConfig,
    testConnection,
    handleSupabaseApi,
  };
})();
