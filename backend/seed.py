"""Database initialization and initial realistic seed data for Tạp Hóa Tổng Hợp Thọ Hòa (TAHOTO)."""
from sqlalchemy.orm import Session
from .models import (
    Category,
    UnitOfMeasure,
    Product,
    Customer,
    BankAccount,
    Invoice,
    InvoiceItem,
    DebtRecord,
    StockMovement,
    now_millis,
)

DEFAULT_CATEGORIES = [
    ("Bia, nước giải khát", "Beer and soft drinks"),
    ("Sữa các loại", "Milk products"),
    ("Dầu ăn, nước chấm, gia vị", "Cooking oil, sauces, spices"),
    ("Mì, miến, cháo, phở", "Noodles, vermicelli, porridge"),
    ("Bánh kẹo các loại", "Snacks and candies"),
    ("Chăm sóc cá nhân", "Personal care"),
    ("Thuốc lá", "Tobacco"),
    ("Vàng mã", "Joss paper"),
    ("Vệ sinh nhà cửa", "Home cleaning"),
]

DEFAULT_UNITS = [
    ("Cái", "Piece"),
    ("Gói", "Pack"),
    ("Chai", "Bottle"),
    ("Hộp", "Box"),
    ("Bộ", "Set"),
    ("Thùng", "Carton"),
    ("Lon", "Can"),
    ("Kg", "Kg"),
    ("Lốc", "Six-pack"),
]


def seed_initial_data(db: Session):
    now = now_millis()

    # 1. Seed Categories
    if db.query(Category).count() == 0:
        for vi_name, en_name in DEFAULT_CATEGORIES:
            db.add(Category(name=vi_name, english_name=en_name, created_at=now))
        db.flush()

    # 2. Seed Units
    if db.query(UnitOfMeasure).count() == 0:
        for vi_unit, en_unit in DEFAULT_UNITS:
            db.add(UnitOfMeasure(name=vi_unit, english_name=en_unit))
        db.flush()

    # 3. Seed Default Bank Account (from Android app)
    if db.query(BankAccount).count() == 0:
        db.add(
            BankAccount(
                bank_code="VTB",
                bank_name="Ngân hàng TMCP Công thương Việt Nam (VietinBank)",
                account_number="0856467178",
                account_name="DINH THI MY HOA",
                bin_code="970415",
                is_active=True,
                created_at=now,
            )
        )
        db.flush()

    # 4. Seed Sample Customers
    if db.query(Customer).count() == 0:
        customers_data = [
            ("Nguyễn Văn An", "0901112233", "Mai Hạ - Trường Phú - Lệ Thủy - Quảng Trị"),
            ("Trần Thị Bình", "0902223344", "Trường Phú - Lệ Thủy - Quảng Trị"),
            ("Lê Quốc Cường", "0903334455", "Ngã tư Mai Hạ - Quảng Trị"),
            ("Phạm Minh Đức", "0914556677", "Xóm 3 - Mai Hạ - Quảng Trị"),
        ]
        for name, phone, addr in customers_data:
            db.add(Customer(name=name, phone=phone, address=addr, created_at=now, updated_at=now))
        db.flush()

    # 5. Seed Sample Products if empty
    if db.query(Product).count() == 0:
        cats = {c.name: c.id for c in db.query(Category).all()}
        sample_products = [
            ("Thùng Bia Huda 24 lon", "Huda Beer 24 cans", "8935012413332", "Bia, nước giải khát", 275000, 252000, "Thùng", 45.0),
            ("Nước tăng lực RedBull 250ml", "RedBull Energy Drink 250ml", "8934588012112", "Bia, nước giải khát", 12000, 9500, "Lon", 120.0),
            ("Lốc Sữa tươi tiệt trùng Vinamilk 180ml", "Vinamilk Fresh Milk 4x180ml", "8934673100120", "Sữa các loại", 32000, 27500, "Lốc", 38.0),
            ("Sữa đặc Ông Thọ Đỏ 380g", "Ong Tho Condensed Milk 380g", "8934673201117", "Sữa các loại", 25000, 21000, "Hộp", 50.0),
            ("Dầu ăn Neptune Light 1 Lít", "Neptune Light Cooking Oil 1L", "8934707015116", "Dầu ăn, nước chấm, gia vị", 58000, 49000, "Chai", 28.0),
            ("Nước mắm Nam Ngư 750ml", "Nam Ngu Fish Sauce 750ml", "8936017360117", "Dầu ăn, nước chấm, gia vị", 42000, 35000, "Chai", 32.0),
            ("Thùng Mì Hảo Hảo Tôm Chua Cay 30 gói", "Hao Hao Instant Noodles 30 packs", "8934563138165", "Mì, miến, cháo, phở", 118000, 106000, "Thùng", 25.0),
            ("Mì Hảo Hảo Tôm Chua Cay 75g", "Hao Hao Shrimp Sour Spicy 75g", "8934563138158", "Mì, miến, cháo, phở", 4500, 3600, "Gói", 200.0),
            ("Thuốc lá 555 State Express", "Cigarette 555", "8935555555555", "Thuốc lá", 45000, 37000, "Gói", 85.0),
            ("Cà phê G7 3in1 Trung Nguyên (Hộp 21 gói)", "G7 Instant Coffee 3in1", "8935024112217", "Bánh kẹo các loại", 62000, 52000, "Hộp", 4.0),  # Low stock!
            ("Nước rửa chén Sunlight Chanh 750g", "Sunlight Dishwashing Liquid 750g", "8934868121138", "Vệ sinh nhà cửa", 29000, 23500, "Chai", 3.0),  # Low stock!
            ("Dầu gội Clear Bạc Hà 630g", "Clear Menthol Shampoo 630g", "8934868134527", "Chăm sóc cá nhân", 165000, 142000, "Chai", 14.0),
        ]

        created_prods = []
        for name, en_name, barcode, cat_name, price, cost, unit, stock in sample_products:
            p = Product(
                name=name,
                english_name=en_name,
                barcode=barcode,
                category_id=cats.get(cat_name),
                category_name=cat_name,
                price=price,
                cost=cost,
                unit=unit,
                stock=stock,
                min_stock_threshold=5.0,
                created_at=now,
                updated_at=now,
            )
            db.add(p)
            db.flush()
            db.add(
                StockMovement(
                    product_id=p.id,
                    movement_type="INITIAL",
                    quantity_change=stock,
                    stock_before=0.0,
                    stock_after=stock,
                    reference_code="SEED",
                    note="Tồn kho đầu kỳ",
                    created_at=now,
                )
            )
            created_prods.append(p)

        # 6. Seed realistic sample invoices across the last 7 days so Overview Charts are rich immediately
        if db.query(Invoice).count() == 0 and created_prods:
            customers = db.query(Customer).all()
            day_ms = 24 * 3600 * 1000
            sample_orders = [
                # (days_ago, cust_idx, payment_method, items: list of (prod_idx, qty), discount)
                (5, 0, "cash", [(0, 2), (4, 1), (5, 1)], 0),
                (4, 1, "bank_transfer", [(2, 3), (3, 2), (6, 1)], 0),
                (3, 2, "debt", [(0, 3), (8, 5)], 0),
                (2, None, "cash", [(1, 10), (7, 20), (9, 2)], 5000),
                (1, 0, "bank_transfer", [(11, 1), (4, 2), (10, 2)], 0),
                (0, 3, "cash", [(0, 1), (6, 2), (8, 2)], 0),
                (0, 1, "debt", [(4, 3), (5, 3), (9, 2)], 0),
            ]
            for idx, (days_ago, cust_idx, method, item_specs, discount) in enumerate(sample_orders, start=1):
                inv_time = now - (days_ago * day_ms) - (3600 * 1000 * (idx % 5))
                cust = customers[cust_idx] if cust_idx is not None and cust_idx < len(customers) else None
                subtotal = 0
                total_cost = 0
                inv_items = []
                for p_idx, qty in item_specs:
                    prod = created_prods[p_idx]
                    sub = int(round(prod.price * qty))
                    c_sub = int(round(prod.cost * qty))
                    subtotal += sub
                    total_cost += c_sub
                    inv_items.append((prod, qty, sub))

                payable = max(0, subtotal - discount)
                inv = Invoice(
                    code=f"HD{idx}",
                    date=inv_time,
                    subtotal_amount=subtotal,
                    discount_amount=discount,
                    total_amount=payable,
                    total_cost=total_cost,
                    payment_method=method,
                    note=method,
                    customer_id=cust.id if cust else None,
                )
                db.add(inv)
                db.flush()

                for prod, qty, sub in inv_items:
                    db.add(
                        InvoiceItem(
                            invoice_id=inv.id,
                            product_id=prod.id,
                            product_name_snapshot=prod.name,
                            unit_snapshot=prod.unit,
                            quantity=float(qty),
                            price=prod.price,
                            cost=prod.cost,
                            sub_total=sub,
                        )
                    )

                if method == "debt" and payable > 0:
                    db.add(
                        DebtRecord(
                            invoice_id=inv.id,
                            customer_id=cust.id if cust else None,
                            customer_name=cust.name if cust else "Khách lẻ",
                            customer_phone=cust.phone if cust else None,
                            amount=payable,
                            paid_amount=0,
                            note=f"Ghi nợ hóa đơn {inv.code}",
                            created_at=inv_time,
                            is_settled=False,
                        )
                    )

    db.commit()
