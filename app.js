// TAHOTO Enterprise Web Application Logic
const state = {
  lang: localStorage.getItem("tahoto_lang") || "vi",
  activeTab: "overview",
  systemInfo: null,

  // Overview state
  overviewRange: "last7", // today | yesterday | last7 | this_month | last_month | custom
  customStartDate: "",
  customEndDate: "",
  overviewData: null,
  rankingMode: "best", // best | slow

  // Master data
  products: [],
  categories: [],
  units: [],
  customers: [],
  bankAccounts: [],
  vnBanksDirectory: [],
  drafts: [],
  invoices: [],
  debts: [],
  users: [],
  currentUser: null,
  selectedUserIdForPerms: null,
  editingPermsDraft: null,

  // POS Cart state
  posSearch: "",
  posCategory: "",
  cart: {}, // { productId: quantity }
  posDiscount: 0,
  posCustomerId: "",
  posCustomerQuery: "",
  posPaymentMethod: "cash", // cash | bank_transfer | debt
  loadedDraftId: null,
  posVietQrData: null,

  // Filters
  productSearch: "",
  productCategoryFilter: "",
  productLowStockOnly: false,
  invoiceSearch: "",
  invoicePaymentFilter: "",
  debtSearch: "",
  debtStatusFilter: "all",
  customerSearch: "",
};

let revenueChartInstance = null;
let debtChartInstance = null;
let html5QrScanner = null;

// ---------------------------------------------------------------------------
// UTILITIES & FORMATTERS
// ---------------------------------------------------------------------------
function t(key) {
  const dict = window.TRANSLATIONS[state.lang] || window.TRANSLATIONS.vi;
  return dict[key] || key;
}

function formatVnd(amount) {
  const num = Number(amount || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNumber(num) {
  const n = Number(num || 0);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function formatDateTime(millis) {
  if (!millis) return "-";
  const d = new Date(Number(millis));
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(millis) {
  if (!millis) return "-";
  const d = new Date(Number(millis));
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function paymentLabel(method) {
  const m = (method || "").toLowerCase();
  if (m === "cash") return state.lang === "en" ? "Cash" : "Tiền mặt";
  if (m === "bank_transfer") return state.lang === "en" ? "Bank Transfer" : "Chuyển khoản";
  if (m === "debt") return state.lang === "en" ? "Credit / Debt" : "Ghi nợ";
  return method || (state.lang === "en" ? "Cash" : "Tiền mặt");
}

function paymentBadgeClass(method) {
  const m = (method || "").toLowerCase();
  if (m === "bank_transfer") return "bg-blue-50 text-blue-700 border-blue-200";
  if (m === "debt") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function displayProductName(product) {
  if (!product) return "";
  if (state.lang === "en" && product.english_name && product.english_name.trim()) {
    return product.english_name;
  }
  return product.name;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  const bg =
    type === "error"
      ? "bg-red-600 text-white"
      : type === "warning"
      ? "bg-amber-500 text-white"
      : "bg-slate-900 text-white";
  el.className = `${bg} px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100`;
  el.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

let isStaticPagesMode = window.location.hostname.endsWith("github.io");

async function apiFetch(url, options = {}) {
  if (window.TAHOTO_SUPABASE && window.TAHOTO_SUPABASE.getConfig().isConfigured) {
    return window.TAHOTO_SUPABASE.handleSupabaseApi(url, options);
  }
  if (isStaticPagesMode && window.TAHOTO_BROWSER_DB) {
    return window.TAHOTO_BROWSER_DB.handleLocalApi(url, options);
  }
  const headers = options.headers || {};
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  try {
    const res = await fetch(url, { ...options, headers });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      if ((res.status === 404 || res.status === 405) && !contentType.includes("application/json") && window.TAHOTO_BROWSER_DB) {
        isStaticPagesMode = true;
        return window.TAHOTO_BROWSER_DB.handleLocalApi(url, options);
      }
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        errMsg = errData.detail || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    return res.json();
  } catch (err) {
    if (window.TAHOTO_BROWSER_DB && (err instanceof TypeError || String(err.message).includes("Failed to fetch"))) {
      isStaticPagesMode = true;
      return window.TAHOTO_BROWSER_DB.handleLocalApi(url, options);
    }
    throw err;
  }
}

function handleExportExcelClick(e) {
  if (isStaticPagesMode && window.TAHOTO_BROWSER_DB) {
    e.preventDefault();
    window.TAHOTO_BROWSER_DB.exportExcelInBrowser();
  }
}

function handleDownloadDbClick(e) {
  if (isStaticPagesMode && window.TAHOTO_BROWSER_DB) {
    e.preventDefault();
    window.TAHOTO_BROWSER_DB.downloadBrowserDbBackup();
  }
}

// ---------------------------------------------------------------------------
// AUTHENTICATION & RBAC PERMISSIONS
// ---------------------------------------------------------------------------
const PERMISSION_MODULES = [
  { key: "overview", name: "Tổng quan & Báo cáo doanh thu", desc: "Xem biểu đồ doanh thu, lợi nhuận, sản phẩm bán chạy và cảnh báo tồn kho" },
  { key: "sales", name: "Bán hàng (POS)", desc: "Tạo đơn bán hàng, quét mã vạch, lưu hóa đơn nháp và thanh toán VietQR" },
  { key: "invoices", name: "Lịch sử Hóa đơn", desc: "Tra cứu danh sách hóa đơn đã xuất, xem chi tiết và in lại hóa đơn" },
  { key: "products", name: "Hàng hóa & Thẻ kho", desc: "Xem danh mục hàng hóa (Xem) / Thêm, sửa, xóa sản phẩm, điều chỉnh thẻ kho (Sửa)" },
  { key: "debts", name: "Sổ Quản lý Công nợ", desc: "Xem danh sách nợ (Xem) / Thêm khoản nợ, thu nợ 1 phần, tất toán hoặc xóa nợ (Sửa)" },
  { key: "customers", name: "Quản lý Khách hàng", desc: "Xem danh bạ khách hàng (Xem) / Thêm mới, cập nhật hoặc xóa khách hàng (Sửa)" },
  { key: "more", name: "Báo cáo Excel & Cài đặt", desc: "Xem thông tin cài đặt (Xem) / Xuất-nhập Excel, quản lý tài khoản ngân hàng & kết nối DB (Sửa)" },
  { key: "users", name: "Nhân sự & Phân quyền", desc: "Xem danh sách tài khoản (Xem) / Thêm tài khoản và tích chọn phân quyền Xem - Sửa (Sửa)" },
];

const ROLE_LABELS = {
  manager: "Quản lý",
  leader: "Tổ trưởng",
  cashier: "Thu ngân",
};

const ROLE_DEFAULT_PERMS = {
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

function canView(moduleKey) {
  const u = state.currentUser;
  if (!u) return false;
  if (u.role === "manager") return true;
  const p = (u.permissions || {})[moduleKey];
  return Boolean(p && (p.view || p.edit));
}

function canEdit(moduleKey) {
  const u = state.currentUser;
  if (!u) return false;
  if (u.role === "manager") return true;
  const p = (u.permissions || {})[moduleKey];
  return Boolean(p && p.edit);
}

function applyAuthUI() {
  const u = state.currentUser;
  const overlay = document.getElementById("login-overlay");
  if (!u) {
    overlay?.classList.remove("hidden");
    return;
  }
  overlay?.classList.add("hidden");

  const badge = document.getElementById("header-user-badge");
  const nameEl = document.getElementById("header-user-name");
  const roleEl = document.getElementById("header-user-role");
  if (badge && nameEl && roleEl) {
    nameEl.textContent = u.full_name;
    roleEl.textContent = ROLE_LABELS[u.role] || u.role;
  }
  const roleMobEl = document.getElementById("header-user-role-mobile");
  if (roleMobEl) {
    roleMobEl.textContent = ROLE_LABELS[u.role] || u.role;
  }

  // Show/hide navigation tabs according to view permissions
  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    const tabKey = btn.getAttribute("data-tab");
    const allowed = canView(tabKey);
    btn.classList.toggle("hidden", !allowed);
  });
}

async function submitLoginForm(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error-msg");
  if (errEl) errEl.classList.add("hidden");

  try {
    const user = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.currentUser = user;
    sessionStorage.setItem("tahoto_auth_user", JSON.stringify(user));
    document.getElementById("login-password").value = "";
    applyAuthUI();
    showToast(`Xin chào ${user.full_name} (${ROLE_LABELS[user.role] || user.role})!`);
    await loadAllAppDataAndOpenFirstTab();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  }
}

function handleLogout() {
  state.currentUser = null;
  sessionStorage.removeItem("tahoto_auth_user");
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  applyAuthUI();
}

async function loadAllAppDataAndOpenFirstTab() {
  await Promise.all([
    loadSystemInfo(),
    loadCategoriesAndUnits(),
    loadProducts(),
    loadCustomers(),
    loadBankAccounts(),
    loadDrafts(),
  ]);
  const tabOrder = ["overview", "sales", "invoices", "products", "debts", "customers", "more", "users"];
  const firstAllowed = tabOrder.find((k) => canView(k)) || "sales";
  await switchTab(firstAllowed);
}

// ---------------------------------------------------------------------------
// INITIALIZATION & NAVIGATION
// ---------------------------------------------------------------------------
async function initApp() {
  applyLanguageUI();
  try {
    const saved = sessionStorage.getItem("tahoto_auth_user");
    if (saved) {
      state.currentUser = JSON.parse(saved);
    }
  } catch (_) {}

  if (!state.currentUser) {
    applyAuthUI();
    return;
  }
  applyAuthUI();
  await loadAllAppDataAndOpenFirstTab();
}

function toggleLanguage() {
  state.lang = state.lang === "vi" ? "en" : "vi";
  localStorage.setItem("tahoto_lang", state.lang);
  applyLanguageUI();
  switchTab(state.activeTab);
}

function applyLanguageUI() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
  const langBtn = document.getElementById("lang-toggle-label");
  if (langBtn) {
    langBtn.textContent = state.lang === "vi" ? "VI 🇻🇳" : "EN 🇺🇸";
  }
  const langBtnMob = document.getElementById("lang-toggle-label-mobile");
  if (langBtnMob) {
    langBtnMob.textContent = state.lang === "vi" ? "VI" : "EN";
  }
}

async function loadSystemInfo() {
  try {
    state.systemInfo = await apiFetch("/api/system/info");
    const dbBadge = document.getElementById("header-db-badge");
    if (dbBadge && state.systemInfo) {
      dbBadge.textContent = state.systemInfo.database_engine;
    }
    const lowStockBadge = document.getElementById("nav-low-stock-badge");
    if (lowStockBadge && state.systemInfo) {
      const c = state.systemInfo.counts.low_stock;
      lowStockBadge.textContent = c;
      lowStockBadge.classList.toggle("hidden", c <= 0);
    }
    const debtBadge = document.getElementById("nav-debt-badge");
    if (debtBadge && state.systemInfo) {
      const d = state.systemInfo.counts.debts_pending;
      debtBadge.textContent = d;
      debtBadge.classList.toggle("hidden", d <= 0);
    }
  } catch (e) {
    console.error("Failed loading system info:", e);
  }
}

async function loadCategoriesAndUnits() {
  const [cats, units] = await Promise.all([
    apiFetch("/api/categories"),
    apiFetch("/api/units"),
  ]);
  state.categories = cats;
  state.units = units;
}

async function loadProducts() {
  state.products = await apiFetch("/api/products");
}

async function loadCustomers() {
  state.customers = await apiFetch("/api/customers");
}

async function loadBankAccounts() {
  const [accs, dir] = await Promise.all([
    apiFetch("/api/bank-accounts"),
    apiFetch("/api/banks/directory"),
  ]);
  state.bankAccounts = accs;
  state.vnBanksDirectory = dir;
}

async function loadDrafts() {
  state.drafts = await apiFetch("/api/drafts");
  const badge = document.getElementById("pos-drafts-count");
  if (badge) {
    badge.textContent = state.drafts.length;
  }
}

async function switchTab(tabName) {
  if (state.currentUser && !canView(tabName)) {
    showToast("Tài khoản của bạn không được cấp quyền xem mục này", "warning");
    return;
  }
  state.activeTab = tabName;
  document.querySelectorAll(".tab-section").forEach((sec) => {
    sec.classList.add("hidden");
  });
  const activeSec = document.getElementById(`tab-${tabName}`);
  if (activeSec) activeSec.classList.remove("hidden");

  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    const isTarget = btn.getAttribute("data-tab") === tabName;
    if (isTarget) {
      btn.classList.add("bg-indigo-600", "text-white", "shadow-sm");
      btn.classList.remove("text-slate-600", "hover:bg-slate-100");
    } else {
      btn.classList.remove("bg-indigo-600", "text-white", "shadow-sm");
      btn.classList.add("text-slate-600", "hover:bg-slate-100");
    }
  });

  await loadSystemInfo();

  if (tabName === "overview") {
    await refreshOverview();
  } else if (tabName === "sales") {
    await loadProducts();
    await loadDrafts();
    renderPosView();
  } else if (tabName === "invoices") {
    await refreshInvoices();
  } else if (tabName === "products") {
    await loadCategoriesAndUnits();
    await refreshProductsTable();
  } else if (tabName === "debts") {
    await refreshDebts();
  } else if (tabName === "customers") {
    await refreshCustomers();
  } else if (tabName === "more") {
    await loadBankAccounts();
    renderMoreSettings();
  } else if (tabName === "users") {
    await refreshUsersAndPermissions();
  }
}

// ---------------------------------------------------------------------------
// 1. OVERVIEW TAB
// ---------------------------------------------------------------------------
function getOverviewDates(rangeKey) {
  const now = new Date();
  const fmt = (d) => {
    const pad = (v) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  if (rangeKey === "today") {
    return { start: fmt(now), end: fmt(now) };
  }
  if (rangeKey === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: fmt(y), end: fmt(y) };
  }
  if (rangeKey === "this_month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(s), end: fmt(now) };
  }
  if (rangeKey === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(s), end: fmt(e) };
  }
  if (rangeKey === "custom" && state.customStartDate && state.customEndDate) {
    return { start: state.customStartDate, end: state.customEndDate };
  }
  // default last7
  const s = new Date(now);
  s.setDate(now.getDate() - 6);
  return { start: fmt(s), end: fmt(now) };
}

async function setOverviewRange(rangeKey) {
  state.overviewRange = rangeKey;
  const customInputs = document.getElementById("overview-custom-dates");
  if (rangeKey === "custom") {
    customInputs.classList.remove("hidden");
    if (!state.customStartDate || !state.customEndDate) {
      const def = getOverviewDates("last7");
      state.customStartDate = def.start;
      state.customEndDate = def.end;
      document.getElementById("overview-start-input").value = def.start;
      document.getElementById("overview-end-input").value = def.end;
    }
  } else {
    customInputs.classList.add("hidden");
  }
  await refreshOverview();
}

async function applyCustomOverviewDates() {
  state.customStartDate = document.getElementById("overview-start-input").value;
  state.customEndDate = document.getElementById("overview-end-input").value;
  await refreshOverview();
}

async function refreshOverview() {
  const { start, end } = getOverviewDates(state.overviewRange);
  const data = await apiFetch(`/api/overview?start_date=${start}&end_date=${end}`);
  state.overviewData = data;

  // Highlight active range button
  document.querySelectorAll(".overview-range-btn").forEach((btn) => {
    const r = btn.getAttribute("data-range");
    if (r === state.overviewRange) {
      btn.className = "overview-range-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm";
    } else {
      btn.className = "overview-range-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
    }
  });

  // Update KPI Cards
  document.getElementById("kpi-revenue").textContent = formatVnd(data.summary.total_revenue);
  document.getElementById("kpi-cost").textContent = formatVnd(data.summary.total_cost);
  document.getElementById("kpi-profit").textContent = formatVnd(data.summary.total_profit);
  document.getElementById("kpi-orders").textContent = `${data.summary.total_orders} ${state.lang === "en" ? "orders" : "đơn"}`;
  document.getElementById("kpi-debt").textContent = formatVnd(data.summary.all_time_outstanding_debt);
  document.getElementById("kpi-debt-count").textContent = `${data.summary.pending_debt_count} ${state.lang === "en" ? "unpaid records" : "khoản chưa thu"}`;

  renderOverviewCharts(data);
  renderProductRanking(data);
  renderLowStockAlerts(data.low_stock_products);
  renderOverviewDailyTable(data.days);
}

function renderOverviewCharts(data) {
  const revCanvas = document.getElementById("overviewRevenueChart");
  const debtCanvas = document.getElementById("overviewDebtChart");
  if (!revCanvas || !debtCanvas) return;

  if (revenueChartInstance) revenueChartInstance.destroy();
  if (debtChartInstance) debtChartInstance.destroy();

  const isSingle = data.is_single_day;
  const labels = isSingle ? data.hourly.map((h) => h.hour) : data.days.map((d) => d.label);
  const revSeries = isSingle ? data.hourly.map((h) => h.revenue) : data.days.map((d) => d.revenue);
  const profitSeries = isSingle ? [] : data.days.map((d) => d.profit);

  const datasets = [
    {
      label: t("overview_col_revenue"),
      data: revSeries,
      backgroundColor: "rgba(79, 70, 229, 0.85)",
      borderColor: "rgb(79, 70, 229)",
      borderRadius: 6,
    },
  ];
  if (!isSingle) {
    datasets.push({
      label: t("overview_col_profit"),
      data: profitSeries,
      backgroundColor: "rgba(16, 185, 129, 0.85)",
      borderColor: "rgb(16, 185, 129)",
      borderRadius: 6,
    });
  }

  revenueChartInstance = new Chart(revCanvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatVnd(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => (val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val),
          },
        },
      },
    },
  });

  // Debt Chart
  const debtLabels = data.days.map((d) => d.label);
  const debtOutSeries = data.days.map((d) => d.debt_outstanding);
  const debtSettledSeries = data.days.map((d) => d.debt_settled);

  debtChartInstance = new Chart(debtCanvas, {
    type: "bar",
    data: {
      labels: debtLabels,
      datasets: [
        {
          label: t("debts_status_pending"),
          data: debtOutSeries,
          backgroundColor: "rgba(245, 158, 11, 0.85)",
          borderRadius: 6,
        },
        {
          label: t("debts_status_settled"),
          data: debtSettledSeries,
          backgroundColor: "rgba(148, 163, 184, 0.6)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatVnd(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => (val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val),
          },
        },
      },
    },
  });
}

function setRankingMode(mode) {
  state.rankingMode = mode;
  if (state.overviewData) renderProductRanking(state.overviewData);
}

function renderProductRanking(data) {
  const btnBest = document.getElementById("btn-rank-best");
  const btnSlow = document.getElementById("btn-rank-slow");
  if (btnBest && btnSlow) {
    if (state.rankingMode === "best") {
      btnBest.className = "px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white";
      btnSlow.className = "px-3 py-1 text-xs font-semibold rounded-md text-slate-600 hover:bg-slate-100";
    } else {
      btnSlow.className = "px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white";
      btnBest.className = "px-3 py-1 text-xs font-semibold rounded-md text-slate-600 hover:bg-slate-100";
    }
  }

  const list = state.rankingMode === "best" ? data.best_sellers : data.slow_sellers;
  const container = document.getElementById("overview-ranking-list");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="py-8 text-center text-sm text-slate-400">${t("overview_no_data")}</div>`;
    return;
  }

  const maxQty = Math.max(...list.map((i) => i.total_quantity), 1);
  container.innerHTML = list
    .map((item, idx) => {
      const pct = Math.round((item.total_quantity / maxQty) * 100);
      return `
        <div class="py-2.5 border-b border-slate-100 last:border-none">
          <div class="flex items-center justify-between text-sm mb-1">
            <div class="flex items-center gap-2 font-medium text-slate-800 truncate pr-2">
              <span class="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-xs flex items-center justify-center font-bold">${idx + 1}</span>
              <span class="truncate">${item.product_name}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                ${formatNumber(item.total_quantity)} ${item.unit || ""}
              </span>
              <span class="font-bold text-indigo-600 text-xs w-24 text-right">${formatVnd(item.total_revenue)}</span>
            </div>
          </div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLowStockAlerts(lowStockProducts) {
  const container = document.getElementById("overview-low-stock-list");
  if (!container) return;
  if (!lowStockProducts || lowStockProducts.length === 0) {
    container.innerHTML = `<div class="py-6 text-center text-sm text-emerald-600 font-medium">✓ Tất cả hàng hóa đều đủ tồn kho an toàn</div>`;
    return;
  }
  container.innerHTML = lowStockProducts
    .map(
      (p) => `
      <div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-none">
        <div>
          <div class="text-sm font-semibold text-slate-800">${displayProductName(p)}</div>
          <div class="text-xs text-slate-500">${p.barcode ? `Mã: ${p.barcode} · ` : ""}Giá bán: ${formatVnd(p.price)}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            p.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
          }">
            Còn ${formatNumber(p.stock)} ${p.unit || ""}
          </span>
          <button onclick="openQuickRestockModal(${p.id})" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
            + Nhập thêm
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

function renderOverviewDailyTable(days) {
  const tbody = document.getElementById("overview-daily-tbody");
  const tfoot = document.getElementById("overview-daily-tfoot");
  if (!tbody || !tfoot) return;

  if (!days || days.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">${t("overview_no_data")}</td></tr>`;
    tfoot.innerHTML = "";
    return;
  }

  const reversed = [...days].reverse();
  tbody.innerHTML = reversed
    .map(
      (d) => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
        <td class="py-2.5 px-4 font-medium text-slate-700">${d.label} (${d.date})</td>
        <td class="py-2.5 px-4 text-right">${d.orders}</td>
        <td class="py-2.5 px-4 text-right font-semibold text-slate-900">${formatVnd(d.revenue)}</td>
        <td class="py-2.5 px-4 text-right text-slate-600">${formatVnd(d.cost)}</td>
        <td class="py-2.5 px-4 text-right font-semibold text-emerald-600">${formatVnd(d.profit)}</td>
        <td class="py-2.5 px-4 text-right font-medium text-amber-600">${formatVnd(d.debt_outstanding)}</td>
      </tr>
    `
    )
    .join("");

  const totOrders = days.reduce((s, d) => s + d.orders, 0);
  const totRev = days.reduce((s, d) => s + d.revenue, 0);
  const totCost = days.reduce((s, d) => s + d.cost, 0);
  const totProfit = days.reduce((s, d) => s + d.profit, 0);
  const totDebt = days.reduce((s, d) => s + d.debt_outstanding, 0);

  tfoot.innerHTML = `
    <tr class="bg-slate-100 font-bold text-sm text-slate-900">
      <td class="py-3 px-4">TỔNG CỘNG</td>
      <td class="py-3 px-4 text-right">${totOrders}</td>
      <td class="py-3 px-4 text-right text-indigo-700">${formatVnd(totRev)}</td>
      <td class="py-3 px-4 text-right">${formatVnd(totCost)}</td>
      <td class="py-3 px-4 text-right text-emerald-700">${formatVnd(totProfit)}</td>
      <td class="py-3 px-4 text-right text-amber-700">${formatVnd(totDebt)}</td>
    </tr>
  `;
}

// ---------------------------------------------------------------------------
// 2. POS SALES TAB
// ---------------------------------------------------------------------------
function renderPosView() {
  renderPosCategoryPills();
  renderPosProductGrid();
  renderPosCustomerSelect();
  renderPosCart();
}

function renderPosCategoryPills() {
  const container = document.getElementById("pos-category-pills");
  if (!container) return;
  const allActive = state.posCategory === "";
  let html = `
    <button onclick="setPosCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
      allActive ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
    }">
      ${t("pos_all_categories")}
    </button>
  `;
  state.categories.forEach((cat) => {
    const active = state.posCategory === cat.name;
    const label = state.lang === "en" && cat.english_name ? cat.english_name : cat.name;
    html += `
      <button onclick="setPosCategory('${cat.name.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
        active ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }">
        ${label}
      </button>
    `;
  });
  container.innerHTML = html;
}

function setPosCategory(catName) {
  state.posCategory = catName;
  renderPosCategoryPills();
  renderPosProductGrid();
}

function handlePosSearchInput(e) {
  state.posSearch = e.target.value;
  renderPosProductGrid();
}

function handlePosSearchKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const q = (state.posSearch || "").trim();
    if (!q) return;
    // Exact barcode match first
    const exactBarcode = state.products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === q.toLowerCase()
    );
    if (exactBarcode) {
      addToCart(exactBarcode.id, 1);
      state.posSearch = "";
      e.target.value = "";
      renderPosProductGrid();
      showToast(`Đã thêm: ${displayProductName(exactBarcode)}`);
      return;
    }
    // Otherwise if there's at least 1 filtered result, add first match
    const filtered = getFilteredPosProducts();
    if (filtered.length === 1) {
      addToCart(filtered[0].id, 1);
      state.posSearch = "";
      e.target.value = "";
      renderPosProductGrid();
      showToast(`Đã thêm: ${displayProductName(filtered[0])}`);
    }
  }
}

function getFilteredPosProducts() {
  const q = (state.posSearch || "").trim().toLowerCase();
  return state.products.filter((p) => {
    if (state.posCategory && p.category_name !== state.posCategory) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.english_name && p.english_name.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });
}

function renderPosProductGrid() {
  const grid = document.getElementById("pos-product-grid");
  if (!grid) return;
  const list = getFilteredPosProducts();

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        Không tìm thấy sản phẩm phù hợp.
      </div>
    `;
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const inCartQty = state.cart[p.id] || 0;
      const isLow = p.stock <= p.min_stock_threshold;
      const initial = displayProductName(p).charAt(0).toUpperCase();
      return `
        <div onclick="addToCart(${p.id}, 1)" class="group cursor-pointer bg-white rounded-xl border ${
          inCartQty > 0 ? "border-indigo-600 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-indigo-400"
        } p-2.5 sm:p-3.5 shadow-xs hover:shadow-md transition flex flex-col justify-between relative">
          ${
            inCartQty > 0
              ? `<span class="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">x${inCartQty}</span>`
              : ""
          }
          <div class="flex items-start gap-2 sm:gap-3">
            <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-base sm:text-lg flex items-center justify-center shrink-0">
              ${p.image_url ? `<img src="${p.image_url}" class="w-full h-full object-cover rounded-xl"/>` : initial}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-slate-800 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition">
                ${displayProductName(p)}
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5 truncate">${p.barcode || p.category_name || ""}</div>
            </div>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span class="font-bold text-indigo-600 text-xs sm:text-sm">${formatVnd(p.price)}</span>
              ${p.unit ? `<span class="text-[11px] text-slate-400">/${p.unit}</span>` : ""}
            </div>
            <span class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${
              p.stock <= 0
                ? "bg-red-50 text-red-600"
                : isLow
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600"
            }">
              ${t("pos_stock_label")}: ${formatNumber(p.stock)}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
}

function addToCart(productId, delta = 1) {
  const cur = state.cart[productId] || 0;
  const next = cur + delta;
  if (next <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = next;
  }
  renderPosProductGrid();
  renderPosCart();
}

function setCartQuantity(productId, rawVal) {
  const parsed = parseFloat(rawVal);
  if (isNaN(parsed) || parsed <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = parsed;
  }
  renderPosProductGrid();
  renderPosCart();
}

function clearCart() {
  state.cart = {};
  state.posDiscount = 0;
  state.loadedDraftId = null;
  const discInput = document.getElementById("pos-discount-input");
  if (discInput) discInput.value = "";
  renderPosProductGrid();
  renderPosCart();
}

function renderPosCustomerSelect() {
  const sel = document.getElementById("pos-customer-select");
  if (!sel) return;
  let html = `<option value="">${t("pos_walk_in")}</option>`;
  state.customers.forEach((c) => {
    const selected = String(state.posCustomerId) === String(c.id) ? "selected" : "";
    html += `<option value="${c.id}" ${selected}>${c.name} - ${c.phone}</option>`;
  });
  sel.innerHTML = html;
}

function handlePosCustomerChange(e) {
  state.posCustomerId = e.target.value;
  updatePosVietQrPreview();
}

function handlePosDiscountChange(e) {
  const raw = e.target.value.replace(/[^0-9]/g, "");
  state.posDiscount = parseInt(raw || "0", 10);
  renderPosCartTotals();
}

function setPosPaymentMethod(method) {
  state.posPaymentMethod = method;
  document.querySelectorAll(".pos-pay-method-btn").forEach((btn) => {
    const m = btn.getAttribute("data-method");
    if (m === method) {
      btn.className = "pos-pay-method-btn py-2.5 px-3 rounded-xl text-xs font-bold border-2 border-indigo-600 bg-indigo-50 text-indigo-700 transition";
    } else {
      btn.className = "pos-pay-method-btn py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition";
    }
  });
  updatePosVietQrPreview();
}

function getCartItemsDetailed() {
  const map = new Map(state.products.map((p) => [p.id, p]));
  const items = [];
  for (const [idStr, qty] of Object.entries(state.cart)) {
    const pid = Number(idStr);
    const prod = map.get(pid);
    if (prod && qty > 0) {
      items.push({
        product: prod,
        quantity: qty,
        subTotal: Math.round(prod.price * qty),
        costTotal: Math.round(prod.cost * qty),
      });
    }
  }
  return items;
}

function renderPosCart() {
  const container = document.getElementById("pos-cart-items");
  if (!container) return;
  const items = getCartItemsDetailed();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-12 px-4 text-center text-slate-400 text-sm">
        ${t("pos_cart_empty")}
      </div>
    `;
  } else {
    container.innerHTML = items
      .map(
        ({ product, quantity, subTotal }) => `
        <div class="py-2.5 px-3 border-b border-slate-100 last:border-none flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-slate-800 truncate">${displayProductName(product)}</div>
            <div class="text-xs text-slate-500">
              ${formatVnd(product.price)}${product.unit ? ` / ${product.unit}` : ""}
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="addToCart(${product.id}, -1)" class="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold">-</button>
            <input type="number" min="1" step="any" value="${quantity}" onchange="setCartQuantity(${product.id}, this.value)"
              class="w-12 h-7 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
            <button onclick="addToCart(${product.id}, 1)" class="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold">+</button>
          </div>
          <div class="text-right w-24 shrink-0">
            <div class="text-sm font-bold text-slate-900">${formatVnd(subTotal)}</div>
            <button onclick="setCartQuantity(${product.id}, 0)" class="text-[11px] text-red-500 hover:underline">Xóa</button>
          </div>
        </div>
      `
      )
      .join("");
  }

  renderPosCartTotals();
}

function renderPosCartTotals() {
  const items = getCartItemsDetailed();
  const subtotal = items.reduce((s, i) => s + i.subTotal, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const payable = Math.max(0, subtotal - (state.posDiscount || 0));

  document.getElementById("pos-cart-count-badge").textContent = `${formatNumber(totalQty)} món`;
  document.getElementById("pos-subtotal-val").textContent = formatVnd(subtotal);
  document.getElementById("pos-payable-val").textContent = formatVnd(payable);

  const mobCount = document.getElementById("pos-mobile-bar-count");
  const mobTotal = document.getElementById("pos-mobile-bar-total");
  if (mobCount) mobCount.textContent = `${formatNumber(totalQty)} món`;
  if (mobTotal) mobTotal.textContent = formatVnd(payable);

  const checkoutBtn = document.getElementById("pos-checkout-submit-btn");
  if (checkoutBtn) {
    checkoutBtn.disabled = items.length === 0;
  }
  updatePosVietQrPreview();
}

function scrollToMobileCart() {
  const panel = document.getElementById("pos-cart-panel");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function updatePosVietQrPreview() {
  const qrBox = document.getElementById("pos-vietqr-box");
  if (!qrBox) return;
  const items = getCartItemsDetailed();
  const subtotal = items.reduce((s, i) => s + i.subTotal, 0);
  const payable = Math.max(0, subtotal - (state.posDiscount || 0));

  if (state.posPaymentMethod !== "bank_transfer" || payable <= 0) {
    qrBox.classList.add("hidden");
    return;
  }

  qrBox.classList.remove("hidden");
  const errEl = document.getElementById("pos-qr-error");
  if (errEl) errEl.classList.add("hidden");

  const cust = state.customers.find((c) => String(c.id) === String(state.posCustomerId));
  const desc = cust ? cust.name : "Khach le TAHOTO";

  try {
    const qrData = await apiFetch(`/api/vietqr?amount=${payable}&description=${encodeURIComponent(desc)}`);
    state.posVietQrData = qrData;
    document.getElementById("pos-qr-bank-name").textContent = qrData.account.bank_name;
    document.getElementById("pos-qr-acc-holder").textContent = `Chủ TK: ${qrData.account.account_name}`;
    document.getElementById("pos-qr-acc-num").textContent = `Số TK: ${qrData.account.account_number}`;
    document.getElementById("pos-qr-amount").textContent = formatVnd(payable);

    const imgEl = document.getElementById("pos-qr-image");
    const canvas = document.getElementById("pos-qr-canvas");

    const cleanDesc = encodeURIComponent((desc || "Thanh toan TAHOTO").trim());
    const cleanHolder = encodeURIComponent((qrData.account.account_name || "").trim());
    const vietQrUrl =
      qrData.vietqr_image_url ||
      `https://img.vietqr.io/image/${qrData.account.bin_code}-${qrData.account.account_number}-qr_only.png?amount=${payable}&addInfo=${cleanDesc}&accountName=${cleanHolder}`;

    if (imgEl) {
      imgEl.onload = () => {
        imgEl.classList.remove("hidden");
        if (canvas) canvas.classList.add("hidden");
      };
      imgEl.onerror = () => {
        imgEl.classList.add("hidden");
        if (canvas && window.QRCode) {
          canvas.classList.remove("hidden");
          QRCode.toCanvas(canvas, qrData.emv_payload, { width: 170, margin: 1 });
        }
      };
      imgEl.src = vietQrUrl;
    } else if (canvas && window.QRCode) {
      canvas.classList.remove("hidden");
      QRCode.toCanvas(canvas, qrData.emv_payload, { width: 170, margin: 1 });
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  }
}

async function submitPosCheckout() {
  const items = getCartItemsDetailed();
  if (items.length === 0) return;

  const cust = state.customers.find((c) => String(c.id) === String(state.posCustomerId));
  const payload = {
    items: items.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
      price: i.product.price,
    })),
    discount_amount: state.posDiscount || 0,
    payment_method: state.posPaymentMethod,
    customer_id: cust ? cust.id : null,
    customer_name: cust ? cust.name : "Khách lẻ",
    customer_phone: cust ? cust.phone : null,
    draft_id: state.loadedDraftId,
  };

  try {
    const invoice = await apiFetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast(`Đã tạo hóa đơn ${invoice.code} (${formatVnd(invoice.total_amount)})!`);
    clearCart();
    await Promise.all([loadProducts(), loadDrafts(), loadSystemInfo()]);
    renderPosView();
    // Show invoice detail & print dialog immediately
    openInvoiceDetailModal(invoice.id);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Drafts Management
async function saveCurrentCartAsDraft() {
  const items = getCartItemsDetailed();
  if (items.length === 0) {
    showToast("Giỏ hàng đang trống, hãy chọn sản phẩm trước khi lưu nháp", "warning");
    return;
  }
  const subtotal = items.reduce((s, i) => s + i.subTotal, 0);
  const totalItems = items.reduce((s, i) => s + Math.round(i.quantity), 0);
  const cust = state.customers.find((c) => String(c.id) === String(state.posCustomerId));
  const itemsJson = JSON.stringify(
    items.map((i) => ({ productId: i.product.id, quantity: i.quantity }))
  );

  try {
    await apiFetch("/api/drafts", {
      method: "POST",
      body: JSON.stringify({
        items_json: itemsJson,
        total_amount: subtotal,
        total_items: totalItems,
        customer_id: cust ? cust.id : null,
        customer_name: cust ? cust.name : null,
      }),
    });
    clearCart();
    await loadDrafts();
    showToast("Đã lưu hóa đơn nháp thành công!");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openDraftsModal() {
  const modal = document.getElementById("drafts-modal");
  const listEl = document.getElementById("drafts-modal-list");
  if (!modal || !listEl) return;
  modal.classList.remove("hidden");

  if (state.drafts.length === 0) {
    listEl.innerHTML = `<div class="py-8 text-center text-slate-400 text-sm">Chưa có hóa đơn nháp nào được lưu.</div>`;
    return;
  }

  const prodMap = new Map(state.products.map((p) => [p.id, p]));
  listEl.innerHTML = state.drafts
    .map((d) => {
      let parsed = [];
      try {
        parsed = JSON.parse(d.items_json || "[]");
      } catch (_) {}
      const preview = parsed
        .map((item) => {
          const p = prodMap.get(Number(item.productId));
          return p ? `${displayProductName(p)} x${item.quantity}` : null;
        })
        .filter(Boolean)
        .join(", ");

      return `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800 text-sm">${formatDateTime(d.updated_at)}</span>
              ${d.customer_name ? `<span class="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">${d.customer_name}</span>` : ""}
            </div>
            <div class="text-xs font-semibold text-indigo-600 mt-0.5">${d.total_items} mặt hàng · ${formatVnd(d.total_amount)}</div>
            <div class="text-xs text-slate-500 mt-1 truncate">${preview || "Không có chi tiết sản phẩm"}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="loadDraftIntoCart(${d.id})" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              Dùng HĐ này
            </button>
            <button onclick="removeDraft(${d.id})" class="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50">
              Xóa
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function closeDraftsModal() {
  document.getElementById("drafts-modal")?.classList.add("hidden");
}

function loadDraftIntoCart(draftId) {
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) return;
  let parsed = [];
  try {
    parsed = JSON.parse(draft.items_json || "[]");
  } catch (_) {}

  state.cart = {};
  const prodMap = new Map(state.products.map((p) => [p.id, p]));
  let missing = 0;
  parsed.forEach((entry) => {
    const pid = Number(entry.productId);
    if (prodMap.has(pid) && entry.quantity > 0) {
      state.cart[pid] = entry.quantity;
    } else {
      missing++;
    }
  });
  state.posCustomerId = draft.customer_id || "";
  state.loadedDraftId = draft.id;
  closeDraftsModal();
  renderPosView();
  if (missing > 0) {
    showToast(`Đã tải nháp (${missing} sản phẩm không còn tồn tại đã được bỏ qua)`, "warning");
  } else {
    showToast("Đã tải hóa đơn nháp vào giỏ hàng!");
  }
}

async function removeDraft(draftId) {
  await apiFetch(`/api/drafts/${draftId}`, { method: "DELETE" });
  await loadDrafts();
  openDraftsModal();
}

// ---------------------------------------------------------------------------
// 3. INVOICES TAB & RECEIPT PRINTING
// ---------------------------------------------------------------------------
async function refreshInvoices() {
  const q = encodeURIComponent(state.invoiceSearch || "");
  const pm = encodeURIComponent(state.invoicePaymentFilter || "");
  state.invoices = await apiFetch(`/api/invoices?q=${q}&payment_method=${pm}`);
  renderInvoicesTable();
}

function handleInvoiceSearch(e) {
  state.invoiceSearch = e.target.value;
  refreshInvoices();
}

function handleInvoicePaymentFilter(e) {
  state.invoicePaymentFilter = e.target.value;
  refreshInvoices();
}

function renderInvoicesTable() {
  const tbody = document.getElementById("invoices-tbody");
  if (!tbody) return;
  if (state.invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-slate-400 text-sm">${t("invoices_empty")}</td></tr>`;
    return;
  }

  tbody.innerHTML = state.invoices
    .map((inv) => {
      const custName = inv.customer_name || t("pos_walk_in");
      const otherCount = Math.max(0, inv.items_count - 1);
      const summary =
        inv.items_count <= 0
          ? "Chưa có sản phẩm"
          : otherCount > 0
          ? `${inv.top_product_name} x${formatNumber(inv.top_product_quantity)} (+${otherCount} món khác)`
          : `${inv.top_product_name} x${formatNumber(inv.top_product_quantity)}`;

      return `
        <tr onclick="openInvoiceDetailModal(${inv.id})" class="hover:bg-indigo-50/40 cursor-pointer border-b border-slate-100 text-sm transition">
          <td class="py-3 px-4 font-bold text-indigo-600">${inv.code}</td>
          <td class="py-3 px-4 text-slate-600">${formatDateTime(inv.date)}</td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${custName}</div>
            ${inv.customer_phone ? `<div class="text-xs text-slate-400">${inv.customer_phone}</div>` : ""}
          </td>
          <td class="py-3 px-4 text-slate-600 max-w-xs truncate">${summary}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentBadgeClass(inv.payment_method)}">
              ${paymentLabel(inv.payment_method)}
            </span>
          </td>
          <td class="py-3 px-4 text-right font-bold text-slate-900">${formatVnd(inv.total_amount)}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="event.stopPropagation(); openInvoiceDetailModal(${inv.id})" class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 text-xs font-semibold">
              Xem & In
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function openInvoiceDetailModal(invoiceId) {
  const inv = await apiFetch(`/api/invoices/${invoiceId}`);
  const modal = document.getElementById("invoice-detail-modal");
  const content = document.getElementById("invoice-receipt-printable");
  if (!modal || !content) return;

  const custName = inv.customer_name || t("pos_walk_in");
  const custPhone = inv.customer_phone ? ` - ${inv.customer_phone}` : "";

  content.innerHTML = `
    <div class="text-slate-900">
      <div class="border-b border-dashed border-slate-300 pb-3 mb-3">
        <div class="text-base font-extrabold tracking-tight uppercase">TẠP HÓA TỔNG HỢP THỌ HÒA</div>
        <div class="text-xs text-slate-600">Mai Hạ - Trường Phú - Quảng Trị</div>
        <div class="text-xs text-slate-600">ĐT: 0976896458</div>
      </div>
      <div class="text-center my-3">
        <div class="text-lg font-extrabold tracking-wide">HÓA ĐƠN BÁN HÀNG</div>
        <div class="text-xs text-slate-500 mt-0.5">${inv.code} · ${formatDateTime(inv.date)}</div>
      </div>
      <div class="text-xs text-slate-700 mb-3 space-y-0.5">
        <div>Khách hàng: <span class="font-bold">${custName}${custPhone}</span></div>
        ${inv.customer_address ? `<div>Địa chỉ: ${inv.customer_address}</div>` : ""}
        <div>Thanh toán: <span class="font-semibold">${paymentLabel(inv.payment_method)}</span></div>
      </div>
      <table class="w-full text-xs border-t border-b border-slate-300 py-2 my-2">
        <thead>
          <tr class="border-b border-slate-200 text-slate-600">
            <th class="py-1.5 text-left">Sản phẩm</th>
            <th class="py-1.5 text-center w-16">SL</th>
            <th class="py-1.5 text-right w-24">Đơn giá</th>
            <th class="py-1.5 text-right w-24">Thành tiền</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${inv.items
            .map(
              (it) => `
            <tr>
              <td class="py-2 pr-2 font-medium text-slate-800">${it.product_name}</td>
              <td class="py-2 text-center">${formatNumber(it.quantity)} ${it.unit || ""}</td>
              <td class="py-2 text-right">${formatVnd(it.price)}</td>
              <td class="py-2 text-right font-semibold">${formatVnd(it.sub_total)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <div class="space-y-1 text-xs mt-3">
        ${
          inv.discount_amount > 0
            ? `
          <div class="flex justify-between text-slate-600">
            <span>Tạm tính:</span>
            <span>${formatVnd(inv.subtotal_amount)}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Giảm giá:</span>
            <span>-${formatVnd(inv.discount_amount)}</span>
          </div>
        `
            : ""
        }
        <div class="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
          <span>PHẢI THANH TOÁN:</span>
          <span class="text-indigo-700">${formatVnd(inv.total_amount)}</span>
        </div>
      </div>
      <div class="mt-6 pt-3 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-500">
        Cảm ơn Quý khách và hẹn gặp lại!
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
}

function closeInvoiceDetailModal() {
  document.getElementById("invoice-detail-modal")?.classList.add("hidden");
}

function printCurrentInvoice() {
  window.print();
}

// ---------------------------------------------------------------------------
// 4. PRODUCTS & INVENTORY LEDGER TAB
// ---------------------------------------------------------------------------
async function refreshProductsTable() {
  const q = encodeURIComponent(state.productSearch || "");
  const cat = encodeURIComponent(state.productCategoryFilter || "");
  const low = state.productLowStockOnly ? "true" : "false";
  state.products = await apiFetch(`/api/products?q=${q}&category=${cat}&low_stock_only=${low}`);

  // Populate category filter select
  const catSel = document.getElementById("products-category-filter");
  if (catSel) {
    let html = `<option value="">${t("pos_all_categories")}</option>`;
    state.categories.forEach((c) => {
      const sel = state.productCategoryFilter === c.name ? "selected" : "";
      html += `<option value="${c.name}" ${sel}>${c.name}</option>`;
    });
    catSel.innerHTML = html;
  }

  const tbody = document.getElementById("products-tbody");
  if (!tbody) return;

  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-slate-400 text-sm">Chưa có hàng hóa nào phù hợp</td></tr>`;
    return;
  }

  const canEditProd = canEdit("products");
  tbody.innerHTML = state.products
    .map((p) => {
      const isLow = p.stock <= p.min_stock_threshold;
      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${p.name}</div>
            ${p.english_name ? `<div class="text-xs text-slate-400">EN: ${p.english_name}</div>` : ""}
          </td>
          <td class="py-3 px-4 font-mono text-xs text-slate-600">${p.barcode || "-"}</td>
          <td class="py-3 px-4 text-xs text-slate-600">
            ${p.category_name ? `<span class="px-2 py-0.5 rounded-md bg-slate-100">${p.category_name}</span>` : "-"}
          </td>
          <td class="py-3 px-4 text-slate-600">${p.unit || "-"}</td>
          <td class="py-3 px-4 text-right font-bold text-indigo-600">${formatVnd(p.price)}</td>
          <td class="py-3 px-4 text-right text-slate-600">${formatVnd(p.cost)}</td>
          <td class="py-3 px-4 text-right">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
              p.stock <= 0
                ? "bg-red-100 text-red-700"
                : isLow
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-50 text-emerald-700"
            }">
              ${formatNumber(p.stock)} ${p.unit || ""}
            </span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            <button onclick="openProductLedgerModal(${p.id})" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">
              Thẻ kho
            </button>
            ${
              canEditProd
                ? `<button onclick="openProductModal(${p.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold">
                    Sửa
                  </button>
                  <button onclick="confirmDeleteProduct(${p.id})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold">
                    Xóa
                  </button>`
                : `<span class="text-xs text-slate-400 italic">Chỉ xem</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function handleProductSearch(e) {
  state.productSearch = e.target.value;
  refreshProductsTable();
}

function handleProductCategoryFilter(e) {
  state.productCategoryFilter = e.target.value;
  refreshProductsTable();
}

function handleProductLowStockToggle(e) {
  state.productLowStockOnly = e.target.checked;
  refreshProductsTable();
}

function openProductModal(productId = null) {
  if (!canEdit("products")) {
    showToast("Tài khoản của bạn chỉ có quyền Xem hàng hóa, không có quyền Chỉnh sửa", "warning");
    return;
  }
  const modal = document.getElementById("product-modal");
  if (!modal) return;
  const prod = productId ? state.products.find((p) => p.id === productId) : null;

  document.getElementById("product-modal-title").textContent = prod ? "Cập nhật Hàng hóa" : "Thêm Hàng hóa mới";
  document.getElementById("prod-form-id").value = prod ? prod.id : "";
  document.getElementById("prod-form-name").value = prod ? prod.name : "";
  document.getElementById("prod-form-en-name").value = prod ? prod.english_name || "" : "";
  document.getElementById("prod-form-barcode").value = prod ? prod.barcode || "" : "";
  document.getElementById("prod-form-price").value = prod ? prod.price : "";
  document.getElementById("prod-form-cost").value = prod ? prod.cost : "";
  document.getElementById("prod-form-stock").value = prod ? prod.stock : "0";
  document.getElementById("prod-form-min-stock").value = prod ? prod.min_stock_threshold : "5";

  // Populate category datalist/select
  const catList = document.getElementById("prod-category-datalist");
  if (catList) {
    catList.innerHTML = state.categories.map((c) => `<option value="${c.name}"></option>`).join("");
  }
  document.getElementById("prod-form-category").value = prod ? prod.category_name || "" : "";

  const unitList = document.getElementById("prod-unit-datalist");
  if (unitList) {
    unitList.innerHTML = state.units.map((u) => `<option value="${u.name}"></option>`).join("");
  }
  document.getElementById("prod-form-unit").value = prod ? prod.unit || "" : "";

  modal.classList.remove("hidden");
}

function closeProductModal() {
  document.getElementById("product-modal")?.classList.add("hidden");
}

async function submitProductForm(e) {
  e.preventDefault();
  const id = document.getElementById("prod-form-id").value;
  const payload = {
    name: document.getElementById("prod-form-name").value.trim(),
    english_name: document.getElementById("prod-form-en-name").value.trim() || null,
    barcode: document.getElementById("prod-form-barcode").value.trim() || null,
    category_name: document.getElementById("prod-form-category").value.trim(),
    unit: document.getElementById("prod-form-unit").value.trim(),
    price: parseInt(document.getElementById("prod-form-price").value || "0", 10),
    cost: parseInt(document.getElementById("prod-form-cost").value || "0", 10),
    stock: parseFloat(document.getElementById("prod-form-stock").value || "0"),
    min_stock_threshold: parseFloat(document.getElementById("prod-form-min-stock").value || "5"),
  };

  try {
    if (id) {
      await apiFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Đã cập nhật sản phẩm!");
    } else {
      await apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
      showToast("Đã thêm sản phẩm mới!");
    }
    closeProductModal();
    await Promise.all([loadCategoriesAndUnits(), refreshProductsTable(), loadSystemInfo()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function confirmDeleteProduct(productId) {
  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;
  if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${prod.name}"?`)) return;
  try {
    await apiFetch(`/api/products/${productId}`, { method: "DELETE" });
    showToast("Đã xóa sản phẩm!");
    await Promise.all([refreshProductsTable(), loadSystemInfo()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function openProductLedgerModal(productId) {
  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;
  const movements = await apiFetch(`/api/products/${productId}/movements`);
  const modal = document.getElementById("ledger-modal");
  document.getElementById("ledger-modal-title").textContent = `Thẻ kho: ${prod.name} (Hiện tồn: ${formatNumber(prod.stock)} ${prod.unit || ""})`;
  document.getElementById("ledger-product-id").value = productId;

  const tbody = document.getElementById("ledger-tbody");
  if (movements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 text-sm">Chưa có lịch sử biến động tồn kho</td></tr>`;
  } else {
    tbody.innerHTML = movements
      .map(
        (m) => `
        <tr class="border-b border-slate-100 text-xs">
          <td class="py-2.5 px-3 text-slate-600">${formatDateTime(m.created_at)}</td>
          <td class="py-2.5 px-3 font-semibold">${m.movement_type}</td>
          <td class="py-2.5 px-3 font-mono">${m.reference_code || "-"}</td>
          <td class="py-2.5 px-3 text-right font-bold ${m.quantity_change >= 0 ? "text-emerald-600" : "text-red-600"}">
            ${m.quantity_change >= 0 ? `+${formatNumber(m.quantity_change)}` : formatNumber(m.quantity_change)}
          </td>
          <td class="py-2.5 px-3 text-right font-semibold">${formatNumber(m.stock_after)}</td>
          <td class="py-2.5 px-3 text-slate-500">${m.note || ""}</td>
        </tr>
      `
      )
      .join("");
  }
  modal.classList.remove("hidden");
}

function closeLedgerModal() {
  document.getElementById("ledger-modal")?.classList.add("hidden");
}

async function openQuickRestockModal(productId) {
  await loadProducts();
  openProductLedgerModal(productId);
}

async function submitQuickStockAdjustment(e) {
  e.preventDefault();
  if (!canEdit("products")) {
    showToast("Tài khoản của bạn không có quyền điều chỉnh tồn kho", "warning");
    return;
  }
  const productId = document.getElementById("ledger-product-id").value;
  const qty = parseFloat(document.getElementById("ledger-adjust-qty").value || "0");
  const note = document.getElementById("ledger-adjust-note").value.trim();
  if (!qty) return;

  try {
    await apiFetch(`/api/products/${productId}/adjust-stock`, {
      method: "POST",
      body: JSON.stringify({
        quantity_change: qty,
        movement_type: qty > 0 ? "IMPORT" : "ADJUSTMENT",
        note: note || (qty > 0 ? "Nhập thêm hàng vào kho" : "Kiểm kho giảm"),
      }),
    });
    document.getElementById("ledger-adjust-qty").value = "";
    document.getElementById("ledger-adjust-note").value = "";
    await Promise.all([loadProducts(), loadSystemInfo()]);
    if (state.activeTab === "products") await refreshProductsTable();
    if (state.activeTab === "overview") await refreshOverview();
    await openProductLedgerModal(Number(productId));
    showToast("Đã cập nhật thẻ kho!");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// 5. DEBT BOOK (SỔ NỢ) TAB
// ---------------------------------------------------------------------------
async function refreshDebts() {
  const q = encodeURIComponent(state.debtSearch || "");
  const st = encodeURIComponent(state.debtStatusFilter || "all");
  state.debts = await apiFetch(`/api/debts?q=${q}&status=${st}`);
  renderDebtsView();
}

function handleDebtSearch(e) {
  state.debtSearch = e.target.value;
  refreshDebts();
}

function setDebtStatusFilter(status) {
  state.debtStatusFilter = status;
  document.querySelectorAll(".debt-filter-btn").forEach((btn) => {
    const s = btn.getAttribute("data-status");
    if (s === status) {
      btn.className = "debt-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white";
    } else {
      btn.className = "debt-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
    }
  });
  refreshDebts();
}

function renderDebtsView() {
  const pendingDebts = state.debts.filter((d) => !d.is_settled);
  const totalOut = pendingDebts.reduce((s, d) => s + d.remaining_amount, 0);
  document.getElementById("debts-total-banner").textContent = formatVnd(totalOut);
  document.getElementById("debts-count-banner").textContent = `${pendingDebts.length} khoản chưa thu`;

  const tbody = document.getElementById("debts-tbody");
  if (!tbody) return;
  if (state.debts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-slate-400 text-sm">Chưa có khoản ghi nợ nào</td></tr>`;
    return;
  }

  const canEditDebt = canEdit("debts");
  tbody.innerHTML = state.debts
    .map((d) => {
      const daysOld = Math.max(0, Math.floor((Date.now() - d.created_at) / (1000 * 3600 * 24)));
      const ageText = daysOld === 0 ? "Hôm nay" : `${daysOld} ngày`;
      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
          <td class="py-3 px-4">
            <div class="font-bold text-slate-800">${d.customer_name}</div>
            ${d.customer_phone ? `<div class="text-xs text-slate-500">${d.customer_phone}</div>` : ""}
          </td>
          <td class="py-3 px-4 text-xs text-slate-600">
            <div>${formatDateTime(d.created_at)}</div>
            <div class="text-slate-400">Tuổi nợ: ${ageText}</div>
          </td>
          <td class="py-3 px-4 text-xs text-slate-600">
            ${d.invoice_code ? `<span class="font-bold text-indigo-600">${d.invoice_code}</span> · ` : ""}
            ${d.note || "-"}
          </td>
          <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatVnd(d.amount)}</td>
          <td class="py-3 px-4 text-right font-bold ${d.is_settled ? "text-emerald-600" : "text-amber-600"}">
            ${formatVnd(d.remaining_amount)}
            ${d.paid_amount > 0 && !d.is_settled ? `<div class="text-[11px] text-emerald-600 font-normal">Đã trả: ${formatVnd(d.paid_amount)}</div>` : ""}
          </td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
              d.is_settled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }">
              ${d.is_settled ? t("debts_status_settled") : t("debts_status_pending")}
            </span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            ${
              canEditDebt
                ? `${
                    !d.is_settled
                      ? `<button onclick="openPartialDebtModal(${d.id})" class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold">
                          Thu 1 phần
                        </button>`
                      : ""
                  }
                  <button onclick="toggleDebtSettle(${d.id})" class="px-2.5 py-1 rounded-lg ${
                    d.is_settled ? "bg-slate-100 text-slate-600" : "bg-emerald-600 text-white hover:bg-emerald-700"
                  } text-xs font-semibold">
                    ${d.is_settled ? "Đánh dấu chưa thu" : "Tất toán"}
                  </button>
                  <button onclick="deleteDebtRecord(${d.id})" class="px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold">
                    Xóa
                  </button>`
                : `<span class="text-xs text-slate-400 italic">Chỉ xem</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function openDebtModal() {
  if (!canEdit("debts")) {
    showToast("Tài khoản của bạn chỉ có quyền Xem sổ nợ, không có quyền Thêm/Sửa", "warning");
    return;
  }
  const modal = document.getElementById("debt-modal");
  const custSelect = document.getElementById("debt-form-customer-pick");
  if (custSelect) {
    let html = `<option value="">-- Chọn từ danh sách khách hàng --</option>`;
    state.customers.forEach((c) => {
      html += `<option value="${c.id}" data-name="${c.name}" data-phone="${c.phone}">${c.name} (${c.phone})</option>`;
    });
    custSelect.innerHTML = html;
  }
  document.getElementById("debt-form-customer-name").value = "";
  document.getElementById("debt-form-phone").value = "";
  document.getElementById("debt-form-amount").value = "";
  document.getElementById("debt-form-note").value = "";
  modal.classList.remove("hidden");
}

function handleDebtCustomerPick(e) {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) return;
  document.getElementById("debt-form-customer-name").value = opt.getAttribute("data-name") || "";
  document.getElementById("debt-form-phone").value = opt.getAttribute("data-phone") || "";
}

function closeDebtModal() {
  document.getElementById("debt-modal")?.classList.add("hidden");
}

async function submitDebtForm(e) {
  e.preventDefault();
  const custId = document.getElementById("debt-form-customer-pick").value;
  const payload = {
    customer_id: custId ? Number(custId) : null,
    customer_name: document.getElementById("debt-form-customer-name").value.trim(),
    customer_phone: document.getElementById("debt-form-phone").value.trim() || null,
    amount: parseInt(document.getElementById("debt-form-amount").value || "0", 10),
    note: document.getElementById("debt-form-note").value.trim(),
  };
  try {
    await apiFetch("/api/debts", { method: "POST", body: JSON.stringify(payload) });
    closeDebtModal();
    showToast("Đã thêm khoản ghi nợ!");
    await Promise.all([refreshDebts(), loadSystemInfo()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function toggleDebtSettle(debtId) {
  await apiFetch(`/api/debts/${debtId}/toggle-settle`, { method: "POST" });
  showToast("Đã cập nhật trạng thái công nợ!");
  await Promise.all([refreshDebts(), loadSystemInfo()]);
}

function openPartialDebtModal(debtId) {
  const debt = state.debts.find((d) => d.id === debtId);
  if (!debt) return;
  document.getElementById("partial-debt-id").value = debt.id;
  document.getElementById("partial-debt-info").textContent = `${debt.customer_name} · Còn nợ: ${formatVnd(debt.remaining_amount)}`;
  document.getElementById("partial-debt-amount").value = debt.remaining_amount;
  document.getElementById("partial-debt-note").value = "";
  document.getElementById("partial-debt-modal")?.classList.remove("hidden");
}

function closePartialDebtModal() {
  document.getElementById("partial-debt-modal")?.classList.add("hidden");
}

async function submitPartialDebtForm(e) {
  e.preventDefault();
  const id = document.getElementById("partial-debt-id").value;
  const amount = parseInt(document.getElementById("partial-debt-amount").value || "0", 10);
  const note = document.getElementById("partial-debt-note").value.trim();
  try {
    await apiFetch(`/api/debts/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount, payment_method: "cash", note }),
    });
    closePartialDebtModal();
    showToast("Đã ghi nhận thanh toán công nợ!");
    await Promise.all([refreshDebts(), loadSystemInfo()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteDebtRecord(debtId) {
  if (!confirm("Bạn có chắc muốn xóa khoản ghi nợ này?")) return;
  await apiFetch(`/api/debts/${debtId}`, { method: "DELETE" });
  showToast("Đã xóa khoản ghi nợ!");
  await Promise.all([refreshDebts(), loadSystemInfo()]);
}

// ---------------------------------------------------------------------------
// 6. CUSTOMERS TAB
// ---------------------------------------------------------------------------
async function refreshCustomers() {
  const q = encodeURIComponent(state.customerSearch || "");
  state.customers = await apiFetch(`/api/customers?q=${q}`);
  const tbody = document.getElementById("customers-tbody");
  if (!tbody) return;

  if (state.customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-slate-400 text-sm">Chưa có khách hàng nào</td></tr>`;
    return;
  }

  const canEditCust = canEdit("customers");
  tbody.innerHTML = state.customers
    .map(
      (c) => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
        <td class="py-3 px-4 font-bold text-slate-800">${c.name}</td>
        <td class="py-3 px-4 font-mono text-slate-700">${c.phone}</td>
        <td class="py-3 px-4 text-slate-600">${c.address || "-"}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">${c.invoice_count} đơn</span>
        </td>
        <td class="py-3 px-4 text-right font-bold ${c.outstanding_debt > 0 ? "text-amber-600" : "text-slate-400"}">
          ${formatVnd(c.outstanding_debt)}
        </td>
        <td class="py-3 px-4 text-right space-x-1">
          ${
            canEditCust
              ? `<button onclick="openCustomerModal(${c.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold">
                  Sửa
                </button>
                <button onclick="deleteCustomer(${c.id})" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold">
                  Xóa
                </button>`
              : `<span class="text-xs text-slate-400 italic">Chỉ xem</span>`
          }
        </td>
      </tr>
    `
    )
    .join("");
}

function handleCustomerSearch(e) {
  state.customerSearch = e.target.value;
  refreshCustomers();
}

function openCustomerModal(customerId = null) {
  if (!canEdit("customers")) {
    showToast("Tài khoản của bạn chỉ có quyền Xem khách hàng, không có quyền Thêm/Sửa", "warning");
    return;
  }
  const c = customerId ? state.customers.find((x) => x.id === customerId) : null;
  document.getElementById("customer-modal-title").textContent = c ? "Chỉnh sửa Khách hàng" : "Thêm Khách hàng mới";
  document.getElementById("cust-form-id").value = c ? c.id : "";
  document.getElementById("cust-form-name").value = c ? c.name : "";
  document.getElementById("cust-form-phone").value = c ? c.phone : "";
  document.getElementById("cust-form-address").value = c ? c.address || "" : "";
  document.getElementById("customer-modal")?.classList.remove("hidden");
}

function closeCustomerModal() {
  document.getElementById("customer-modal")?.classList.add("hidden");
}

async function submitCustomerForm(e) {
  e.preventDefault();
  const id = document.getElementById("cust-form-id").value;
  const payload = {
    name: document.getElementById("cust-form-name").value.trim(),
    phone: document.getElementById("cust-form-phone").value.trim(),
    address: document.getElementById("cust-form-address").value.trim(),
  };
  try {
    if (id) {
      await apiFetch(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Đã cập nhật khách hàng!");
    } else {
      await apiFetch("/api/customers", { method: "POST", body: JSON.stringify(payload) });
      showToast("Đã thêm khách hàng mới!");
    }
    closeCustomerModal();
    await loadCustomers();
    if (state.activeTab === "customers") await refreshCustomers();
    if (state.activeTab === "sales") renderPosCustomerSelect();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCustomer(customerId) {
  if (!confirm("Bạn có chắc muốn xóa khách hàng này?")) return;
  await apiFetch(`/api/customers/${customerId}`, { method: "DELETE" });
  showToast("Đã xóa khách hàng!");
  await refreshCustomers();
}

// ---------------------------------------------------------------------------
// 7. REPORTS, EXCEL IMPORT/EXPORT & BANK ACCOUNTS TAB
// ---------------------------------------------------------------------------
function renderMoreSettings() {
  const listEl = document.getElementById("bank-accounts-list");
  if (!listEl) return;

  if (state.bankAccounts.length === 0) {
    listEl.innerHTML = `<div class="text-sm text-slate-400 py-4">Chưa có tài khoản ngân hàng nào.</div>`;
  } else {
    listEl.innerHTML = state.bankAccounts
      .map(
        (b) => `
        <div class="p-4 rounded-xl border ${b.is_active ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white"} flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 text-sm">${b.bank_code} - ${b.account_number}</span>
              <span class="px-2 py-0.5 text-[11px] font-bold rounded-full ${
                b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }">
                ${b.is_active ? "Đang sử dụng (VietQR)" : "Ngừng sử dụng"}
              </span>
            </div>
            <div class="text-xs font-semibold text-slate-700 mt-0.5">Chủ TK: ${b.account_name} · BIN: ${b.bin_code}</div>
            <div class="text-xs text-slate-500">${b.bank_name}</div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openBankModal(${b.id})" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Sửa
            </button>
            <button onclick="deleteBankAccount(${b.id})" class="px-3 py-1.5 rounded-lg bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100">
              Xóa
            </button>
          </div>
        </div>
      `
      )
      .join("");
  }

  if (state.systemInfo) {
    document.getElementById("more-db-engine-label").textContent = state.systemInfo.database_engine;
  }

  const userMgmtCard = document.getElementById("more-user-management-card");
  if (userMgmtCard) {
    userMgmtCard.classList.toggle("hidden", !canView("users"));
  }

  if (window.TAHOTO_SUPABASE) {
    const cfg = window.TAHOTO_SUPABASE.getConfig();
    const urlInput = document.getElementById("supabase-url-input");
    const statusBadge = document.getElementById("supabase-status-badge");
    if (urlInput && cfg.url) urlInput.value = cfg.url;
    if (statusBadge) {
      if (cfg.isConfigured) {
        statusBadge.textContent = "Đã kết nối Supabase PostgreSQL";
        statusBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700";
      } else {
        statusBadge.textContent = "Chưa kết nối";
        statusBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-600";
      }
    }
  }
}

async function saveSupabaseConfig(e) {
  e.preventDefault();
  const url = document.getElementById("supabase-url-input").value.trim();
  const key = document.getElementById("supabase-key-input").value.trim();
  if (!url || !key) {
    showToast("Vui lòng nhập đầy đủ Project URL và API Key", "warning");
    return;
  }
  try {
    showToast("Đang kiểm tra kết nối PostgreSQL...");
    await window.TAHOTO_SUPABASE.testConnection(url, key);
    window.TAHOTO_SUPABASE.setConfig(url, key);
    document.getElementById("supabase-key-input").value = "";
    showToast("Đã kết nối Supabase Cloud PostgreSQL thành công!");
    await initApp();
    await switchTab("more");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function disconnectSupabaseConfig() {
  if (!confirm("Bạn muốn ngắt kết nối Supabase Cloud PostgreSQL trên trình duyệt này?")) return;
  window.TAHOTO_SUPABASE.setConfig("", "");
  document.getElementById("supabase-url-input").value = "";
  document.getElementById("supabase-key-input").value = "";
  showToast("Đã ngắt kết nối Supabase.");
  await initApp();
  await switchTab("more");
}

function openBankModal(bankId = null) {
  const acc = bankId ? state.bankAccounts.find((a) => a.id === bankId) : null;
  const sel = document.getElementById("bank-form-select");
  if (sel) {
    sel.innerHTML = state.vnBanksDirectory
      .map(
        (b) =>
          `<option value="${b.code}" data-name="${b.name}" data-bin="${b.bin}" ${
            acc && acc.bank_code === b.code ? "selected" : ""
          }>${b.shortName} (${b.code}) - BIN ${b.bin}</option>`
      )
      .join("");
  }
  document.getElementById("bank-form-id").value = acc ? acc.id : "";
  document.getElementById("bank-form-number").value = acc ? acc.account_number : "";
  document.getElementById("bank-form-holder").value = acc ? acc.account_name : "";
  document.getElementById("bank-form-active").checked = acc ? acc.is_active : true;
  document.getElementById("bank-modal")?.classList.remove("hidden");
}

function closeBankModal() {
  document.getElementById("bank-modal")?.classList.add("hidden");
}

async function submitBankForm(e) {
  e.preventDefault();
  const id = document.getElementById("bank-form-id").value;
  const sel = document.getElementById("bank-form-select");
  const opt = sel.selectedOptions[0];
  const payload = {
    bank_code: opt.value,
    bank_name: opt.getAttribute("data-name"),
    bin_code: opt.getAttribute("data-bin"),
    account_number: document.getElementById("bank-form-number").value.trim(),
    account_name: document.getElementById("bank-form-holder").value.trim().toUpperCase(),
    is_active: document.getElementById("bank-form-active").checked,
  };

  try {
    if (id) {
      await apiFetch(`/api/bank-accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Đã cập nhật tài khoản ngân hàng!");
    } else {
      await apiFetch("/api/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
      showToast("Đã thêm tài khoản ngân hàng!");
    }
    closeBankModal();
    await loadBankAccounts();
    renderMoreSettings();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteBankAccount(accountId) {
  if (!confirm("Bạn có chắc muốn xóa tài khoản ngân hàng này?")) return;
  await apiFetch(`/api/bank-accounts/${accountId}`, { method: "DELETE" });
  await loadBankAccounts();
  renderMoreSettings();
  showToast("Đã xóa tài khoản ngân hàng!");
}

async function handleExcelUpload(inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  const conflictMode = document.getElementById("excel-conflict-mode")?.value || "update";

  try {
    showToast("Đang xử lý tệp Excel...");
    let res;
    if (isStaticPagesMode && window.TAHOTO_BROWSER_DB) {
      res = await window.TAHOTO_BROWSER_DB.importExcelInBrowser(file, conflictMode);
    } else {
      const formData = new FormData();
      formData.append("file", file);
      res = await apiFetch(`/api/reports/import-excel?conflict_mode=${conflictMode}`, {
        method: "POST",
        body: formData,
      });
    }
    const s = res.stats;
    showToast(
      `Nhập Excel thành công! SP mới: ${s.products_added}, Cập nhật: ${s.products_updated}, KH: ${s.customers_imported}, Công nợ: ${s.debts_imported}`
    );
    inputEl.value = "";
    await Promise.all([loadProducts(), loadCustomers(), loadSystemInfo()]);
    if (state.activeTab === "products") await refreshProductsTable();
  } catch (err) {
    showToast(err.message, "error");
    inputEl.value = "";
  }
}

// ---------------------------------------------------------------------------
// 8. CAMERA BARCODE SCANNER
// ---------------------------------------------------------------------------
function openBarcodeScannerModal(targetMode = "pos") {
  const modal = document.getElementById("scanner-modal");
  if (!modal) return;
  modal.classList.remove("hidden");

  if (!window.Html5Qrcode) {
    showToast("Trình quét Camera chưa sẵn sàng, bạn có thể dùng súng quét mã vạch USB/Bluetooth trực tiếp tại ô tìm kiếm.", "warning");
    return;
  }

  html5QrScanner = new Html5Qrcode("scanner-reader");
  html5QrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (targetMode === "pos") {
          const matched = state.products.find(
            (p) => p.barcode && p.barcode.toLowerCase() === decodedText.toLowerCase()
          );
          if (matched) {
            addToCart(matched.id, 1);
            showToast(`Đã quét: ${displayProductName(matched)}`);
          } else {
            state.posSearch = decodedText;
            const searchEl = document.getElementById("pos-search-input");
            if (searchEl) searchEl.value = decodedText;
            renderPosProductGrid();
            showToast(`Mã vạch: ${decodedText}`, "warning");
          }
        } else if (targetMode === "product-form") {
          document.getElementById("prod-form-barcode").value = decodedText;
          showToast(`Đã điền mã vạch: ${decodedText}`);
        }
        closeBarcodeScannerModal();
      },
      () => {}
    )
    .catch((err) => {
      console.warn("Camera error:", err);
      showToast("Không thể truy cập Camera. Hãy kiểm tra quyền trình duyệt hoặc nhập mã vạch trực tiếp.", "warning");
    });
}

function closeBarcodeScannerModal() {
  const modal = document.getElementById("scanner-modal");
  modal?.classList.add("hidden");
  if (html5QrScanner) {
    html5QrScanner
      .stop()
      .catch(() => {})
      .finally(() => {
        html5QrScanner = null;
      });
  }
}

// ---------------------------------------------------------------------------
// 9. USERS & 2-COLUMN PERMISSION MATRIX TAB (XEM / SỬA)
// ---------------------------------------------------------------------------
async function refreshUsersAndPermissions() {
  state.users = await apiFetch("/api/users");
  if (!state.selectedUserIdForPerms || !state.users.some((u) => u.id === state.selectedUserIdForPerms)) {
    // Prefer selecting a non-manager user first so the manager can immediately configure subordinates
    const sub = state.users.find((u) => u.role !== "manager") || state.users[0];
    state.selectedUserIdForPerms = sub ? sub.id : null;
  }
  selectUserForPermissions(state.selectedUserIdForPerms);
}

function selectUserForPermissions(userId) {
  state.selectedUserIdForPerms = userId;
  const target = state.users.find((u) => u.id === userId);
  if (target) {
    state.editingPermsDraft = JSON.parse(JSON.stringify(target.permissions || ROLE_DEFAULT_PERMS[target.role] || ROLE_DEFAULT_PERMS.cashier));
  } else {
    state.editingPermsDraft = {};
  }
  renderUsersList();
  renderPermissionsMatrix();
}

function renderUsersList() {
  const container = document.getElementById("users-list-container");
  if (!container) return;
  const canEditUsers = canEdit("users");
  const addBtn = document.getElementById("btn-add-user");
  if (addBtn) addBtn.classList.toggle("hidden", !canEditUsers);

  if (state.users.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-sm text-slate-400">Chưa có tài khoản nào</div>`;
    return;
  }

  container.innerHTML = state.users
    .map((u) => {
      const isSelected = u.id === state.selectedUserIdForPerms;
      const roleBadge =
        u.role === "manager"
          ? "bg-purple-100 text-purple-700"
          : u.role === "leader"
          ? "bg-blue-100 text-blue-700"
          : "bg-emerald-100 text-emerald-700";

      return `
        <div
          onclick="selectUserForPermissions(${u.id})"
          class="p-4 cursor-pointer transition flex items-center justify-between gap-3 ${
            isSelected ? "bg-indigo-50/70 border-l-4 border-l-indigo-600" : "hover:bg-slate-50"
          }"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-bold text-slate-900 text-sm">${u.full_name}</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${roleBadge}">
                ${ROLE_LABELS[u.role] || u.role}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                u.is_active !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-600"
              }">
                ${u.is_active !== false ? "Hoạt động" : "Đang khóa"}
              </span>
            </div>
            <div class="text-xs text-slate-500 mt-0.5 font-mono">Tài khoản: @${u.username}</div>
          </div>
          ${
            canEditUsers
              ? `<div class="flex flex-wrap items-center justify-end gap-1.5 shrink-0" onclick="event.stopPropagation()">
                  <button onclick="openUserModal(${u.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700">
                    Sửa / Đổi MK
                  </button>
                  ${
                    u.role !== "manager"
                      ? `<button onclick="toggleUserActiveStatus(${u.id})" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700">
                          ${u.is_active !== false ? "Khóa" : "Mở khóa"}
                        </button>
                        <button onclick="deleteUserAccount(${u.id})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-600">
                          Xóa
                        </button>`
                      : ""
                  }
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderPermissionsMatrix() {
  const tbody = document.getElementById("permissions-matrix-tbody");
  const titleEl = document.getElementById("perm-target-user-title");
  const subEl = document.getElementById("perm-target-user-subtitle");
  const saveBtn = document.getElementById("btn-save-user-perms");
  const resetBtn = document.getElementById("btn-reset-role-perms");
  if (!tbody) return;

  const target = state.users.find((u) => u.id === state.selectedUserIdForPerms);
  if (!target) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-400">Chọn một tài khoản bên trái để phân quyền</td></tr>`;
    return;
  }

  if (titleEl) titleEl.textContent = `${target.full_name} (${ROLE_LABELS[target.role] || target.role})`;
  const isTargetManager = target.role === "manager";
  const canEditUsers = canEdit("users") && !isTargetManager;

  if (subEl) {
    subEl.textContent = isTargetManager
      ? "Tài khoản Quản lý có toàn quyền Xem và Sửa tất cả các chức năng hệ thống."
      : "Tích chọn cột Được Xem và cột Được Sửa để cấp quyền cho nhân sự này.";
  }
  if (saveBtn) saveBtn.disabled = !canEditUsers;
  if (resetBtn) resetBtn.disabled = !canEditUsers;

  tbody.innerHTML = PERMISSION_MODULES.map((mod) => {
    const p = isTargetManager
      ? { view: true, edit: true }
      : (state.editingPermsDraft && state.editingPermsDraft[mod.key]) || { view: false, edit: false };

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3 px-3 sm:px-5">
          <div class="font-bold text-slate-800 text-xs sm:text-sm">${mod.name}</div>
          <div class="sm:hidden text-[11px] text-slate-500 mt-0.5 leading-snug">${mod.desc}</div>
        </td>
        <td class="hidden sm:table-cell py-3.5 px-5 text-xs text-slate-500">${mod.desc}</td>
        <td class="py-3 px-2 sm:px-4 text-center">
          <input
            type="checkbox"
            ${p.view ? "checked" : ""}
            ${!canEditUsers ? "disabled" : ""}
            onchange="togglePermissionCheckbox('${mod.key}', 'view', this.checked)"
            class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          />
        </td>
        <td class="py-3 px-2 sm:px-4 text-center">
          <input
            type="checkbox"
            ${p.edit ? "checked" : ""}
            ${!canEditUsers ? "disabled" : ""}
            onchange="togglePermissionCheckbox('${mod.key}', 'edit', this.checked)"
            class="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
          />
        </td>
      </tr>
    `;
  }).join("");
}

function togglePermissionCheckbox(moduleKey, colType, checked) {
  if (!state.editingPermsDraft) state.editingPermsDraft = {};
  if (!state.editingPermsDraft[moduleKey]) {
    state.editingPermsDraft[moduleKey] = { view: false, edit: false };
  }
  if (colType === "edit") {
    state.editingPermsDraft[moduleKey].edit = checked;
    // If granted Edit permission, automatically grant View permission
    if (checked) {
      state.editingPermsDraft[moduleKey].view = true;
    }
  } else if (colType === "view") {
    state.editingPermsDraft[moduleKey].view = checked;
    // If revoking View permission, also revoke Edit permission
    if (!checked) {
      state.editingPermsDraft[moduleKey].edit = false;
    }
  }
  renderPermissionsMatrix();
}

function applyDefaultRoleTemplate() {
  const target = state.users.find((u) => u.id === state.selectedUserIdForPerms);
  if (!target || target.role === "manager") return;
  const tpl = ROLE_DEFAULT_PERMS[target.role] || ROLE_DEFAULT_PERMS.cashier;
  state.editingPermsDraft = JSON.parse(JSON.stringify(tpl));
  renderPermissionsMatrix();
  showToast(`Đã áp dụng mẫu quyền mặc định của ${ROLE_LABELS[target.role]} (Bấm Lưu phân quyền để hoàn tất)`);
}

async function saveSelectedUserPermissions() {
  const target = state.users.find((u) => u.id === state.selectedUserIdForPerms);
  if (!target || target.role === "manager") return;

  try {
    const updated = await apiFetch(`/api/users/${target.id}`, {
      method: "PUT",
      body: JSON.stringify({
        permissions_json: JSON.stringify(state.editingPermsDraft || {}),
      }),
    });
    // If current logged-in user updated their own permissions
    if (state.currentUser && state.currentUser.id === updated.id) {
      state.currentUser = updated;
      sessionStorage.setItem("tahoto_auth_user", JSON.stringify(updated));
      applyAuthUI();
    }
    await refreshUsersAndPermissions();
    showToast(`Đã lưu phân quyền cho ${updated.full_name}!`);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openUserModal(userId = null) {
  if (!canEdit("users")) {
    showToast("Chỉ Quản lý mới có quyền thêm hoặc sửa tài khoản nhân sự", "warning");
    return;
  }
  const u = userId ? state.users.find((x) => x.id === userId) : null;
  document.getElementById("user-modal-title").textContent = u ? "Cập nhật Tài khoản Nhân sự" : "Thêm Tài khoản Nhân sự";
  document.getElementById("user-form-id").value = u ? u.id : "";
  const unameInput = document.getElementById("user-form-username");
  unameInput.value = u ? u.username : "";
  unameInput.disabled = false;
  document.getElementById("user-form-fullname").value = u ? u.full_name : "";
  document.getElementById("user-form-role").value = u ? u.role : "cashier";
  const pwdInput = document.getElementById("user-form-password");
  pwdInput.value = "";
  pwdInput.required = !u;
  document.getElementById("user-form-password-label").textContent = u
    ? "Mật khẩu mới (Để trống nếu giữ nguyên)"
    : "Mật khẩu *";
  document.getElementById("user-form-active").checked = u ? u.is_active !== false : true;
  document.getElementById("user-modal")?.classList.remove("hidden");
}

function closeUserModal() {
  document.getElementById("user-modal")?.classList.add("hidden");
}

async function submitUserForm(e) {
  e.preventDefault();
  const id = document.getElementById("user-form-id").value;
  const username = document.getElementById("user-form-username").value.trim().toLowerCase();
  const full_name = document.getElementById("user-form-fullname").value.trim();
  const role = document.getElementById("user-form-role").value;
  const password = document.getElementById("user-form-password").value;
  const is_active = document.getElementById("user-form-active").checked;

  try {
    if (id) {
      const target = state.users.find((x) => String(x.id) === String(id));
      const roleChanged = target && target.role !== role;
      const permsToSave = roleChanged
        ? JSON.stringify(ROLE_DEFAULT_PERMS[role] || ROLE_DEFAULT_PERMS.cashier)
        : undefined;

      const updated = await apiFetch(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          username,
          full_name,
          role,
          password: password || undefined,
          permissions_json: permsToSave,
          is_active,
        }),
      });
      if (state.currentUser && state.currentUser.id === updated.id) {
        state.currentUser = updated;
        sessionStorage.setItem("tahoto_auth_user", JSON.stringify(updated));
        applyAuthUI();
      }
      showToast(`Đã cập nhật tài khoản ${updated.full_name}!`);
      state.selectedUserIdForPerms = updated.id;
    } else {
      const defaultPerms = ROLE_DEFAULT_PERMS[role] || ROLE_DEFAULT_PERMS.cashier;
      const created = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          full_name,
          role,
          permissions_json: JSON.stringify(defaultPerms),
          is_active,
        }),
      });
      showToast(`Đã tạo tài khoản ${created.full_name}!`);
      state.selectedUserIdForPerms = created.id;
    }
    closeUserModal();
    await refreshUsersAndPermissions();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function toggleUserActiveStatus(userId) {
  const u = state.users.find((x) => x.id === userId);
  if (!u || u.role === "manager") return;
  try {
    const nextActive = u.is_active === false;
    await apiFetch(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: nextActive }),
    });
    showToast(nextActive ? `Đã mở khóa tài khoản @${u.username}` : `Đã tạm khóa tài khoản @${u.username}`);
    await refreshUsersAndPermissions();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteUserAccount(userId) {
  const u = state.users.find((x) => x.id === userId);
  if (!u) return;
  if (!confirm(`Bạn có chắc muốn xóa tài khoản "${u.full_name}" (@${u.username})?`)) return;
  try {
    await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
    showToast("Đã xóa tài khoản!");
    state.selectedUserIdForPerms = null;
    await refreshUsersAndPermissions();
  } catch (err) {
    showToast(err.message, "error");
  }
}

window.addEventListener("DOMContentLoaded", initApp);
