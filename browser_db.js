// TAHOTO Browser Database & VietQR / Excel Engine for GitHub Pages (Static Deployment)
(function () {
  const DB_STORAGE_KEY = "tahoto_enterprise_browser_db_v1";

  const POPULAR_VN_BANKS = [
    { code: "VTB", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)", bin: "970415" },
    { code: "VCB", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)", bin: "970436" },
    { code: "BIDV", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", bin: "970418" },
    { code: "VBA", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)", bin: "970405" },
    { code: "MB", shortName: "MBBank", name: "Ngân hàng TMCP Quân đội (MBBank)", bin: "970422" },
    { code: "TCB", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)", bin: "970407" },
    { code: "ACB", shortName: "ACB", name: "Ngân hàng TMCP Á Châu (ACB)", bin: "970416" },
    { code: "VPB", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)", bin: "970432" },
    { code: "TPB", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong (TPBank)", bin: "970423" },
    { code: "STB", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)", bin: "970403" },
    { code: "HDB", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)", bin: "970437" },
    { code: "VIB", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam (VIB)", bin: "970441" },
    { code: "SHB", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)", bin: "970443" },
    { code: "EIB", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)", bin: "970431" },
    { code: "MSB", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam (MSB)", bin: "970426" },
    { code: "OCB", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông (OCB)", bin: "970448" },
    { code: "LPB", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)", bin: "970449" },
    { code: "SEAB", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á (SeABank)", bin: "970440" },
  ];

  function createSeedDb() {
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;

    const categories = [
      { id: 1, name: "Bia, nước giải khát", english_name: "Beer and soft drinks" },
      { id: 2, name: "Sữa các loại", english_name: "Milk products" },
      { id: 3, name: "Dầu ăn, nước chấm, gia vị", english_name: "Cooking oil, sauces, spices" },
      { id: 4, name: "Mì, miến, cháo, phở", english_name: "Noodles, vermicelli, porridge" },
      { id: 5, name: "Bánh kẹo các loại", english_name: "Snacks and candies" },
      { id: 6, name: "Chăm sóc cá nhân", english_name: "Personal care" },
      { id: 7, name: "Thuốc lá", english_name: "Tobacco" },
      { id: 8, name: "Vàng mã", english_name: "Joss paper" },
      { id: 9, name: "Vệ sinh nhà cửa", english_name: "Home cleaning" },
    ];

    const units = [
      { id: 1, name: "Cái", english_name: "Piece" },
      { id: 2, name: "Gói", english_name: "Pack" },
      { id: 3, name: "Chai", english_name: "Bottle" },
      { id: 4, name: "Hộp", english_name: "Box" },
      { id: 5, name: "Bộ", english_name: "Set" },
      { id: 6, name: "Thùng", english_name: "Carton" },
      { id: 7, name: "Lon", english_name: "Can" },
      { id: 8, name: "Kg", english_name: "Kg" },
      { id: 9, name: "Lốc", english_name: "Six-pack" },
    ];

    const bank_accounts = [
      {
        id: 1,
        bank_code: "VTB",
        bank_name: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)",
        account_number: "0856467178",
        account_name: "DINH THI MY HOA",
        bin_code: "970415",
        is_active: true,
        created_at: now,
      },
    ];

    const customers = [
      { id: 1, name: "Nguyễn Văn An", phone: "0901112233", address: "Mai Hạ - Trường Phú - Lệ Thủy - Quảng Trị", note: "", created_at: now, updated_at: now },
      { id: 2, name: "Trần Thị Bình", phone: "0902223344", address: "Trường Phú - Lệ Thủy - Quảng Trị", note: "", created_at: now, updated_at: now },
      { id: 3, name: "Lê Quốc Cường", phone: "0903334455", address: "Ngã tư Mai Hạ - Quảng Trị", note: "", created_at: now, updated_at: now },
      { id: 4, name: "Phạm Minh Đức", phone: "0914556677", address: "Xóm 3 - Mai Hạ - Quảng Trị", note: "", created_at: now, updated_at: now },
    ];

    const sampleProds = [
      ["Thùng Bia Huda 24 lon", "Huda Beer 24 cans", "8935012413332", "Bia, nước giải khát", 275000, 252000, "Thùng", 45.0],
      ["Nước tăng lực RedBull 250ml", "RedBull Energy Drink 250ml", "8934588012112", "Bia, nước giải khát", 12000, 9500, "Lon", 120.0],
      ["Lốc Sữa tươi tiệt trùng Vinamilk 180ml", "Vinamilk Fresh Milk 4x180ml", "8934673100120", "Sữa các loại", 32000, 27500, "Lốc", 38.0],
      ["Sữa đặc Ông Thọ Đỏ 380g", "Ong Tho Condensed Milk 380g", "8934673201117", "Sữa các loại", 25000, 21000, "Hộp", 50.0],
      ["Dầu ăn Neptune Light 1 Lít", "Neptune Light Cooking Oil 1L", "8934707015116", "Dầu ăn, nước chấm, gia vị", 58000, 49000, "Chai", 28.0],
      ["Nước mắm Nam Ngư 750ml", "Nam Ngu Fish Sauce 750ml", "8936017360117", "Dầu ăn, nước chấm, gia vị", 42000, 35000, "Chai", 32.0],
      ["Thùng Mì Hảo Hảo Tôm Chua Cay 30 gói", "Hao Hao Instant Noodles 30 packs", "8934563138165", "Mì, miến, cháo, phở", 118000, 106000, "Thùng", 25.0],
      ["Mì Hảo Hảo Tôm Chua Cay 75g", "Hao Hao Shrimp Sour Spicy 75g", "8934563138158", "Mì, miến, cháo, phở", 4500, 3600, "Gói", 200.0],
      ["Thuốc lá 555 State Express", "Cigarette 555", "8935555555555", "Thuốc lá", 45000, 37000, "Gói", 85.0],
      ["Cà phê G7 3in1 Trung Nguyên (Hộp 21 gói)", "G7 Instant Coffee 3in1", "8935024112217", "Bánh kẹo các loại", 62000, 52000, "Hộp", 4.0],
      ["Nước rửa chén Sunlight Chanh 750g", "Sunlight Dishwashing Liquid 750g", "8934868121138", "Vệ sinh nhà cửa", 29000, 23500, "Chai", 3.0],
      ["Dầu gội Clear Bạc Hà 630g", "Clear Menthol Shampoo 630g", "8934868134527", "Chăm sóc cá nhân", 165000, 142000, "Chai", 14.0],
    ];

    const products = [];
    const stock_movements = [];
    sampleProds.forEach((sp, idx) => {
      const id = idx + 1;
      const cat = categories.find((c) => c.name === sp[3]);
      products.push({
        id,
        name: sp[0],
        english_name: sp[1],
        barcode: sp[2],
        category_id: cat ? cat.id : null,
        category_name: sp[3],
        price: sp[4],
        cost: sp[5],
        unit: sp[6],
        stock: sp[7],
        min_stock_threshold: 5.0,
        image_url: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      stock_movements.push({
        id,
        product_id: id,
        movement_type: "INITIAL",
        quantity_change: sp[7],
        stock_before: 0,
        stock_after: sp[7],
        reference_code: "SEED",
        note: "Tồn kho đầu kỳ",
        created_at: now,
      });
    });

    const invoices = [];
    const invoice_items = [];
    const debt_records = [];
    let itemIdSeq = 1;
    let debtIdSeq = 1;

    const sampleOrders = [
      [5, 0, "cash", [[0, 2], [4, 1], [5, 1]], 0],
      [4, 1, "bank_transfer", [[2, 3], [3, 2], [6, 1]], 0],
      [3, 2, "debt", [[0, 3], [8, 5]], 0],
      [2, null, "cash", [[1, 10], [7, 20], [9, 2]], 5000],
      [1, 0, "bank_transfer", [[11, 1], [4, 2], [10, 2]], 0],
      [0, 3, "cash", [[0, 1], [6, 2], [8, 2]], 0],
      [0, 1, "debt", [[4, 3], [5, 3], [9, 2]], 0],
    ];

    sampleOrders.forEach((ord, idx) => {
      const invId = idx + 1;
      const [daysAgo, custIdx, method, specs, discount] = ord;
      const invTime = now - daysAgo * dayMs - 3600 * 1000 * (invId % 5);
      const cust = custIdx !== null ? customers[custIdx] : null;
      let subtotal = 0;
      let totalCost = 0;

      specs.forEach(([pIdx, qty]) => {
        const prod = products[pIdx];
        const sub = Math.round(prod.price * qty);
        const cSub = Math.round(prod.cost * qty);
        subtotal += sub;
        totalCost += cSub;
        invoice_items.push({
          id: itemIdSeq++,
          invoice_id: invId,
          product_id: prod.id,
          product_name_snapshot: prod.name,
          unit_snapshot: prod.unit,
          quantity: qty,
          price: prod.price,
          cost: prod.cost,
          sub_total: sub,
        });
      });

      const payable = Math.max(0, subtotal - discount);
      invoices.push({
        id: invId,
        code: `HD${invId}`,
        date: invTime,
        subtotal_amount: subtotal,
        discount_amount: discount,
        total_amount: payable,
        total_cost: totalCost,
        payment_method: method,
        note: method,
        customer_id: cust ? cust.id : null,
      });

      if (method === "debt" && payable > 0) {
        debt_records.push({
          id: debtIdSeq++,
          invoice_id: invId,
          customer_id: cust ? cust.id : null,
          customer_name: cust ? cust.name : "Khách lẻ",
          customer_phone: cust ? cust.phone : null,
          amount: payable,
          paid_amount: 0,
          note: `Ghi nợ hóa đơn HD${invId}`,
          created_at: invTime,
          due_date: null,
          is_settled: false,
          settled_at: null,
          payments: [],
        });
      }
    });

    const defaultPerms = {
      manager: {
        overview: { view: true, edit: true },
        sales: { view: true, edit: true },
        invoices: { view: true, edit: true },
        products: { view: true, edit: true },
        debts: { view: true, edit: true },
        customers: { view: true, edit: true },
        more: { view: true, edit: true },
        users: { view: true, edit: true },
      },
      leader: {
        overview: { view: true, edit: false },
        sales: { view: true, edit: true },
        invoices: { view: true, edit: true },
        products: { view: true, edit: true },
        debts: { view: true, edit: true },
        customers: { view: true, edit: true },
        more: { view: true, edit: false },
        users: { view: false, edit: false },
      },
      cashier: {
        overview: { view: false, edit: false },
        sales: { view: true, edit: true },
        invoices: { view: true, edit: false },
        products: { view: true, edit: false },
        debts: { view: true, edit: false },
        customers: { view: true, edit: true },
        more: { view: false, edit: false },
        users: { view: false, edit: false },
      },
    };

    const DEFAULT_PWD_HASH = "187b5f4cfd1a2ef08f90454b24aa620559e04f8638150fb7ddb57c164a853b2b";
    const LEGACY_PWD_HASH = "523e4a8d22a666f9d261a247a16913cf889c4529086e68d8017488005477174f";

    const app_users = [
      {
        id: 1,
        username: "quanly",
        password_hash: DEFAULT_PWD_HASH,
        full_name: "Quản lý Cửa hàng",
        role: "manager",
        permissions_json: JSON.stringify(defaultPerms.manager),
        is_active: true,
        created_at: now,
      },
      {
        id: 2,
        username: "totruong",
        password_hash: DEFAULT_PWD_HASH,
        full_name: "Tổ trưởng Ca",
        role: "leader",
        permissions_json: JSON.stringify(defaultPerms.leader),
        is_active: true,
        created_at: now,
      },
      {
        id: 3,
        username: "thungan",
        password_hash: DEFAULT_PWD_HASH,
        full_name: "Nhân viên Thu ngân",
        role: "cashier",
        permissions_json: JSON.stringify(defaultPerms.cashier),
        is_active: true,
        created_at: now,
      },
    ];

    return {
      categories,
      units,
      products,
      stock_movements,
      customers,
      invoices,
      invoice_items,
      debt_records,
      bank_accounts,
      invoice_drafts: [],
      app_users,
    };
  }

  function verifyPasswordMatch(storedHash, rawPwd, computedHash) {
    if (!storedHash) return false;
    if (storedHash === computedHash || storedHash === rawPwd) return true;
    if (
      storedHash === "523e4a8d22a666f9d261a247a16913cf889c4529086e68d8017488005477174f" &&
      computedHash === "187b5f4cfd1a2ef08f90454b24aa620559e04f8638150fb7ddb57c164a853b2b"
    ) {
      return true;
    }
    return false;
  }

  async function hashPasswordJS(raw) {
    const msgBuffer = new TextEncoder().encode(`tahoto_salt_${raw}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function serializeAppUser(u) {
    let perms = {};
    try {
      perms = JSON.parse(u.permissions_json || "{}");
    } catch (_) {}
    if (u.role === "manager") {
      perms = {
        overview: { view: true, edit: true },
        sales: { view: true, edit: true },
        invoices: { view: true, edit: true },
        products: { view: true, edit: true },
        debts: { view: true, edit: true },
        customers: { view: true, edit: true },
        more: { view: true, edit: true },
        users: { view: true, edit: true },
      };
    }
    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      permissions: perms,
      is_active: u.is_active !== false,
      created_at: u.created_at,
    };
  }

  function loadDb() {
    try {
      const raw = localStorage.getItem(DB_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.app_users || parsed.app_users.length === 0) {
          parsed.app_users = createSeedDb().app_users;
          saveDb(parsed);
        }
        return parsed;
      }
    } catch (_) {}
    const seeded = createSeedDb();
    saveDb(seeded);
    return seeded;
  }

  function saveDb(db) {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  }

  function nextId(arr) {
    if (!arr || arr.length === 0) return 1;
    return Math.max(...arr.map((x) => Number(x.id) || 0)) + 1;
  }

  // VietQR EMVCo CRC16 in JS
  function removeAccents(str) {
    if (!str) return "";
    return str
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function emv(tag, val) {
    if (!val) return "";
    const len = String(val.length).padStart(2, "0");
    return `${tag}${len}${val}`;
  }

  function computeCrc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= (payload.charCodeAt(i) & 0xff) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function buildVietQrPayload(account, amount, description) {
    const bin = (account.bin_code || "970415").trim();
    const accDigits = String(account.account_number || "").replace(/\D/g, "");
    if (!bin || !accDigits) return null;

    const cleanDesc = removeAccents(description || "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .toUpperCase()
      .trim()
      .slice(0, 25);

    const accInfo = emv("00", bin) + emv("01", accDigits);
    const merchantInfo = emv("00", "A000000727") + emv("01", accInfo) + emv("02", "QRIBFTTA");
    const addData = cleanDesc ? emv("08", cleanDesc) : "";
    const poi = amount > 0 ? "12" : "11";

    let payload = emv("00", "01") + emv("01", poi) + emv("38", merchantInfo) + emv("53", "704");
    if (amount > 0) payload += emv("54", String(Math.round(amount)));
    payload += emv("58", "VN");
    if (addData) payload += emv("62", addData);

    const crcIn = payload + "6304";
    return crcIn + computeCrc16(crcIn);
  }

  function toIsoDate(d) {
    const pad = (v) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDt(ms) {
    if (!ms) return "-";
    const d = new Date(Number(ms));
    const pad = (v) => String(v).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function enrichCustomer(c, db) {
    const pendingDebts = db.debt_records.filter((d) => d.customer_id === c.id && !d.is_settled);
    const outDebt = pendingDebts.reduce((s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)), 0);
    const invCount = db.invoices.filter((i) => i.customer_id === c.id).length;
    return { ...c, outstanding_debt: outDebt, invoice_count: invCount };
  }

  function enrichInvoice(inv, db) {
    const cust = db.customers.find((c) => c.id === inv.customer_id);
    const items = db.invoice_items.filter((it) => it.invoice_id === inv.id);
    const topItem = items.length > 0 ? items.reduce((a, b) => (a.quantity >= b.quantity ? a : b)) : null;
    const topProd = topItem ? db.products.find((p) => p.id === topItem.product_id) : null;
    return {
      ...inv,
      profit: inv.total_amount - inv.total_cost,
      items_count: items.length,
      customer_name: cust ? cust.name : null,
      customer_phone: cust ? cust.phone : null,
      customer_address: cust ? cust.address : null,
      top_product_name: topProd ? topProd.name : topItem ? topItem.product_name_snapshot : null,
      top_product_quantity: topItem ? topItem.quantity : 0,
    };
  }

  function enrichDebt(d, db) {
    const inv = db.invoices.find((i) => i.id === d.invoice_id);
    const rem = d.is_settled ? 0 : Math.max(0, Number(d.amount) - Number(d.paid_amount || 0));
    return {
      ...d,
      invoice_code: inv ? inv.code : d.invoice_id ? `HD${d.invoice_id}` : null,
      paid_amount: d.is_settled ? d.amount : Number(d.paid_amount || 0),
      remaining_amount: rem,
      payments: d.payments || [],
    };
  }

  // Router handling all /api/* calls locally in browser
  async function handleLocalApi(urlStr, options = {}) {
    const db = loadDb();
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (options.method || "GET").toUpperCase();
    const body = options.body && typeof options.body === "string" ? JSON.parse(options.body) : null;
    const now = Date.now();

    // 1. System Info
    if (path === "/api/system/info" && method === "GET") {
      return {
        store_name: "TẠP HÓA TỔNG HỢP THỌ HÒA",
        store_address: "Mai Hạ - Trường Phú - Quảng Trị",
        store_phone: "0976896458",
        database_engine: "Indexed Browser SQL Store",
        counts: {
          products: db.products.length,
          customers: db.customers.length,
          invoices: db.invoices.length,
          debts_pending: db.debt_records.filter((d) => !d.is_settled).length,
          low_stock: db.products.filter((p) => p.stock <= p.min_stock_threshold).length,
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

      const invInRange = db.invoices.filter((i) => i.date >= startMs && i.date <= endMs);
      invInRange.forEach((inv) => {
        const dt = new Date(inv.date);
        const dStr = toIsoDate(dt);
        if (daysMap[dStr]) {
          daysMap[dStr].orders += 1;
          daysMap[dStr].revenue += Number(inv.total_amount);
          daysMap[dStr].cost += Number(inv.total_cost);
          daysMap[dStr].profit += Number(inv.total_amount - inv.total_cost);
        }
        hourly[dt.getHours()].revenue += Number(inv.total_amount);
        hourly[dt.getHours()].orders += 1;
      });

      db.debt_records
        .filter((d) => d.created_at >= startMs && d.created_at <= endMs)
        .forEach((debt) => {
          const dStr = toIsoDate(new Date(debt.created_at));
          if (daysMap[dStr]) {
            const rem = debt.is_settled ? 0 : Math.max(0, debt.amount - (debt.paid_amount || 0));
            const settled = debt.is_settled ? debt.amount : debt.paid_amount || 0;
            daysMap[dStr].debt_outstanding += rem;
            daysMap[dStr].debt_settled += settled;
          }
        });

      const daysList = Object.values(daysMap);
      const totalRevenue = daysList.reduce((s, d) => s + d.revenue, 0);
      const totalCost = daysList.reduce((s, d) => s + d.cost, 0);
      const totalOrders = daysList.reduce((s, d) => s + d.orders, 0);
      const pendingDebts = db.debt_records.filter((d) => !d.is_settled);
      const allTimeDebt = pendingDebts.reduce((s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)), 0);

      // Product performance
      const perfMap = {};
      const invIds = new Set(invInRange.map((i) => i.id));
      db.invoice_items
        .filter((it) => invIds.has(it.invoice_id))
        .forEach((it) => {
          const prod = db.products.find((p) => p.id === it.product_id);
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
      const low_stock_products = db.products.filter((p) => p.stock <= p.min_stock_threshold).sort((a, b) => a.stock - b.stock);

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
    if (path === "/api/categories" && method === "GET") return db.categories;
    if (path === "/api/units" && method === "GET") return db.units;

    // 4. Products
    if (path === "/api/products" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const cat = (url.searchParams.get("category") || "").trim();
      const low = url.searchParams.get("low_stock_only") === "true";
      return db.products
        .filter((p) => {
          if (cat && p.category_name !== cat) return false;
          if (low && p.stock > p.min_stock_threshold) return false;
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            (p.english_name && p.english_name.toLowerCase().includes(q)) ||
            (p.barcode && p.barcode.toLowerCase().includes(q)) ||
            (p.category_name && p.category_name.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => b.updated_at - a.updated_at || b.id - a.id);
    }

    if (path === "/api/products" && method === "POST") {
      const id = nextId(db.products);
      const catName = (body.category_name || "").trim();
      if (catName && !db.categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
        db.categories.push({ id: nextId(db.categories), name: catName, english_name: catName });
      }
      const unitName = (body.unit || "").trim();
      if (unitName && !db.units.some((u) => u.name.toLowerCase() === unitName.toLowerCase())) {
        db.units.push({ id: nextId(db.units), name: unitName, english_name: unitName });
      }
      const newProd = {
        id,
        name: body.name.trim(),
        english_name: body.english_name || null,
        barcode: body.barcode || null,
        category_name: catName,
        price: Number(body.price || 0),
        cost: Number(body.cost || 0),
        unit: unitName,
        stock: Number(body.stock || 0),
        min_stock_threshold: Number(body.min_stock_threshold ?? 5),
        image_url: body.image_url || null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      db.products.push(newProd);
      if (newProd.stock !== 0) {
        db.stock_movements.push({
          id: nextId(db.stock_movements),
          product_id: id,
          movement_type: "INITIAL",
          quantity_change: newProd.stock,
          stock_before: 0,
          stock_after: newProd.stock,
          reference_code: "CREATE",
          note: "Khởi tạo sản phẩm",
          created_at: now,
        });
      }
      saveDb(db);
      return newProd;
    }

    const prodMatch = path.match(/^\/api\/products\/(\d+)$/);
    if (prodMatch && method === "PUT") {
      const pid = Number(prodMatch[1]);
      const p = db.products.find((x) => x.id === pid);
      if (!p) throw new Error("Không tìm thấy sản phẩm");
      const oldStock = p.stock;
      p.name = body.name.trim();
      p.english_name = body.english_name || null;
      p.barcode = body.barcode || null;
      p.category_name = (body.category_name || "").trim();
      p.unit = (body.unit || "").trim();
      p.price = Number(body.price || 0);
      p.cost = Number(body.cost || 0);
      p.stock = Number(body.stock || 0);
      p.min_stock_threshold = Number(body.min_stock_threshold ?? 5);
      p.updated_at = now;

      if (Math.abs(p.stock - oldStock) > 1e-6) {
        db.stock_movements.push({
          id: nextId(db.stock_movements),
          product_id: pid,
          movement_type: "ADJUSTMENT",
          quantity_change: p.stock - oldStock,
          stock_before: oldStock,
          stock_after: p.stock,
          reference_code: "EDIT",
          note: "Cập nhật tồn kho trực tiếp",
          created_at: now,
        });
      }
      saveDb(db);
      return p;
    }

    if (prodMatch && method === "DELETE") {
      const pid = Number(prodMatch[1]);
      if (db.invoice_items.some((it) => it.product_id === pid)) {
        throw new Error("Không thể xóa sản phẩm này vì đang được sử dụng trong các hóa đơn hiện có.");
      }
      db.products = db.products.filter((x) => x.id !== pid);
      saveDb(db);
      return { status: "deleted", id: pid };
    }

    const adjMatch = path.match(/^\/api\/products\/(\d+)\/adjust-stock$/);
    if (adjMatch && method === "POST") {
      const pid = Number(adjMatch[1]);
      const p = db.products.find((x) => x.id === pid);
      if (!p) throw new Error("Không tìm thấy sản phẩm");
      const oldStock = p.stock;
      p.stock = oldStock + Number(body.quantity_change);
      p.updated_at = now;
      db.stock_movements.push({
        id: nextId(db.stock_movements),
        product_id: pid,
        movement_type: body.movement_type || "ADJUSTMENT",
        quantity_change: Number(body.quantity_change),
        stock_before: oldStock,
        stock_after: p.stock,
        reference_code: "MANUAL",
        note: body.note || "Điều chỉnh tồn kho",
        created_at: now,
      });
      saveDb(db);
      return p;
    }

    const movMatch = path.match(/^\/api\/products\/(\d+)\/movements$/);
    if (movMatch && method === "GET") {
      const pid = Number(movMatch[1]);
      return db.stock_movements.filter((m) => m.product_id === pid).sort((a, b) => b.created_at - a.created_at);
    }

    // 5. Customers
    if (path === "/api/customers" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      return db.customers
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q))
        .map((c) => enrichCustomer(c, db));
    }

    if (path === "/api/customers" && method === "POST") {
      if (db.customers.some((c) => c.phone === body.phone.trim())) {
        throw new Error("Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.");
      }
      const c = {
        id: nextId(db.customers),
        name: body.name.trim(),
        phone: body.phone.trim(),
        address: (body.address || "").trim(),
        note: "",
        created_at: now,
        updated_at: now,
      };
      db.customers.push(c);
      saveDb(db);
      return enrichCustomer(c, db);
    }

    const custMatch = path.match(/^\/api\/customers\/(\d+)$/);
    if (custMatch && method === "PUT") {
      const cid = Number(custMatch[1]);
      const c = db.customers.find((x) => x.id === cid);
      if (!c) throw new Error("Không tìm thấy khách hàng");
      c.name = body.name.trim();
      c.phone = body.phone.trim();
      c.address = (body.address || "").trim();
      c.updated_at = now;
      saveDb(db);
      return enrichCustomer(c, db);
    }

    if (custMatch && method === "DELETE") {
      const cid = Number(custMatch[1]);
      db.customers = db.customers.filter((x) => x.id !== cid);
      saveDb(db);
      return { status: "deleted", id: cid };
    }

    // 6. Invoices & Checkout
    if (path === "/api/invoices" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const pm = (url.searchParams.get("payment_method") || "").trim();
      return db.invoices
        .map((inv) => enrichInvoice(inv, db))
        .filter((inv) => {
          if (pm && inv.payment_method !== pm) return false;
          if (!q) return true;
          return (
            inv.code.toLowerCase().includes(q) ||
            (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
            (inv.customer_phone && inv.customer_phone.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => b.date - a.date || b.id - a.id);
    }

    const invMatch = path.match(/^\/api\/invoices\/(\d+)$/);
    if (invMatch && method === "GET") {
      const iid = Number(invMatch[1]);
      const inv = db.invoices.find((x) => x.id === iid);
      if (!inv) throw new Error("Không tìm thấy hóa đơn");
      const summary = enrichInvoice(inv, db);
      summary.items = db.invoice_items
        .filter((it) => it.invoice_id === iid)
        .map((it) => {
          const p = db.products.find((x) => x.id === it.product_id);
          return {
            ...it,
            product_name: p ? p.name : it.product_name_snapshot,
            unit: p ? p.unit : it.unit_snapshot,
          };
        });
      return summary;
    }

    if (path === "/api/checkout" && method === "POST") {
      const invId = nextId(db.invoices);
      const code = `HD${invId}`;
      let subtotal = 0;
      let totalCost = 0;

      body.items.forEach((itemIn) => {
        const prod = db.products.find((p) => p.id === Number(itemIn.product_id));
        if (!prod) return;
        const price = itemIn.price ?? prod.price;
        const sub = Math.round(price * itemIn.quantity);
        const cSub = Math.round(prod.cost * itemIn.quantity);
        subtotal += sub;
        totalCost += cSub;

        db.invoice_items.push({
          id: nextId(db.invoice_items),
          invoice_id: invId,
          product_id: prod.id,
          product_name_snapshot: prod.name,
          unit_snapshot: prod.unit || "",
          quantity: Number(itemIn.quantity),
          price,
          cost: prod.cost,
          sub_total: sub,
        });

        const oldStock = prod.stock;
        prod.stock = Number((oldStock - Number(itemIn.quantity)).toFixed(4));
        prod.updated_at = now;
        db.stock_movements.push({
          id: nextId(db.stock_movements),
          product_id: prod.id,
          movement_type: "SALE",
          quantity_change: -Number(itemIn.quantity),
          stock_before: oldStock,
          stock_after: prod.stock,
          reference_code: code,
          note: `Bán hàng theo hóa đơn ${code}`,
          created_at: now,
        });
      });

      const discount = Math.max(0, Number(body.discount_amount || 0));
      const payable = Math.max(0, subtotal - discount);
      const cust = body.customer_id ? db.customers.find((c) => c.id === Number(body.customer_id)) : null;

      const newInv = {
        id: invId,
        code,
        date: now,
        subtotal_amount: subtotal,
        discount_amount: discount,
        total_amount: payable,
        total_cost: totalCost,
        payment_method: body.payment_method || "cash",
        note: body.payment_method || "cash",
        customer_id: cust ? cust.id : null,
      };
      db.invoices.push(newInv);

      if (body.payment_method === "debt" && payable > 0) {
        db.debt_records.push({
          id: nextId(db.debt_records),
          invoice_id: invId,
          customer_id: cust ? cust.id : null,
          customer_name: cust ? cust.name : body.customer_name || "Khách lẻ",
          customer_phone: cust ? cust.phone : body.customer_phone || null,
          amount: payable,
          paid_amount: 0,
          note: `Ghi nợ hóa đơn ${code}`,
          created_at: now,
          due_date: null,
          is_settled: false,
          settled_at: null,
          payments: [],
        });
      }

      if (body.draft_id) {
        db.invoice_drafts = db.invoice_drafts.filter((d) => d.id !== Number(body.draft_id));
      }

      saveDb(db);
      return handleLocalApi(`/api/invoices/${invId}`);
    }

    // 7. Drafts
    if (path === "/api/drafts" && method === "GET") {
      return [...db.invoice_drafts].sort((a, b) => b.updated_at - a.updated_at);
    }
    if (path === "/api/drafts" && method === "POST") {
      const d = {
        id: nextId(db.invoice_drafts),
        created_at: now,
        updated_at: now,
        total_amount: body.total_amount,
        total_items: body.total_items,
        items_json: body.items_json,
        customer_id: body.customer_id,
        customer_name: body.customer_name,
        note: body.note || "",
      };
      db.invoice_drafts.push(d);
      saveDb(db);
      return d;
    }
    const draftMatch = path.match(/^\/api\/drafts\/(\d+)$/);
    if (draftMatch && method === "DELETE") {
      const did = Number(draftMatch[1]);
      db.invoice_drafts = db.invoice_drafts.filter((d) => d.id !== did);
      saveDb(db);
      return { status: "deleted", id: did };
    }

    // 8. Debts
    if (path === "/api/debts" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const status = url.searchParams.get("status") || "all";
      return db.debt_records
        .filter((d) => {
          if (status === "pending" && d.is_settled) return false;
          if (status === "settled" && !d.is_settled) return false;
          if (!q) return true;
          return (
            d.customer_name.toLowerCase().includes(q) ||
            (d.customer_phone && d.customer_phone.toLowerCase().includes(q)) ||
            (d.note && d.note.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => Number(a.is_settled) - Number(b.is_settled) || b.created_at - a.created_at)
        .map((d) => enrichDebt(d, db));
    }

    if (path === "/api/debts" && method === "POST") {
      const d = {
        id: nextId(db.debt_records),
        invoice_id: null,
        customer_id: body.customer_id ? Number(body.customer_id) : null,
        customer_name: body.customer_name.trim(),
        customer_phone: body.customer_phone || null,
        amount: Number(body.amount),
        paid_amount: 0,
        note: body.note || "",
        created_at: now,
        due_date: null,
        is_settled: false,
        settled_at: null,
        payments: [],
      };
      db.debt_records.push(d);
      saveDb(db);
      return enrichDebt(d, db);
    }

    const debtToggleMatch = path.match(/^\/api\/debts\/(\d+)\/toggle-settle$/);
    if (debtToggleMatch && method === "POST") {
      const did = Number(debtToggleMatch[1]);
      const d = db.debt_records.find((x) => x.id === did);
      if (!d) throw new Error("Không tìm thấy khoản nợ");
      d.is_settled = !d.is_settled;
      d.paid_amount = d.is_settled ? d.amount : 0;
      d.settled_at = d.is_settled ? now : null;
      saveDb(db);
      return enrichDebt(d, db);
    }

    const debtPayMatch = path.match(/^\/api\/debts\/(\d+)\/pay$/);
    if (debtPayMatch && method === "POST") {
      const did = Number(debtPayMatch[1]);
      const d = db.debt_records.find((x) => x.id === did);
      if (!d) throw new Error("Không tìm thấy khoản nợ");
      d.paid_amount = Number(d.paid_amount || 0) + Number(body.amount);
      if (d.paid_amount >= d.amount) {
        d.paid_amount = d.amount;
        d.is_settled = true;
        d.settled_at = now;
      }
      saveDb(db);
      return enrichDebt(d, db);
    }

    const debtDelMatch = path.match(/^\/api\/debts\/(\d+)$/);
    if (debtDelMatch && method === "DELETE") {
      const did = Number(debtDelMatch[1]);
      db.debt_records = db.debt_records.filter((x) => x.id !== did);
      saveDb(db);
      return { status: "deleted", id: did };
    }

    // 9. Banks & VietQR
    if (path === "/api/banks/directory" && method === "GET") return POPULAR_VN_BANKS;
    if (path === "/api/bank-accounts" && method === "GET") return db.bank_accounts;
    if (path === "/api/bank-accounts" && method === "POST") {
      const b = { id: nextId(db.bank_accounts), ...body, created_at: now };
      db.bank_accounts.push(b);
      saveDb(db);
      return b;
    }
    const bankMatch = path.match(/^\/api\/bank-accounts\/(\d+)$/);
    if (bankMatch && method === "PUT") {
      const bid = Number(bankMatch[1]);
      const idx = db.bank_accounts.findIndex((x) => x.id === bid);
      if (idx >= 0) db.bank_accounts[idx] = { ...db.bank_accounts[idx], ...body };
      saveDb(db);
      return db.bank_accounts[idx];
    }
    if (bankMatch && method === "DELETE") {
      const bid = Number(bankMatch[1]);
      db.bank_accounts = db.bank_accounts.filter((x) => x.id !== bid);
      saveDb(db);
      return { status: "deleted", id: bid };
    }

    if (path === "/api/vietqr" && method === "GET") {
      const amount = Number(url.searchParams.get("amount") || 0);
      const description = url.searchParams.get("description") || "Thanh toan TAHOTO";
      const acc = db.bank_accounts.find((a) => a.is_active) || db.bank_accounts[0];
      if (!acc) throw new Error("Chưa có tài khoản ngân hàng.");
      const emv_payload = buildVietQrPayload(acc, amount, description);
      const cleanDesc = encodeURIComponent((description || "Thanh toan TAHOTO").trim());
      const cleanHolder = encodeURIComponent((acc.account_name || "").trim());
      const vietqr_image_url = `https://img.vietqr.io/image/${acc.bin_code}-${acc.account_number}-compact2.png?amount=${amount}&addInfo=${cleanDesc}&accountName=${cleanHolder}`;
      return {
        account: acc,
        amount,
        description,
        emv_payload,
        vietqr_image_url,
      };
    }

    // 10. Authentication & Users (RBAC)
    if (path === "/api/auth/login" && method === "POST") {
      const uname = (body.username || "").trim().toLowerCase();
      const pwd = body.password || "";
      const user = (db.app_users || []).find((u) => u.username.toLowerCase() === uname);
      if (!user) throw new Error("Tên đăng nhập hoặc mật khẩu không chính xác");
      if (user.is_active === false) throw new Error("Tài khoản này đang bị tạm khóa");
      const hashed = await hashPasswordJS(pwd);
      if (!verifyPasswordMatch(user.password_hash, pwd, hashed)) {
        throw new Error("Tên đăng nhập hoặc mật khẩu không chính xác");
      }
      return serializeAppUser(user);
    }

    if (path === "/api/users" && method === "GET") {
      return (db.app_users || []).map((u) => serializeAppUser(u));
    }

    if (path === "/api/users" && method === "POST") {
      const uname = (body.username || "").trim().toLowerCase();
      if (!uname || !body.password || !body.full_name) {
        throw new Error("Vui lòng nhập đầy đủ tên đăng nhập, mật khẩu và họ tên");
      }
      if ((db.app_users || []).some((u) => u.username.toLowerCase() === uname)) {
        throw new Error("Tên đăng nhập đã tồn tại");
      }
      const hashed = await hashPasswordJS(body.password);
      const u = {
        id: nextId(db.app_users),
        username: uname,
        password_hash: hashed,
        full_name: body.full_name.trim(),
        role: body.role || "cashier",
        permissions_json: body.permissions_json || "{}",
        is_active: body.is_active !== false,
        created_at: now,
      };
      db.app_users.push(u);
      saveDb(db);
      return serializeAppUser(u);
    }

    const userMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && method === "PUT") {
      const uid = Number(userMatch[1]);
      const u = (db.app_users || []).find((x) => x.id === uid);
      if (!u) throw new Error("Không tìm thấy người dùng");
      if (body.username && body.username.trim()) {
        const newUname = body.username.trim().toLowerCase();
        if (newUname !== u.username.toLowerCase()) {
          if ((db.app_users || []).some((x) => x.id !== uid && x.username.toLowerCase() === newUname)) {
            throw new Error("Tên đăng nhập đã tồn tại");
          }
          u.username = newUname;
        }
      }
      if (body.full_name && body.full_name.trim()) u.full_name = body.full_name.trim();
      if (body.role) u.role = body.role;
      if (body.password && body.password.trim()) {
        u.password_hash = await hashPasswordJS(body.password.trim());
      }
      if (body.permissions_json !== undefined && body.permissions_json !== null) {
        u.permissions_json = body.permissions_json;
      }
      if (body.is_active !== undefined && body.is_active !== null) {
        u.is_active = body.is_active;
      }
      saveDb(db);
      return serializeAppUser(u);
    }

    if (userMatch && method === "DELETE") {
      const uid = Number(userMatch[1]);
      const u = (db.app_users || []).find((x) => x.id === uid);
      if (!u) throw new Error("Không tìm thấy người dùng");
      if (u.role === "manager" && (db.app_users || []).filter((x) => x.role === "manager").length <= 1) {
        throw new Error("Không thể xóa tài khoản Quản lý duy nhất của hệ thống");
      }
      db.app_users = (db.app_users || []).filter((x) => x.id !== uid);
      saveDb(db);
      return { status: "deleted", id: uid };
    }

    throw new Error(`Endpoint not mocked: ${method} ${path}`);
  }

  // Client-side Excel 5-Sheet Export & Import using SheetJS (XLSX)
  function exportExcelInBrowser() {
    if (!window.XLSX) {
      alert("Thư viện Excel đang tải, vui lòng thử lại sau giây lát.");
      return;
    }
    const db = loadDb();
    const wb = XLSX.utils.book_new();

    // 1. Invoices
    const invRows = [
      ["Mã hóa đơn", "Ngày", "Khách hàng", "Số điện thoại", "Địa chỉ", "Tổng tiền", "Tổng vốn", "Lợi nhuận", "Ghi chú", "Số dòng", "Sản phẩm nổi bật", "Số lượng"],
    ];
    db.invoices
      .map((i) => enrichInvoice(i, db))
      .sort((a, b) => b.date - a.date)
      .forEach((inv) => {
        invRows.push([
          inv.code,
          formatDt(inv.date),
          inv.customer_name || "-",
          inv.customer_phone || "-",
          inv.customer_address || "-",
          inv.total_amount,
          inv.total_cost,
          inv.profit,
          inv.payment_method,
          inv.items_count,
          inv.top_product_name || "-",
          inv.top_product_quantity || 0,
        ]);
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invRows), "Invoices");

    // 2. Inventory
    const prodRows = [["Tên sản phẩm", "Mã vạch", "Đơn vị", "Tồn kho", "Giá bán", "Giá vốn", "Nhóm hàng", "Ngày tạo", "Ngày cập nhật"]];
    db.products.forEach((p) => {
      prodRows.push([p.name, p.barcode || "-", p.unit || "", p.stock, p.price, p.cost, p.category_name || "", formatDt(p.created_at), formatDt(p.updated_at)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodRows), "Inventory");

    // 3. Revenue
    const revMap = {};
    db.invoices.forEach((inv) => {
      const day = toIsoDate(new Date(inv.date));
      if (!revMap[day]) revMap[day] = { orders: 0, rev: 0, cost: 0 };
      revMap[day].orders += 1;
      revMap[day].rev += inv.total_amount;
      revMap[day].cost += inv.total_cost;
    });
    const revRows = [["Ngày", "Số đơn", "Doanh thu", "Tổng vốn", "Lợi nhuận"]];
    Object.keys(revMap)
      .sort()
      .reverse()
      .forEach((day) => {
        const r = revMap[day];
        revRows.push([day, r.orders, r.rev, r.cost, r.rev - r.cost]);
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revRows), "Revenue");

    // 4. Debts
    const debtRows = [["Khách hàng", "Số điện thoại", "Số tiền", "Ghi chú", "Ngày ghi nhận", "Hạn thanh toán", "Trạng thái"]];
    db.debt_records.forEach((d) => {
      debtRows.push([
        d.customer_name,
        d.customer_phone || "-",
        d.amount,
        d.note || "",
        formatDt(d.created_at),
        d.due_date ? formatDt(d.due_date) : "-",
        d.is_settled ? "Đã tất toán" : "Chưa thanh toán",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(debtRows), "Debts");

    // 5. Customers
    const custRows = [["Tên khách hàng", "Số điện thoại", "Địa chỉ"]];
    db.customers.forEach((c) => {
      custRows.push([c.name, c.phone, c.address || ""]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(custRows), "Customers");

    XLSX.writeFile(wb, `TAHOTO_Report_${toIsoDate(new Date())}.xlsx`);
  }

  function importExcelInBrowser(file, conflictMode = "update") {
    return new Promise((resolve, reject) => {
      if (!window.XLSX) {
        return reject(new Error("Thư viện đọc Excel chưa sẵn sàng"));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const db = loadDb();
          const now = Date.now();
          const stats = { customers_imported: 0, products_added: 0, products_updated: 0, debts_imported: 0 };

          if (wb.Sheets["Customers"]) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets["Customers"], { header: 1 }).slice(1);
            rows.forEach((r) => {
              const name = String(r[0] || "").trim();
              const phone = String(r[1] || "").trim();
              const address = String(r[2] || "").trim();
              if (!name || !phone) return;
              const ex = db.customers.find((c) => c.phone === phone);
              if (ex) {
                ex.name = name;
                if (address) ex.address = address;
              } else {
                db.customers.push({ id: nextId(db.customers), name, phone, address, note: "", created_at: now, updated_at: now });
              }
              stats.customers_imported++;
            });
          }

          const prodSheet = wb.Sheets["Inventory"] || wb.Sheets[wb.SheetNames[0]];
          if (prodSheet) {
            const rows = XLSX.utils.sheet_to_json(prodSheet, { header: 1 }).slice(1);
            rows.forEach((r) => {
              const name = String(r[0] || "").trim();
              const barcode = String(r[1] || "").trim();
              if (!name && !barcode) return;
              const unit = String(r[2] || "").trim();
              const stock = parseFloat(r[3] || 0) || 0;
              const price = parseInt(String(r[4] || 0).replace(/\D/g, ""), 10) || 0;
              const cost = parseInt(String(r[5] || 0).replace(/\D/g, ""), 10) || 0;

              let ex = barcode && barcode !== "-" ? db.products.find((p) => p.barcode === barcode) : null;
              if (!ex) ex = db.products.find((p) => p.name === name);

              if (ex) {
                if (conflictMode === "skip") return;
                ex.name = name || ex.name;
                if (barcode && barcode !== "-") ex.barcode = barcode;
                if (unit) ex.unit = unit;
                ex.stock = stock;
                ex.price = price;
                ex.cost = cost;
                ex.updated_at = now;
                stats.products_updated++;
              } else {
                db.products.push({
                  id: nextId(db.products),
                  name: name || barcode,
                  english_name: null,
                  barcode: barcode && barcode !== "-" ? barcode : null,
                  category_name: "",
                  unit,
                  stock,
                  price,
                  cost,
                  min_stock_threshold: 5,
                  created_at: now,
                  updated_at: now,
                });
                stats.products_added++;
              }
            });
          }

          saveDb(db);
          resolve({ status: "success", stats });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function downloadBrowserDbBackup() {
    const db = loadDb();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tahoto_backup_${toIsoDate(new Date())}.json`;
    a.click();
  }

  window.TAHOTO_BROWSER_DB = {
    handleLocalApi,
    buildVietQrPayload,
    hashPasswordJS,
    verifyPasswordMatch,
    serializeAppUser,
    exportExcelInBrowser,
    importExcelInBrowser,
    downloadBrowserDbBackup,
  };
})();
