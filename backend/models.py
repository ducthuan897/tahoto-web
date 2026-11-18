import time
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Float,
    Boolean,
    ForeignKey,
    Index,
    CheckConstraint,
    Text,
)
from sqlalchemy.orm import relationship
from .database import Base


def now_millis() -> int:
    return int(time.time() * 1000)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), unique=True, nullable=False, index=True)
    english_name = Column(String(120), nullable=True)
    description = Column(String(255), nullable=True, default="")
    created_at = Column(BigInteger, nullable=False, default=now_millis)

    products = relationship("Product", back_populates="category_rel")


class UnitOfMeasure(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(60), unique=True, nullable=False, index=True)
    english_name = Column(String(60), nullable=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    english_name = Column(String(255), nullable=True)
    barcode = Column(String(100), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    category_name = Column(String(120), nullable=False, default="")
    price = Column(BigInteger, nullable=False, default=0)
    cost = Column(BigInteger, nullable=False, default=0)
    unit = Column(String(60), nullable=False, default="")
    stock = Column(Float, nullable=False, default=0.0)
    min_stock_threshold = Column(Float, nullable=False, default=5.0)
    image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(BigInteger, nullable=False, default=now_millis)
    updated_at = Column(BigInteger, nullable=False, default=now_millis, onupdate=now_millis)

    category_rel = relationship("Category", back_populates="products")
    invoice_items = relationship("InvoiceItem", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("price >= 0", name="check_product_price_non_negative"),
        CheckConstraint("cost >= 0", name="check_product_cost_non_negative"),
    )


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    phone = Column(String(50), unique=True, nullable=False, index=True)
    address = Column(String(350), nullable=False, default="")
    note = Column(String(500), nullable=False, default="")
    created_at = Column(BigInteger, nullable=False, default=now_millis)
    updated_at = Column(BigInteger, nullable=False, default=now_millis, onupdate=now_millis)

    invoices = relationship("Invoice", back_populates="customer")
    debt_records = relationship("DebtRecord", back_populates="customer")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    date = Column(BigInteger, nullable=False, default=now_millis, index=True)
    subtotal_amount = Column(BigInteger, nullable=False, default=0)
    discount_amount = Column(BigInteger, nullable=False, default=0)
    total_amount = Column(BigInteger, nullable=False, default=0)
    total_cost = Column(BigInteger, nullable=False, default=0)
    payment_method = Column(String(50), nullable=False, default="cash", index=True)
    note = Column(String(500), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

    customer = relationship("Customer", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    debt_records = relationship("DebtRecord", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_name_snapshot = Column(String(255), nullable=False, default="")
    unit_snapshot = Column(String(60), nullable=False, default="")
    quantity = Column(Float, nullable=False, default=1.0)
    price = Column(BigInteger, nullable=False, default=0)
    cost = Column(BigInteger, nullable=False, default=0)
    sub_total = Column(BigInteger, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")


class StockMovement(Base):
    """Professional inventory ledger tracking every stock change (Sale, Import, Manual Edit, Restock)."""
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String(50), nullable=False, index=True)  # SALE, IMPORT, ADJUSTMENT, INITIAL
    quantity_change = Column(Float, nullable=False)
    stock_before = Column(Float, nullable=False)
    stock_after = Column(Float, nullable=False)
    reference_code = Column(String(100), nullable=True)  # e.g., HD12 or Excel Import
    note = Column(String(255), nullable=False, default="")
    created_at = Column(BigInteger, nullable=False, default=now_millis, index=True)

    product = relationship("Product", back_populates="stock_movements")


class DebtRecord(Base):
    __tablename__ = "debt_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name = Column(String(200), nullable=False, index=True)
    customer_phone = Column(String(50), nullable=True, index=True)
    amount = Column(BigInteger, nullable=False)
    paid_amount = Column(BigInteger, nullable=False, default=0)
    note = Column(String(500), nullable=False, default="")
    created_at = Column(BigInteger, nullable=False, default=now_millis, index=True)
    due_date = Column(BigInteger, nullable=True)
    is_settled = Column(Boolean, nullable=False, default=False, index=True)
    settled_at = Column(BigInteger, nullable=True)

    invoice = relationship("Invoice", back_populates="debt_records")
    customer = relationship("Customer", back_populates="debt_records")
    payments = relationship("DebtPayment", back_populates="debt_record", cascade="all, delete-orphan")


class DebtPayment(Base):
    """Tracks partial or full debt settlements over time."""
    __tablename__ = "debt_payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    debt_id = Column(Integer, ForeignKey("debt_records.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    payment_method = Column(String(50), nullable=False, default="cash")
    note = Column(String(255), nullable=False, default="")
    paid_at = Column(BigInteger, nullable=False, default=now_millis)

    debt_record = relationship("DebtRecord", back_populates="payments")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_code = Column(String(50), nullable=False)
    bank_name = Column(String(255), nullable=False)
    account_number = Column(String(100), unique=True, nullable=False, index=True)
    account_name = Column(String(200), nullable=False)
    bin_code = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(BigInteger, nullable=False, default=now_millis)


class InvoiceDraft(Base):
    __tablename__ = "invoice_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(BigInteger, nullable=False, default=now_millis)
    updated_at = Column(BigInteger, nullable=False, default=now_millis, index=True)
    total_amount = Column(BigInteger, nullable=False, default=0)
    total_items = Column(Integer, nullable=False, default=0)
    items_json = Column(Text, nullable=False)
    customer_id = Column(Integer, nullable=True)
    customer_name = Column(String(200), nullable=True)
    note = Column(String(255), nullable=True, default="")


class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False, default="cashier", index=True)  # manager | leader | cashier
    permissions_json = Column(Text, nullable=False, default="{}")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(BigInteger, nullable=False, default=now_millis)

