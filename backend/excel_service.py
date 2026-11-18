"""Excel Report Exporter & Importer compatible with TAHOTO Android format and enhanced for Web."""
import io
import time
import datetime
import re
from typing import Dict, Any, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import (
    Product,
    Customer,
    Invoice,
    InvoiceItem,
    DebtRecord,
    StockMovement,
    now_millis,
)


def format_dt(millis: Optional[int]) -> str:
    if not millis:
        return "-"
    dt = datetime.datetime.fromtimestamp(millis / 1000.0)
    return dt.strftime("%d/%m/%Y %H:%M")


def parse_dt_millis(text: Optional[str]) -> Optional[int]:
    if not text or text.strip() in ("-", ""):
        return None
    val = text.strip()
    for fmt in ("%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.datetime.strptime(val, fmt)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return None


def payment_method_label(method: Optional[str]) -> str:
    m = (method or "").strip().lower()
    if m in ("cash", "tiền mặt", "tien mat"):
        return "Tiền mặt"
    if m in ("bank_transfer", "chuyển khoản", "chuyen khoan", "bank transfer"):
        return "Chuyển khoản"
    if m in ("debt", "ghi nợ", "ghi no", "credit"):
        return "Ghi nợ"
    return method or "Tiền mặt"


def export_full_excel_report(db: Session) -> io.BytesIO:
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    def setup_headers(ws, headers: List[str], widths: List[int]):
        ws.append(headers)
        for col_idx, width in enumerate(widths, start=1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            col_letter = openpyxl.utils.get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = max(width, 12)
        ws.row_dimensions[1].height = 24

    # 1. Invoices Sheet
    ws_inv = wb.create_sheet("Invoices")
    setup_headers(
        ws_inv,
        [
            "Mã hóa đơn",
            "Ngày",
            "Khách hàng",
            "Số điện thoại",
            "Địa chỉ",
            "Tổng tiền",
            "Tổng vốn",
            "Lợi nhuận",
            "Ghi chú",
            "Số dòng",
            "Sản phẩm nổi bật",
            "Số lượng",
        ],
        [16, 18, 22, 16, 26, 15, 15, 15, 18, 12, 24, 12],
    )

    invoices = db.query(Invoice).order_by(Invoice.date.desc()).all()
    for inv in invoices:
        cust_name = inv.customer.name if inv.customer else "-"
        cust_phone = inv.customer.phone if inv.customer else "-"
        cust_addr = inv.customer.address if inv.customer else "-"
        items = inv.items or []
        top_item = max(items, key=lambda x: x.quantity) if items else None
        top_name = (
            (top_item.product.name if top_item and top_item.product else top_item.product_name_snapshot)
            if top_item
            else "-"
        )
        top_qty = top_item.quantity if top_item else 0.0

        ws_inv.append([
            inv.code,
            format_dt(inv.date),
            cust_name,
            cust_phone,
            cust_addr,
            inv.total_amount,
            inv.total_cost,
            inv.total_amount - inv.total_cost,
            payment_method_label(inv.payment_method or inv.note),
            len(items),
            top_name,
            top_qty,
        ])

    # 2. Inventory Sheet
    ws_prod = wb.create_sheet("Inventory")
    setup_headers(
        ws_prod,
        [
            "Tên sản phẩm",
            "Mã vạch",
            "Đơn vị",
            "Tồn kho",
            "Giá bán",
            "Giá vốn",
            "Nhóm hàng",
            "Ngày tạo",
            "Ngày cập nhật",
        ],
        [26, 18, 12, 12, 15, 15, 22, 18, 18],
    )
    products = db.query(Product).order_by(Product.name.asc()).all()
    for p in products:
        ws_prod.append([
            p.name,
            p.barcode or "-",
            p.unit or "",
            p.stock,
            p.price,
            p.cost,
            p.category_name or "",
            format_dt(p.created_at),
            format_dt(p.updated_at),
        ])

    # 3. Revenue Sheet
    ws_rev = wb.create_sheet("Revenue")
    setup_headers(
        ws_rev,
        ["Ngày", "Số đơn", "Doanh thu", "Tổng vốn", "Lợi nhuận"],
        [16, 12, 16, 16, 16],
    )
    daily_map: Dict[str, Dict[str, int]] = {}
    for inv in invoices:
        day_str = datetime.datetime.fromtimestamp(inv.date / 1000.0).strftime("%Y-%m-%d")
        entry = daily_map.setdefault(day_str, {"orders": 0, "revenue": 0, "cost": 0})
        entry["orders"] += 1
        entry["revenue"] += int(inv.total_amount)
        entry["cost"] += int(inv.total_cost)

    for day_str in sorted(daily_map.keys(), reverse=True):
        d = daily_map[day_str]
        ws_rev.append([
            day_str,
            d["orders"],
            d["revenue"],
            d["cost"],
            d["revenue"] - d["cost"],
        ])

    # 4. Debts Sheet
    ws_debt = wb.create_sheet("Debts")
    setup_headers(
        ws_debt,
        [
            "Khách hàng",
            "Số điện thoại",
            "Số tiền",
            "Ghi chú",
            "Ngày ghi nhận",
            "Hạn thanh toán",
            "Trạng thái",
        ],
        [24, 18, 16, 24, 18, 18, 18],
    )
    debts = db.query(DebtRecord).order_by(DebtRecord.is_settled.asc(), DebtRecord.created_at.desc()).all()
    for debt in debts:
        ws_debt.append([
            debt.customer_name,
            debt.customer_phone or "-",
            debt.amount,
            debt.note or "",
            format_dt(debt.created_at),
            format_dt(debt.due_date) if debt.due_date else "-",
            "Đã tất toán" if debt.is_settled else "Chưa thanh toán",
        ])

    # 5. Customers Sheet
    ws_cust = wb.create_sheet("Customers")
    setup_headers(
        ws_cust,
        ["Tên khách hàng", "Số điện thoại", "Địa chỉ"],
        [26, 18, 34],
    )
    customers = db.query(Customer).order_by(Customer.name.asc()).all()
    for c in customers:
        ws_cust.append([c.name, c.phone, c.address])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    s = str(val).strip()
    return "" if s == "-" else s


def _clean_money(val: Any) -> int:
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return max(0, int(round(val)))
    s = re.sub(r"[^0-9.-]", "", str(val))
    try:
        return max(0, int(round(float(s))))
    except ValueError:
        return 0


def _clean_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def import_excel_workbook(db: Session, file_bytes: bytes, conflict_mode: str = "update") -> Dict[str, int]:
    """
    Imports an Excel file containing either:
    - Multi-sheet TAHOTO Report (Customers, Inventory, Debts)
    - Single-sheet Product list (Tên sản phẩm, Mã vạch, Đơn vị, Tồn kho, Giá bán, Giá vốn, [Nhóm hàng])
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet_names = wb.sheetnames

    stats = {
        "customers_imported": 0,
        "products_added": 0,
        "products_updated": 0,
        "products_skipped": 0,
        "debts_imported": 0,
    }

    now = now_millis()

    # 1. Customers sheet if present
    if "Customers" in sheet_names:
        ws = wb["Customers"]
        for row in list(ws.iter_rows(values_only=True))[1:]:
            if not row or len(row) < 2:
                continue
            name = _clean_str(row[0])
            phone = _clean_str(row[1])
            address = _clean_str(row[2]) if len(row) > 2 else ""
            if not name or not phone:
                continue
            existing = db.query(Customer).filter(Customer.phone == phone).first()
            if existing:
                existing.name = name
                if address:
                    existing.address = address
                existing.updated_at = now
            else:
                db.add(Customer(name=name, phone=phone, address=address, created_at=now, updated_at=now))
            stats["customers_imported"] += 1
        db.flush()

    # 2. Inventory or active first sheet for products
    prod_sheet = None
    if "Inventory" in sheet_names:
        prod_sheet = wb["Inventory"]
    elif len(sheet_names) == 1 and sheet_names[0] not in ("Customers", "Debts", "Invoices", "Revenue"):
        prod_sheet = wb[sheet_names[0]]

    if prod_sheet is not None:
        rows = list(prod_sheet.iter_rows(values_only=True))
        for row in rows[1:]:
            if not row:
                continue
            raw_name = _clean_str(row[0]) if len(row) > 0 else ""
            raw_barcode = _clean_str(row[1]) if len(row) > 1 else ""
            if not raw_name and not raw_barcode:
                continue
            name = raw_name or raw_barcode
            barcode = raw_barcode or None
            unit = _clean_str(row[2]) if len(row) > 2 else ""
            stock = _clean_float(row[3]) if len(row) > 3 else 0.0
            price = _clean_money(row[4]) if len(row) > 4 else 0
            cost = _clean_money(row[5]) if len(row) > 5 else 0
            category_name = ""
            if len(row) > 6:
                cand = _clean_str(row[6])
                # Check if column 6 is a date or category name
                if cand and not re.match(r"^\d{2}/\d{2}/\d{4}", cand):
                    category_name = cand

            existing = None
            if barcode:
                existing = db.query(Product).filter(Product.barcode == barcode).first()
            if not existing:
                existing = db.query(Product).filter(Product.name == name).first()

            if existing:
                if conflict_mode == "skip":
                    stats["products_skipped"] += 1
                    continue
                old_stock = existing.stock
                existing.name = name
                if barcode:
                    existing.barcode = barcode
                if unit:
                    existing.unit = unit
                if category_name:
                    existing.category_name = category_name
                existing.stock = stock
                existing.price = price
                existing.cost = cost
                existing.updated_at = now
                if abs(stock - old_stock) > 1e-6:
                    db.add(
                        StockMovement(
                            product_id=existing.id,
                            movement_type="IMPORT",
                            quantity_change=stock - old_stock,
                            stock_before=old_stock,
                            stock_after=stock,
                            reference_code="EXCEL",
                            note="Cập nhật từ file Excel",
                            created_at=now,
                        )
                    )
                stats["products_updated"] += 1
            else:
                new_prod = Product(
                    name=name,
                    barcode=barcode,
                    unit=unit,
                    category_name=category_name,
                    stock=stock,
                    price=price,
                    cost=cost,
                    created_at=now,
                    updated_at=now,
                )
                db.add(new_prod)
                db.flush()
                if stock != 0:
                    db.add(
                        StockMovement(
                            product_id=new_prod.id,
                            movement_type="IMPORT",
                            quantity_change=stock,
                            stock_before=0.0,
                            stock_after=stock,
                            reference_code="EXCEL",
                            note="Nhập mới từ file Excel",
                            created_at=now,
                        )
                    )
                stats["products_added"] += 1
        db.flush()

    # 3. Debts sheet if present
    if "Debts" in sheet_names:
        ws = wb["Debts"]
        for row in list(ws.iter_rows(values_only=True))[1:]:
            if not row or len(row) < 3:
                continue
            c_name = _clean_str(row[0])
            c_phone = _clean_str(row[1]) or None
            amount = _clean_money(row[2])
            if not c_name or amount <= 0:
                continue
            note = _clean_str(row[3]) if len(row) > 3 else ""
            created_at = parse_dt_millis(_clean_str(row[4])) if len(row) > 4 else now
            created_at = created_at or now
            due_date = parse_dt_millis(_clean_str(row[5])) if len(row) > 5 else None
            status_str = (_clean_str(row[6]) if len(row) > 6 else "").lower()
            is_settled = ("đã" in status_str) or ("settled" in status_str)

            cust = db.query(Customer).filter(Customer.phone == c_phone).first() if c_phone else None
            db.add(
                DebtRecord(
                    customer_id=cust.id if cust else None,
                    customer_name=c_name,
                    customer_phone=c_phone,
                    amount=amount,
                    paid_amount=amount if is_settled else 0,
                    note=note,
                    created_at=created_at,
                    due_date=due_date,
                    is_settled=is_settled,
                    settled_at=(due_date or created_at) if is_settled else None,
                )
            )
            stats["debts_imported"] += 1

    db.commit()
    return stats
