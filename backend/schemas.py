from typing import Optional, List
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str
    english_name: Optional[str] = None
    barcode: Optional[str] = None
    category_name: Optional[str] = ""
    price: int = 0
    cost: int = 0
    unit: Optional[str] = ""
    stock: float = 0.0
    min_stock_threshold: float = 5.0
    image_url: Optional[str] = None


class ProductUpdate(ProductCreate):
    pass


class StockAdjustmentRequest(BaseModel):
    quantity_change: float
    movement_type: str = "ADJUSTMENT"
    note: str = ""


class CategoryCreate(BaseModel):
    name: str
    english_name: Optional[str] = None


class UnitCreate(BaseModel):
    name: str
    english_name: Optional[str] = None


class CustomerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ""
    note: Optional[str] = ""


class CustomerUpdate(CustomerCreate):
    pass


class CheckoutItemInput(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    price: Optional[int] = None


class CheckoutRequest(BaseModel):
    items: List[CheckoutItemInput]
    discount_amount: int = 0
    payment_method: str = "cash"  # cash | bank_transfer | debt
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    note: Optional[str] = ""
    draft_id: Optional[int] = None


class DraftCreate(BaseModel):
    items_json: str
    total_amount: int
    total_items: int
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    note: Optional[str] = ""


class DebtCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    amount: int = Field(gt=0)
    note: Optional[str] = ""
    due_date: Optional[int] = None


class DebtUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    amount: int = Field(gt=0)
    note: Optional[str] = ""
    due_date: Optional[int] = None
    is_settled: Optional[bool] = None


class DebtPaymentCreate(BaseModel):
    amount: int = Field(gt=0)
    payment_method: str = "cash"
    note: Optional[str] = ""


class BankAccountCreate(BaseModel):
    bank_code: str
    bank_name: str
    account_number: str
    account_name: str
    bin_code: str
    is_active: bool = True


class BankAccountUpdate(BankAccountCreate):
    pass


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "cashier"
    permissions_json: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions_json: Optional[str] = None
    is_active: Optional[bool] = None

