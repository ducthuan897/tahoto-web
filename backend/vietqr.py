"""VietQR EMVCo payload generator and popular Vietnamese banks directory."""
import unicodedata
import re
from typing import Optional, List, Dict

POPULAR_VN_BANKS: List[Dict[str, str]] = [
    {"code": "VTB", "shortName": "VietinBank", "name": "Ngân hàng TMCP Công thương Việt Nam (VietinBank)", "bin": "970415"},
    {"code": "VCB", "shortName": "Vietcombank", "name": "Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)", "bin": "970436"},
    {"code": "BIDV", "shortName": "BIDV", "name": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", "bin": "970418"},
    {"code": "VBA", "shortName": "Agribank", "name": "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)", "bin": "970405"},
    {"code": "MB", "shortName": "MBBank", "name": "Ngân hàng TMCP Quân đội (MBBank)", "bin": "970422"},
    {"code": "TCB", "shortName": "Techcombank", "name": "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)", "bin": "970407"},
    {"code": "ACB", "shortName": "ACB", "name": "Ngân hàng TMCP Á Châu (ACB)", "bin": "970416"},
    {"code": "VPB", "shortName": "VPBank", "name": "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)", "bin": "970432"},
    {"code": "TPB", "shortName": "TPBank", "name": "Ngân hàng TMCP Tiên Phong (TPBank)", "bin": "970423"},
    {"code": "STB", "shortName": "Sacombank", "name": "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)", "bin": "970403"},
    {"code": "HDB", "shortName": "HDBank", "name": "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)", "bin": "970437"},
    {"code": "VIB", "shortName": "VIB", "name": "Ngân hàng TMCP Quốc tế Việt Nam (VIB)", "bin": "970441"},
    {"code": "SHB", "shortName": "SHB", "name": "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)", "bin": "970443"},
    {"code": "EIB", "shortName": "Eximbank", "name": "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)", "bin": "970431"},
    {"code": "MSB", "shortName": "MSB", "name": "Ngân hàng TMCP Hàng Hải Việt Nam (MSB)", "bin": "970426"},
    {"code": "OCB", "shortName": "OCB", "name": "Ngân hàng TMCP Phương Đông (OCB)", "bin": "970448"},
    {"code": "LPB", "shortName": "LPBank", "name": "Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)", "bin": "970449"},
    {"code": "SEAB", "shortName": "SeABank", "name": "Ngân hàng TMCP Đông Nam Á (SeABank)", "bin": "970440"},
]


def remove_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def sanitize_qr_text(text: str) -> str:
    clean = remove_accents(text)
    clean = re.sub(r"[^A-Za-z0-9 ]", "", clean)
    return clean.upper().strip()


def _emv(tag: str, value: Optional[str]) -> str:
    if not value:
        return ""
    length_str = f"{len(value):02d}"
    return f"{tag}{length_str}{value}"


def compute_crc16(payload: str) -> str:
    crc = 0xFFFF
    data = payload.encode("utf-8")
    for b in data:
        crc ^= (b & 0xFF) << 8
        for _ in range(8):
            if (crc & 0x8000) != 0:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def resolve_bank_bin(bin_code: str, bank_code: str, bank_name: str) -> Optional[str]:
    if bin_code and bin_code.strip():
        return bin_code.strip()
    code_upper = (bank_code or "").strip().upper()
    for b in POPULAR_VN_BANKS:
        if b["code"] == code_upper or b["shortName"].upper() == code_upper:
            return b["bin"]
    name_norm = remove_accents(bank_name or "").lower().replace(" ", "")
    for b in POPULAR_VN_BANKS:
        if b["shortName"].lower() in name_norm:
            return b["bin"]
    return None


def build_vietqr_payload(
    bin_code: str,
    bank_code: str,
    bank_name: str,
    account_number: str,
    account_name: str,
    amount: int,
    description: Optional[str] = None,
) -> Optional[str]:
    bank_bin = resolve_bank_bin(bin_code, bank_code, bank_name)
    if not bank_bin:
        return None
    acc_digits = "".join(ch for ch in (account_number or "") if ch.isdigit())
    if not acc_digits or not (account_name or "").strip():
        return None

    desc_val = sanitize_qr_text(description)[:25] if description and description.strip() else None

    account_info = _emv("00", bank_bin) + _emv("01", acc_digits)
    merchant_account_info = (
        _emv("00", "A000000727")
        + _emv("01", account_info)
        + _emv("02", "QRIBFTTA")
    )

    additional_data = _emv("08", desc_val) if desc_val else None
    poi_method = "12" if amount > 0 else "11"

    parts = [
        _emv("00", "01"),
        _emv("01", poi_method),
        _emv("38", merchant_account_info),
        _emv("53", "704"),
    ]
    if amount > 0:
        parts.append(_emv("54", str(int(amount))))
    parts.append(_emv("58", "VN"))
    if additional_data:
        parts.append(_emv("62", additional_data))

    payload = "".join(parts)
    crc_input = payload + "6304"
    crc = compute_crc16(crc_input)
    return crc_input + crc
