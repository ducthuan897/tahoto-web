import os
import json
import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from .database import engine, Base, get_db, SessionLocal, DATABASE_URL, DATA_DIR
from .models import (
    Category,
    UnitOfMeasure,
    Product,
    Customer,
    Invoice,
    InvoiceItem,
    StockMovement,
    DebtRecord,
    DebtPayment,
    BankAccount,
    InvoiceDraft,
    AppUser,
    now_millis,
)
from .schemas import (
    ProductCreate,
    ProductUpdate,
    StockAdjustmentRequest,
    CategoryCreate,
    UnitCreate,
    CustomerCreate,
    CustomerUpdate,
    CheckoutRequest,
    DraftCreate,
    DebtCreate,
    DebtUpdate,
    DebtPaymentCreate,
    BankAccountCreate,
    BankAccountUpdate,
    LoginRequest,
    UserCreate,
    UserUpdate,
)
from .seed import seed_initial_data, hash_password, DEFAULT_PERMISSIONS_BY_ROLE
from .vietqr import POPULAR_VN_BANKS, build_vietqr_payload
from .excel_service import export_full_excel_report, import_excel_workbook

app = FastAPI(
    title="TAHOTO Enterprise Web API",
    description="Hệ thống Quản lý Bán hàng, Kho, Công nợ & Báo cáo Tạp Hóa Tổng Hợp Thọ Hòa",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# HELPER SERIALIZERS
# ---------------------------------------------------------------------------
def serialize_product(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "english_name": p.english_name,
        "barcode": p.barcode,
        "category_id": p.category_id,
        "category_name": p.category_name or (p.category_rel.name if p.category_rel else ""),
        "price": p.price,
        "cost": p.cost,
        "unit": p.unit or "",
        "stock": p.stock,
        "min_stock_threshold": p.min_stock_threshold,
        "image_url": p.image_url,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


def serialize_customer(c: Customer, db: Optional[Session] = None) -> dict:
    outstanding_debt = 0
    invoice_count = 0
    if db is not None:
        outstanding_debt = (
            db.query(func.coalesce(func.sum(DebtRecord.amount - DebtRecord.paid_amount), 0))
            .filter(DebtRecord.customer_id == c.id, DebtRecord.is_settled == False)
            .scalar()
            or 0
        )
        invoice_count = db.query(func.count(Invoice.id)).filter(Invoice.customer_id == c.id).scalar() or 0
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "address": c.address or "",
        "note": c.note or "",
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "outstanding_debt": int(outstanding_debt),
        "invoice_count": int(invoice_count),
    }


def serialize_invoice_summary(inv: Invoice) -> dict:
    items = inv.items or []
    top_item = max(items, key=lambda x: x.quantity) if items else None
    top_name = (
        (top_item.product.name if top_item and top_item.product else top_item.product_name_snapshot)
        if top_item
        else None
    )
    return {
        "id": inv.id,
        "code": inv.code,
        "date": inv.date,
        "subtotal_amount": inv.subtotal_amount,
        "discount_amount": inv.discount_amount,
        "total_amount": inv.total_amount,
        "total_cost": inv.total_cost,
        "profit": inv.total_amount - inv.total_cost,
        "items_count": len(items),
        "payment_method": inv.payment_method or inv.note or "cash",
        "note": inv.note,
        "customer_id": inv.customer_id,
        "customer_name": inv.customer.name if inv.customer else None,
        "customer_phone": inv.customer.phone if inv.customer else None,
        "customer_address": inv.customer.address if inv.customer else None,
        "top_product_name": top_name,
        "top_product_quantity": top_item.quantity if top_item else 0,
    }


def serialize_debt(d: DebtRecord) -> dict:
    remaining = max(0, int(d.amount) - int(d.paid_amount or 0))
    if d.is_settled:
        remaining = 0
    return {
        "id": d.id,
        "invoice_id": d.invoice_id,
        "invoice_code": d.invoice.code if d.invoice else (f"HD{d.invoice_id}" if d.invoice_id else None),
        "customer_id": d.customer_id,
        "customer_name": d.customer_name,
        "customer_phone": d.customer_phone or (d.customer.phone if d.customer else None),
        "amount": int(d.amount),
        "paid_amount": int(d.amount) if d.is_settled else int(d.paid_amount or 0),
        "remaining_amount": remaining,
        "note": d.note or "",
        "created_at": d.created_at,
        "due_date": d.due_date,
        "is_settled": d.is_settled,
        "settled_at": d.settled_at,
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "note": p.note,
                "paid_at": p.paid_at,
            }
            for p in sorted(d.payments or [], key=lambda x: x.paid_at, reverse=True)
        ],
    }


# ---------------------------------------------------------------------------
# SYSTEM & DATABASE INFO
# ---------------------------------------------------------------------------
@app.get("/api/system/info")
def get_system_info(db: Session = Depends(get_db)):
    engine_name = "PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite Enterprise (WAL + Foreign Keys)"
    return {
        "store_name": "TẠP HÓA TỔNG HỢP THỌ HÒA",
        "store_address": "Mai Hạ - Trường Phú - Quảng Trị",
        "store_phone": "0976896458",
        "database_engine": engine_name,
        "counts": {
            "products": db.query(func.count(Product.id)).scalar() or 0,
            "customers": db.query(func.count(Customer.id)).scalar() or 0,
            "invoices": db.query(func.count(Invoice.id)).scalar() or 0,
            "debts_pending": db.query(func.count(DebtRecord.id)).filter(DebtRecord.is_settled == False).scalar() or 0,
            "low_stock": db.query(func.count(Product.id)).filter(Product.stock <= Product.min_stock_threshold).scalar() or 0,
        },
    }


# ---------------------------------------------------------------------------
# OVERVIEW & ANALYTICS
# ---------------------------------------------------------------------------
@app.get("/api/overview")
def get_overview(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    today = datetime.date.today()
    try:
        s_date = datetime.date.fromisoformat(start_date) if start_date else (today - datetime.timedelta(days=6))
        e_date = datetime.date.fromisoformat(end_date) if end_date else today
    except ValueError:
        s_date = today - datetime.timedelta(days=6)
        e_date = today

    if e_date < s_date:
        s_date, e_date = e_date, s_date

    start_dt = datetime.datetime.combine(s_date, datetime.time.min)
    end_dt = datetime.datetime.combine(e_date, datetime.time.max)
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)

    invoices_in_range = (
        db.query(Invoice)
        .filter(Invoice.date >= start_ms, Invoice.date <= end_ms)
        .order_by(Invoice.date.asc())
        .all()
    )

    debts_in_range = (
        db.query(DebtRecord)
        .filter(DebtRecord.created_at >= start_ms, DebtRecord.created_at <= end_ms)
        .all()
    )

    # Build day-by-day stats
    day_count = (e_date - s_date).days
    days_map = {}
    for offset in range(day_count + 1):
        d = s_date + datetime.timedelta(days=offset)
        d_str = d.isoformat()
        days_map[d_str] = {
            "date": d_str,
            "label": d.strftime("%d/%m"),
            "orders": 0,
            "revenue": 0,
            "cost": 0,
            "profit": 0,
            "debt_outstanding": 0,
            "debt_settled": 0,
        }

    # Hourly stats (for single-day view)
    hourly_stats = [{"hour": f"{h:02d}:00", "revenue": 0, "orders": 0} for h in range(24)]

    for inv in invoices_in_range:
        dt = datetime.datetime.fromtimestamp(inv.date / 1000.0)
        d_str = dt.date().isoformat()
        if d_str in days_map:
            days_map[d_str]["orders"] += 1
            days_map[d_str]["revenue"] += int(inv.total_amount)
            days_map[d_str]["cost"] += int(inv.total_cost)
            days_map[d_str]["profit"] += int(inv.total_amount - inv.total_cost)
        hourly_stats[dt.hour]["revenue"] += int(inv.total_amount)
        hourly_stats[dt.hour]["orders"] += 1

    for debt in debts_in_range:
        dt = datetime.datetime.fromtimestamp(debt.created_at / 1000.0)
        d_str = dt.date().isoformat()
        if d_str in days_map:
            rem = 0 if debt.is_settled else max(0, int(debt.amount) - int(debt.paid_amount or 0))
            settled_amt = int(debt.amount) if debt.is_settled else int(debt.paid_amount or 0)
            days_map[d_str]["debt_outstanding"] += rem
            days_map[d_str]["debt_settled"] += settled_amt

    days_list = list(days_map.values())
    total_revenue = sum(d["revenue"] for d in days_list)
    total_cost = sum(d["cost"] for d in days_list)
    total_profit = total_revenue - total_cost
    total_orders = sum(d["orders"] for d in days_list)
    total_debt_in_range = sum(d["debt_outstanding"] for d in days_list)

    # All-time outstanding debt
    all_pending_debts = db.query(DebtRecord).filter(DebtRecord.is_settled == False).all()
    total_all_time_debt = sum(max(0, int(d.amount) - int(d.paid_amount or 0)) for d in all_pending_debts)

    # Product performance in range
    perf_rows = (
        db.query(
            InvoiceItem.product_id,
            func.coalesce(Product.name, InvoiceItem.product_name_snapshot).label("product_name"),
            func.coalesce(Product.unit, InvoiceItem.unit_snapshot).label("unit"),
            func.sum(InvoiceItem.quantity).label("total_quantity"),
            func.sum(InvoiceItem.sub_total).label("total_revenue"),
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .outerjoin(Product, Product.id == InvoiceItem.product_id)
        .filter(Invoice.date >= start_ms, Invoice.date <= end_ms)
        .group_by(InvoiceItem.product_id, Product.name, InvoiceItem.product_name_snapshot, Product.unit, InvoiceItem.unit_snapshot)
        .having(func.sum(InvoiceItem.quantity) > 0)
        .all()
    )

    perf_list = [
        {
            "product_id": r.product_id,
            "product_name": r.product_name or "Sản phẩm chưa đặt tên",
            "unit": r.unit or "",
            "total_quantity": float(r.total_quantity or 0),
            "total_revenue": int(r.total_revenue or 0),
        }
        for r in perf_rows
    ]

    best_sellers = sorted(perf_list, key=lambda x: (-x["total_quantity"], -x["total_revenue"]))[:8]
    slow_sellers = sorted(perf_list, key=lambda x: (x["total_quantity"], x["total_revenue"]))[:8]

    # Low stock products notifications
    low_stock_products = (
        db.query(Product)
        .filter(Product.stock <= Product.min_stock_threshold)
        .order_by(Product.stock.asc())
        .all()
    )

    return {
        "start_date": s_date.isoformat(),
        "end_date": e_date.isoformat(),
        "is_single_day": s_date == e_date,
        "summary": {
            "total_revenue": total_revenue,
            "total_cost": total_cost,
            "total_profit": total_profit,
            "total_orders": total_orders,
            "debt_in_range": total_debt_in_range,
            "all_time_outstanding_debt": total_all_time_debt,
            "pending_debt_count": len(all_pending_debts),
        },
        "days": days_list,
        "hourly": hourly_stats,
        "best_sellers": best_sellers,
        "slow_sellers": slow_sellers,
        "low_stock_products": [serialize_product(p) for p in low_stock_products],
    }


# ---------------------------------------------------------------------------
# CATEGORIES & UNITS
# ---------------------------------------------------------------------------
@app.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.name.asc()).all()
    return [{"id": c.id, "name": c.name, "english_name": c.english_name} for c in cats]


@app.post("/api/categories")
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên nhóm hàng không được để trống")
    existing = db.query(Category).filter(func.lower(Category.name) == name.lower()).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "english_name": existing.english_name}
    cat = Category(name=name, english_name=payload.english_name or name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "english_name": cat.english_name}


@app.get("/api/units")
def list_units(db: Session = Depends(get_db)):
    units = db.query(UnitOfMeasure).order_by(UnitOfMeasure.name.asc()).all()
    return [{"id": u.id, "name": u.name, "english_name": u.english_name} for u in units]


@app.post("/api/units")
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên đơn vị không được để trống")
    existing = db.query(UnitOfMeasure).filter(func.lower(UnitOfMeasure.name) == name.lower()).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "english_name": existing.english_name}
    u = UnitOfMeasure(name=name, english_name=payload.english_name or name)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "name": u.name, "english_name": u.english_name}


# ---------------------------------------------------------------------------
# PRODUCTS & INVENTORY LEDGER
# ---------------------------------------------------------------------------
@app.get("/api/products")
def list_products(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(term),
                Product.english_name.ilike(term),
                Product.barcode.ilike(term),
                Product.category_name.ilike(term),
            )
        )
    if category and category.strip():
        query = query.filter(Product.category_name == category.strip())
    if low_stock_only:
        query = query.filter(Product.stock <= Product.min_stock_threshold)

    prods = query.order_by(Product.updated_at.desc(), Product.id.desc()).all()
    return [serialize_product(p) for p in prods]


@app.post("/api/products")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên hàng hóa không được để trống")

    now = now_millis()
    cat_name = (payload.category_name or "").strip()
    cat_id = None
    if cat_name:
        cat = db.query(Category).filter(func.lower(Category.name) == cat_name.lower()).first()
        if not cat:
            cat = Category(name=cat_name, english_name=cat_name, created_at=now)
            db.add(cat)
            db.flush()
        cat_id = cat.id

    unit_name = (payload.unit or "").strip()
    if unit_name:
        u = db.query(UnitOfMeasure).filter(func.lower(UnitOfMeasure.name) == unit_name.lower()).first()
        if not u:
            db.add(UnitOfMeasure(name=unit_name, english_name=unit_name))
            db.flush()

    p = Product(
        name=name,
        english_name=(payload.english_name or "").strip() or None,
        barcode=(payload.barcode or "").strip() or None,
        category_id=cat_id,
        category_name=cat_name,
        price=max(0, payload.price),
        cost=max(0, payload.cost),
        unit=unit_name,
        stock=payload.stock,
        min_stock_threshold=payload.min_stock_threshold,
        image_url=payload.image_url,
        created_at=now,
        updated_at=now,
    )
    db.add(p)
    db.flush()

    if payload.stock != 0:
        db.add(
            StockMovement(
                product_id=p.id,
                movement_type="INITIAL",
                quantity_change=payload.stock,
                stock_before=0.0,
                stock_after=payload.stock,
                reference_code="CREATE",
                note="Khởi tạo sản phẩm",
                created_at=now,
            )
        )

    db.commit()
    db.refresh(p)
    return serialize_product(p)


@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên hàng hóa không được để trống")

    now = now_millis()
    old_stock = p.stock

    cat_name = (payload.category_name or "").strip()
    cat_id = None
    if cat_name:
        cat = db.query(Category).filter(func.lower(Category.name) == cat_name.lower()).first()
        if not cat:
            cat = Category(name=cat_name, english_name=cat_name, created_at=now)
            db.add(cat)
            db.flush()
        cat_id = cat.id

    unit_name = (payload.unit or "").strip()
    if unit_name:
        u = db.query(UnitOfMeasure).filter(func.lower(UnitOfMeasure.name) == unit_name.lower()).first()
        if not u:
            db.add(UnitOfMeasure(name=unit_name, english_name=unit_name))
            db.flush()

    p.name = name
    p.english_name = (payload.english_name or "").strip() or None
    p.barcode = (payload.barcode or "").strip() or None
    p.category_id = cat_id
    p.category_name = cat_name
    p.price = max(0, payload.price)
    p.cost = max(0, payload.cost)
    p.unit = unit_name
    p.stock = payload.stock
    p.min_stock_threshold = payload.min_stock_threshold
    p.image_url = payload.image_url
    p.updated_at = now

    if abs(payload.stock - old_stock) > 1e-6:
        db.add(
            StockMovement(
                product_id=p.id,
                movement_type="ADJUSTMENT",
                quantity_change=payload.stock - old_stock,
                stock_before=old_stock,
                stock_after=payload.stock,
                reference_code="EDIT",
                note="Cập nhật tồn kho trực tiếp",
                created_at=now,
            )
        )

    db.commit()
    db.refresh(p)
    return serialize_product(p)


@app.post("/api/products/{product_id}/adjust-stock")
def adjust_product_stock(product_id: int, payload: StockAdjustmentRequest, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    now = now_millis()
    old_stock = p.stock
    new_stock = old_stock + payload.quantity_change
    p.stock = new_stock
    p.updated_at = now
    db.add(
        StockMovement(
            product_id=p.id,
            movement_type=payload.movement_type or "ADJUSTMENT",
            quantity_change=payload.quantity_change,
            stock_before=old_stock,
            stock_after=new_stock,
            reference_code="MANUAL",
            note=payload.note or "Điều chỉnh tồn kho",
            created_at=now,
        )
    )
    db.commit()
    db.refresh(p)
    return serialize_product(p)


@app.get("/api/products/{product_id}/movements")
def get_product_movements(product_id: int, db: Session = Depends(get_db)):
    movements = (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product_id)
        .order_by(StockMovement.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": m.id,
            "product_id": m.product_id,
            "movement_type": m.movement_type,
            "quantity_change": m.quantity_change,
            "stock_before": m.stock_before,
            "stock_after": m.stock_after,
            "reference_code": m.reference_code,
            "note": m.note,
            "created_at": m.created_at,
        }
        for m in movements
    ]


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    used_count = db.query(func.count(InvoiceItem.id)).filter(InvoiceItem.product_id == product_id).scalar() or 0
    if used_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Không thể xóa sản phẩm này vì đang được sử dụng trong các hóa đơn hiện có.",
        )

    db.delete(p)
    db.commit()
    return {"status": "deleted", "id": product_id}


# ---------------------------------------------------------------------------
# CUSTOMERS
# ---------------------------------------------------------------------------
@app.get("/api/customers")
def list_customers(q: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Customer)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
                Customer.address.ilike(term),
            )
        )
    customers = query.order_by(Customer.name.asc()).all()
    return [serialize_customer(c, db) for c in customers]


@app.post("/api/customers")
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    phone = payload.phone.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên khách hàng không được để trống")
    if not phone:
        raise HTTPException(status_code=400, detail="Số điện thoại không được để trống")

    existing = db.query(Customer).filter(Customer.phone == phone).first()
    if existing:
        raise HTTPException(status_code=409, detail="Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.")

    now = now_millis()
    c = Customer(
        name=name,
        phone=phone,
        address=(payload.address or "").strip(),
        note=(payload.note or "").strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize_customer(c, db)


@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    name = payload.name.strip()
    phone = payload.phone.strip()
    if not name or not phone:
        raise HTTPException(status_code=400, detail="Vui lòng nhập tên và số điện thoại hợp lệ")

    duplicate = db.query(Customer).filter(Customer.phone == phone, Customer.id != customer_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Số điện thoại đã tồn tại ở khách hàng khác.")

    c.name = name
    c.phone = phone
    c.address = (payload.address or "").strip()
    c.note = (payload.note or "").strip()
    c.updated_at = now_millis()
    db.commit()
    db.refresh(c)
    return serialize_customer(c, db)


@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    db.delete(c)
    db.commit()
    return {"status": "deleted", "id": customer_id}


# ---------------------------------------------------------------------------
# INVOICES & POS CHECKOUT
# ---------------------------------------------------------------------------
@app.get("/api/invoices")
def list_invoices(
    q: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).outerjoin(Customer, Customer.id == Invoice.customer_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Invoice.code.ilike(term),
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
            )
        )
    if payment_method and payment_method.strip():
        query = query.filter(Invoice.payment_method == payment_method.strip())
    if customer_id is not None:
        query = query.filter(Invoice.customer_id == customer_id)

    invoices = query.order_by(Invoice.date.desc(), Invoice.id.desc()).all()
    return [serialize_invoice_summary(inv) for inv in invoices]


@app.get("/api/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    summary = serialize_invoice_summary(inv)
    items_detail = []
    for it in inv.items:
        p_name = (it.product.name if it.product else None) or it.product_name_snapshot or "Sản phẩm chưa đặt tên"
        p_en = it.product.english_name if it.product else None
        p_unit = (it.product.unit if it.product else None) or it.unit_snapshot or ""
        items_detail.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_name": p_name,
            "english_name": p_en,
            "unit": p_unit,
            "quantity": it.quantity,
            "price": it.price,
            "cost": it.cost,
            "sub_total": it.sub_total,
        })
    summary["items"] = items_detail
    return summary


@app.post("/api/checkout")
def process_checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Giỏ hàng đang trống")

    now = now_millis()
    subtotal = 0
    total_cost = 0
    prepared_items = []

    for item_in in payload.items:
        prod = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Sản phẩm ID {item_in.product_id} không tồn tại")

        unit_price = item_in.price if item_in.price is not None else int(prod.price)
        sub = int(round(unit_price * item_in.quantity))
        c_sub = int(round(int(prod.cost) * item_in.quantity))
        subtotal += sub
        total_cost += c_sub
        prepared_items.append((prod, item_in.quantity, unit_price, int(prod.cost), sub))

    discount = max(0, int(payload.discount_amount or 0))
    payable_amount = max(0, subtotal - discount)

    # Resolve customer
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()

    max_id = db.query(func.max(Invoice.id)).scalar() or 0
    next_id = max_id + 1
    invoice_code = f"HD{next_id}"

    # Ensure unique invoice code
    while db.query(Invoice).filter(Invoice.code == invoice_code).first() is not None:
        next_id += 1
        invoice_code = f"HD{next_id}"

    invoice = Invoice(
        code=invoice_code,
        date=now,
        subtotal_amount=subtotal,
        discount_amount=discount,
        total_amount=payable_amount,
        total_cost=total_cost,
        payment_method=payload.payment_method or "cash",
        note=payload.payment_method or "cash",
        customer_id=customer.id if customer else None,
    )
    db.add(invoice)
    db.flush()

    # Sync code with actual ID if matched
    expected_code = f"HD{invoice.id}"
    if invoice.code != expected_code and not db.query(Invoice).filter(Invoice.code == expected_code).first():
        invoice.code = expected_code

    for prod, qty, unit_price, unit_cost, sub in prepared_items:
        db.add(
            InvoiceItem(
                invoice_id=invoice.id,
                product_id=prod.id,
                product_name_snapshot=prod.name,
                unit_snapshot=prod.unit or "",
                quantity=float(qty),
                price=unit_price,
                cost=unit_cost,
                sub_total=sub,
            )
        )
        old_stock = prod.stock
        prod.stock = round(old_stock - float(qty), 4)
        prod.updated_at = now
        db.add(
            StockMovement(
                product_id=prod.id,
                movement_type="SALE",
                quantity_change=-float(qty),
                stock_before=old_stock,
                stock_after=prod.stock,
                reference_code=invoice.code,
                note=f"Bán hàng theo hóa đơn {invoice.code}",
                created_at=now,
            )
        )

    # If payment method is debt ('debt'), automatically create DebtRecord
    if payload.payment_method == "debt" and payable_amount > 0:
        debt_cust_name = (
            customer.name
            if customer
            else ((payload.customer_name or "").strip() or "Khách lẻ")
        )
        debt_cust_phone = (
            customer.phone
            if customer
            else ((payload.customer_phone or "").strip() or None)
        )
        db.add(
            DebtRecord(
                invoice_id=invoice.id,
                customer_id=customer.id if customer else None,
                customer_name=debt_cust_name,
                customer_phone=debt_cust_phone,
                amount=payable_amount,
                paid_amount=0,
                note=f"Ghi nợ hóa đơn {invoice.code}",
                created_at=now,
                is_settled=False,
            )
        )

    # Delete draft if this checkout came from a loaded draft
    if payload.draft_id:
        draft = db.query(InvoiceDraft).filter(InvoiceDraft.id == payload.draft_id).first()
        if draft:
            db.delete(draft)

    db.commit()
    db.refresh(invoice)
    return get_invoice_detail(invoice.id, db)


# ---------------------------------------------------------------------------
# INVOICE DRAFTS
# ---------------------------------------------------------------------------
@app.get("/api/drafts")
def list_drafts(db: Session = Depends(get_db)):
    drafts = db.query(InvoiceDraft).order_by(InvoiceDraft.updated_at.desc()).all()
    return [
        {
            "id": d.id,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "total_amount": d.total_amount,
            "total_items": d.total_items,
            "items_json": d.items_json,
            "customer_id": d.customer_id,
            "customer_name": d.customer_name,
            "note": d.note or "",
        }
        for d in drafts
    ]


@app.post("/api/drafts")
def create_draft(payload: DraftCreate, db: Session = Depends(get_db)):
    now = now_millis()
    d = InvoiceDraft(
        created_at=now,
        updated_at=now,
        total_amount=payload.total_amount,
        total_items=payload.total_items,
        items_json=payload.items_json,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        note=payload.note or "",
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return {
        "id": d.id,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "total_amount": d.total_amount,
        "total_items": d.total_items,
        "items_json": d.items_json,
        "customer_id": d.customer_id,
        "customer_name": d.customer_name,
        "note": d.note or "",
    }


@app.delete("/api/drafts/{draft_id}")
def delete_draft(draft_id: int, db: Session = Depends(get_db)):
    d = db.query(InvoiceDraft).filter(InvoiceDraft.id == draft_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản nháp")
    db.delete(d)
    db.commit()
    return {"status": "deleted", "id": draft_id}


# ---------------------------------------------------------------------------
# DEBT BOOK (SỔ NỢ)
# ---------------------------------------------------------------------------
@app.get("/api/debts")
def list_debts(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="all | pending | settled"),
    db: Session = Depends(get_db),
):
    query = db.query(DebtRecord)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                DebtRecord.customer_name.ilike(term),
                DebtRecord.customer_phone.ilike(term),
                DebtRecord.note.ilike(term),
            )
        )
    if status == "pending":
        query = query.filter(DebtRecord.is_settled == False)
    elif status == "settled":
        query = query.filter(DebtRecord.is_settled == True)

    records = query.order_by(DebtRecord.is_settled.asc(), DebtRecord.created_at.desc()).all()
    return [serialize_debt(r) for r in records]


@app.post("/api/debts")
def create_debt(payload: DebtCreate, db: Session = Depends(get_db)):
    c_name = payload.customer_name.strip()
    if not c_name or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Vui lòng nhập tên khách hàng và số tiền hợp lệ.")

    now = now_millis()
    cust = None
    if payload.customer_id:
        cust = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    elif payload.customer_phone:
        cust = db.query(Customer).filter(Customer.phone == payload.customer_phone.strip()).first()

    d = DebtRecord(
        customer_id=cust.id if cust else None,
        customer_name=c_name,
        customer_phone=(payload.customer_phone or "").strip() or (cust.phone if cust else None),
        amount=payload.amount,
        paid_amount=0,
        note=(payload.note or "").strip(),
        created_at=now,
        due_date=payload.due_date,
        is_settled=False,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return serialize_debt(d)


@app.put("/api/debts/{debt_id}")
def update_debt(debt_id: int, payload: DebtUpdate, db: Session = Depends(get_db)):
    d = db.query(DebtRecord).filter(DebtRecord.id == debt_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản ghi nợ")

    c_name = payload.customer_name.strip()
    if not c_name or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Vui lòng nhập tên khách hàng và số tiền hợp lệ.")

    d.customer_id = payload.customer_id
    d.customer_name = c_name
    d.customer_phone = (payload.customer_phone or "").strip() or None
    d.amount = payload.amount
    d.note = (payload.note or "").strip()
    d.due_date = payload.due_date

    if payload.is_settled is not None:
        d.is_settled = payload.is_settled
        if payload.is_settled:
            d.paid_amount = d.amount
            d.settled_at = d.settled_at or now_millis()
        else:
            d.paid_amount = 0
            d.settled_at = None

    db.commit()
    db.refresh(d)
    return serialize_debt(d)


@app.post("/api/debts/{debt_id}/toggle-settle")
def toggle_settle_debt(debt_id: int, db: Session = Depends(get_db)):
    d = db.query(DebtRecord).filter(DebtRecord.id == debt_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản ghi nợ")

    now = now_millis()
    d.is_settled = not d.is_settled
    if d.is_settled:
        rem = max(0, int(d.amount) - int(d.paid_amount or 0))
        if rem > 0:
            db.add(
                DebtPayment(
                    debt_id=d.id,
                    amount=rem,
                    payment_method="cash",
                    note="Tất toán toàn bộ khoản nợ",
                    paid_at=now,
                )
            )
        d.paid_amount = d.amount
        d.settled_at = now
    else:
        d.paid_amount = 0
        d.settled_at = None

    db.commit()
    db.refresh(d)
    return serialize_debt(d)


@app.post("/api/debts/{debt_id}/pay")
def record_partial_debt_payment(debt_id: int, payload: DebtPaymentCreate, db: Session = Depends(get_db)):
    d = db.query(DebtRecord).filter(DebtRecord.id == debt_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản ghi nợ")
    if d.is_settled:
        raise HTTPException(status_code=400, detail="Khoản nợ này đã được tất toán")

    now = now_millis()
    payment = DebtPayment(
        debt_id=d.id,
        amount=payload.amount,
        payment_method=payload.payment_method or "cash",
        note=(payload.note or "").strip() or "Thanh toán nợ một phần",
        paid_at=now,
    )
    db.add(payment)
    d.paid_amount = int(d.paid_amount or 0) + int(payload.amount)
    if d.paid_amount >= d.amount:
        d.paid_amount = d.amount
        d.is_settled = True
        d.settled_at = now

    db.commit()
    db.refresh(d)
    return serialize_debt(d)


@app.post("/api/debts/settle-customer")
def settle_all_customer_debts(
    customer_id: Optional[int] = Query(None),
    customer_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(DebtRecord).filter(DebtRecord.is_settled == False)
    if customer_id is not None:
        query = query.filter(DebtRecord.customer_id == customer_id)
    elif customer_name:
        query = query.filter(DebtRecord.customer_name == customer_name)
    else:
        raise HTTPException(status_code=400, detail="Thiếu thông tin khách hàng")

    now = now_millis()
    records = query.all()
    for d in records:
        rem = max(0, int(d.amount) - int(d.paid_amount or 0))
        if rem > 0:
            db.add(
                DebtPayment(
                    debt_id=d.id,
                    amount=rem,
                    payment_method="cash",
                    note="Tất toán công nợ khách hàng",
                    paid_at=now,
                )
            )
        d.paid_amount = d.amount
        d.is_settled = True
        d.settled_at = now

    db.commit()
    return {"settled_count": len(records)}


@app.delete("/api/debts/{debt_id}")
def delete_debt(debt_id: int, db: Session = Depends(get_db)):
    d = db.query(DebtRecord).filter(DebtRecord.id == debt_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản ghi nợ")
    db.delete(d)
    db.commit()
    return {"status": "deleted", "id": debt_id}


# ---------------------------------------------------------------------------
# BANK ACCOUNTS & VIETQR
# ---------------------------------------------------------------------------
@app.get("/api/banks/directory")
def get_vn_banks_directory():
    return POPULAR_VN_BANKS


@app.get("/api/bank-accounts")
def list_bank_accounts(db: Session = Depends(get_db)):
    accounts = (
        db.query(BankAccount)
        .order_by(BankAccount.is_active.desc(), BankAccount.bank_name.asc())
        .all()
    )
    return [
        {
            "id": a.id,
            "bank_code": a.bank_code,
            "bank_name": a.bank_name,
            "account_number": a.account_number,
            "account_name": a.account_name,
            "bin_code": a.bin_code,
            "is_active": a.is_active,
        }
        for a in accounts
    ]


@app.post("/api/bank-accounts")
def create_bank_account(payload: BankAccountCreate, db: Session = Depends(get_db)):
    acc_num = payload.account_number.strip()
    if not acc_num or not payload.account_name.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập số tài khoản và chủ tài khoản")

    existing = db.query(BankAccount).filter(BankAccount.account_number == acc_num).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tài khoản này đã tồn tại.")

    acc = BankAccount(
        bank_code=payload.bank_code.strip().upper(),
        bank_name=payload.bank_name.strip(),
        account_number=acc_num,
        account_name=payload.account_name.strip().upper(),
        bin_code=payload.bin_code.strip(),
        is_active=payload.is_active,
        created_at=now_millis(),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return {
        "id": acc.id,
        "bank_code": acc.bank_code,
        "bank_name": acc.bank_name,
        "account_number": acc.account_number,
        "account_name": acc.account_name,
        "bin_code": acc.bin_code,
        "is_active": acc.is_active,
    }


@app.put("/api/bank-accounts/{account_id}")
def update_bank_account(account_id: int, payload: BankAccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngân hàng")

    acc_num = payload.account_number.strip()
    dup = db.query(BankAccount).filter(BankAccount.account_number == acc_num, BankAccount.id != account_id).first()
    if dup:
        raise HTTPException(status_code=409, detail="Số tài khoản đã tồn tại.")

    acc.bank_code = payload.bank_code.strip().upper()
    acc.bank_name = payload.bank_name.strip()
    acc.account_number = acc_num
    acc.account_name = payload.account_name.strip().upper()
    acc.bin_code = payload.bin_code.strip()
    acc.is_active = payload.is_active
    db.commit()
    db.refresh(acc)
    return {
        "id": acc.id,
        "bank_code": acc.bank_code,
        "bank_name": acc.bank_name,
        "account_number": acc.account_number,
        "account_name": acc.account_name,
        "bin_code": acc.bin_code,
        "is_active": acc.is_active,
    }


@app.delete("/api/bank-accounts/{account_id}")
def delete_bank_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngân hàng")
    db.delete(acc)
    db.commit()
    return {"status": "deleted", "id": account_id}


@app.get("/api/vietqr")
def generate_vietqr(
    amount: int = Query(0),
    description: Optional[str] = Query(None),
    account_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    acc = None
    if account_id:
        acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        acc = db.query(BankAccount).filter(BankAccount.is_active == True).first()
    if not acc:
        acc = db.query(BankAccount).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Chưa có tài khoản ngân hàng.")

    payload = build_vietqr_payload(
        bin_code=acc.bin_code,
        bank_code=acc.bank_code,
        bank_name=acc.bank_name,
        account_number=acc.account_number,
        account_name=acc.account_name,
        amount=amount,
        description=description,
    )
    if not payload:
        raise HTTPException(status_code=400, detail="Không tạo được VietQR cho ngân hàng này.")

    # Quicklink image URL from official VietQR.io as well as raw EMVCo QR payload
    clean_desc = (description or "Thanh toan TAHOTO").strip()
    vietqr_img_url = (
        f"https://img.vietqr.io/image/{acc.bin_code}-{acc.account_number}-compact2.png"
        f"?amount={amount}&addInfo={clean_desc}&accountName={acc.account_name}"
    )

    return {
        "account": {
            "id": acc.id,
            "bank_code": acc.bank_code,
            "bank_name": acc.bank_name,
            "account_number": acc.account_number,
            "account_name": acc.account_name,
            "bin_code": acc.bin_code,
        },
        "amount": amount,
        "description": description or "",
        "emv_payload": payload,
        "vietqr_image_url": vietqr_img_url,
    }


# ---------------------------------------------------------------------------
# EXCEL EXPORT / IMPORT & DATABASE BACKUP
# ---------------------------------------------------------------------------
@app.get("/api/reports/export-excel")
def download_excel_report(db: Session = Depends(get_db)):
    stream = export_full_excel_report(db)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"TAHOTO_Report_{timestamp}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/reports/import-excel")
async def upload_excel_report(
    file: UploadFile = File(...),
    conflict_mode: str = Query("update", description="update | skip"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File tải lên trống")
    try:
        stats = import_excel_workbook(db, content, conflict_mode=conflict_mode)
        return {"status": "success", "stats": stats}
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file: {str(exc)}",
        )


@app.get("/api/backup/download-db")
def download_sqlite_backup():
    db_file = os.path.join(DATA_DIR, "tahoto_enterprise.db")
    if not os.path.exists(db_file):
        raise HTTPException(status_code=404, detail="Không tìm thấy file cơ sở dữ liệu")
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        db_file,
        media_type="application/octet-stream",
        filename=f"tahoto_backup_{timestamp}.db",
    )


# ---------------------------------------------------------------------------
# AUTHENTICATION & USER PERMISSIONS (RBAC: QUẢN LÝ, TỔ TRƯỞNG, THU NGÂN)
# ---------------------------------------------------------------------------
def serialize_user(u: AppUser) -> dict:
    try:
        perms = json.loads(u.permissions_json or "{}")
    except Exception:
        perms = DEFAULT_PERMISSIONS_BY_ROLE.get(u.role, DEFAULT_PERMISSIONS_BY_ROLE["cashier"])
    if u.role == "manager":
        perms = DEFAULT_PERMISSIONS_BY_ROLE["manager"]
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role,
        "permissions": perms,
        "is_active": u.is_active,
        "created_at": u.created_at,
    }


@app.post("/api/auth/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    uname = (payload.username or "").strip().lower()
    pwd = payload.password or ""
    if not uname or not pwd:
        raise HTTPException(status_code=400, detail="Vui lòng nhập tên đăng nhập và mật khẩu")

    user = db.query(AppUser).filter(func.lower(AppUser.username) == uname).first()
    if not user:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản này đang bị tạm khóa")

    hashed = hash_password(pwd)
    if user.password_hash != hashed and user.password_hash != pwd:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác")

    return serialize_user(user)


@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(AppUser).order_by(AppUser.id.asc()).all()
    return [serialize_user(u) for u in users]


@app.post("/api/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    uname = (payload.username or "").strip().lower()
    fname = (payload.full_name or "").strip()
    pwd = payload.password or ""
    role = (payload.role or "cashier").strip()
    if role not in ("manager", "leader", "cashier"):
        role = "cashier"

    if not uname or not fname or not pwd:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đầy đủ tên đăng nhập, mật khẩu và họ tên")

    existing = db.query(AppUser).filter(func.lower(AppUser.username) == uname).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tên đăng nhập đã tồn tại")

    perms_str = payload.permissions_json
    if not perms_str:
        perms_str = json.dumps(DEFAULT_PERMISSIONS_BY_ROLE.get(role, DEFAULT_PERMISSIONS_BY_ROLE["cashier"]))

    u = AppUser(
        username=uname,
        password_hash=hash_password(pwd),
        full_name=fname,
        role=role,
        permissions_json=perms_str,
        is_active=payload.is_active,
        created_at=now_millis(),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return serialize_user(u)


@app.put("/api/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    u = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if payload.username is not None and payload.username.strip():
        new_uname = payload.username.strip().lower()
        if new_uname != u.username.lower():
            dup = db.query(AppUser).filter(func.lower(AppUser.username) == new_uname, AppUser.id != user_id).first()
            if dup:
                raise HTTPException(status_code=409, detail="Tên đăng nhập đã tồn tại")
            u.username = new_uname
    if payload.full_name is not None and payload.full_name.strip():
        u.full_name = payload.full_name.strip()
    if payload.role is not None and payload.role in ("manager", "leader", "cashier"):
        u.role = payload.role
    if payload.password is not None and payload.password.strip():
        u.password_hash = hash_password(payload.password.strip())
    if payload.permissions_json is not None:
        u.permissions_json = payload.permissions_json
    if payload.is_active is not None:
        u.is_active = payload.is_active

    db.commit()
    db.refresh(u)
    return serialize_user(u)


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if u.role == "manager":
        mgr_count = db.query(func.count(AppUser.id)).filter(AppUser.role == "manager").scalar() or 0
        if mgr_count <= 1:
            raise HTTPException(status_code=400, detail="Không thể xóa tài khoản Quản lý duy nhất của hệ thống")
    db.delete(u)
    db.commit()
    return {"status": "deleted", "id": user_id}


# ---------------------------------------------------------------------------
# STATIC FRONTEND SERVING
# ---------------------------------------------------------------------------
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
