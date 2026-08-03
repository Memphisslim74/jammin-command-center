from pathlib import Path
import base64
import gzip
import hashlib

EXPECTED_SHA256 = "8ebd8a8ea72ab2aebd9b7854f84c56dd7975332a61972a0484aa552d3f73a997"
EXPECTED_SIZE = 69378

root = Path(__file__).resolve().parents[1]
payload_dir = root / "scripts" / "payroll_payload"
parts = sorted(
    payload_dir.glob("part*.txt"),
    key=lambda path: int(path.stem.replace("part", "")),
)

if len(parts) != 5:
    raise SystemExit(f"Expected 5 payroll payload parts, found {len(parts)}.")

payload = "".join(path.read_text(encoding="utf-8").strip() for path in parts)
if len(payload) % 4:
    raise SystemExit("Payroll payload has invalid base64 length.")

try:
    javascript = gzip.decompress(base64.b64decode(payload, validate=True))
except Exception as error:
    raise SystemExit(f"Could not decode payroll workspace: {error}") from error

if len(javascript) != EXPECTED_SIZE:
    raise SystemExit(
        f"Payroll JavaScript size mismatch: expected {EXPECTED_SIZE}, got {len(javascript)}."
    )

actual_hash = hashlib.sha256(javascript).hexdigest()
if actual_hash != EXPECTED_SHA256:
    raise SystemExit(
        f"Payroll JavaScript checksum mismatch: expected {EXPECTED_SHA256}, got {actual_hash}."
    )

output = root / "bookkeeper-payroll.js"
output.write_bytes(javascript)

index = root / "index.html"
text = index.read_text(encoding="utf-8")
script_tag = '    <script src="bookkeeper-payroll.js"></script>\n'
if script_tag not in text:
    anchor = '    <script src="classroom-copy-patch.js"></script>\n'
    if anchor not in text:
        raise SystemExit("Could not find the Command Center script insertion point.")
    text = text.replace(anchor, anchor + script_tag, 1)
    index.write_text(text, encoding="utf-8")

print("Installed and checksum-verified bookkeeper-payroll.js")
