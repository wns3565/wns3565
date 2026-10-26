"""data/training-centers.json 의 주소를 카카오 로컬 API로 좌표 변환해 data/training-geo.json 으로 저장한다.

REST API 키는 환경변수 KAKAO_REST_KEY 또는 .secrets/kakao_rest_key.txt (git 제외) 에서 읽는다.
이미 변환된 기관은 건너뛰므로 여러 번 실행해도 된다.

사용: py scripts/geocode_centers.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "data", "training-centers.json")
OUT = os.path.join(ROOT, "data", "training-geo.json")
KEY_FILE = os.path.join(ROOT, ".secrets", "kakao_rest_key.txt")


def load_key():
    key = os.environ.get("KAKAO_REST_KEY", "").strip()
    if not key and os.path.exists(KEY_FILE):
        key = open(KEY_FILE, encoding="utf-8").read().strip()
    if not key:
        raise SystemExit("카카오 REST API 키가 없습니다. .secrets/kakao_rest_key.txt 에 저장하거나 KAKAO_REST_KEY 환경변수를 설정하세요.")
    return key


def call(path, key, **params):
    url = "https://dapi.kakao.com/v2/local/" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "KakaoAK " + key})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403):
                raise SystemExit(f"카카오 API 인증 실패({e.code}): REST API 키와 '카카오맵' 사용 설정을 확인하세요.")
            time.sleep(1 + attempt)
        except Exception:
            time.sleep(1 + attempt)
    return None


def clean_addr(addr):
    a = re.sub(r"\([^)]*\)", " ", addr)
    a = a.split(",")[0]
    return re.sub(r"\s+", " ", a).strip()


PROVINCE_FULL = {"충청북": "충북", "충청남": "충남", "전라북": "전북", "전라남": "전남", "경상북": "경북", "경상남": "경남"}


def sido_ok(area, address_name):
    """검색 결과 주소의 시도가 기관의 지역(서울·경기 등)과 같은지 확인한다."""
    name = (address_name or "").strip()
    if name.startswith("전남광주"):
        return area in ("광주", "전남")
    for full, short in PROVINCE_FULL.items():
        if name.startswith(full):
            name = short + name[len(full):]
    return name[:2] == area[:2]


def geocode(row, key):
    addr, org, area, gugu = row[7], row[4], row[1], row[2]
    tries = []
    if addr:
        tries.append(("search/address.json", clean_addr(addr)))
        tries.append(("search/address.json", re.sub(r"\s+", " ", addr.split(",")[0]).strip()))
    tries.append(("search/keyword.json", f"{area} {gugu} {org}".strip()))
    tries.append(("search/keyword.json", f"{gugu} {org}".strip()))
    for path, query in tries:
        if not query:
            continue
        data = call(path, key, query=query, size=5)
        for doc in (data or {}).get("documents") or []:
            if sido_ok(area, doc.get("address_name") or doc.get("road_address_name") or ""):
                return [round(float(doc["y"]), 6), round(float(doc["x"]), 6)]
    return None


def main():
    key = load_key()
    call("search/address.json", key, query="서울 영등포구 문래로20길 60", size=1)  # 인증·서비스 설정 사전 확인
    rows = json.load(open(SRC, encoding="utf-8"))["rows"]
    geo = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    todo = [r for r in rows if r[0] not in geo]
    print(f"대상 {len(todo)}건 (이미 완료 {len(geo)}건)")

    def work(r):
        return r[0], geocode(r, key)

    done = 0
    with ThreadPoolExecutor(6) as ex:
        for no, pos in ex.map(work, todo):
            geo[no] = pos if pos else False
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(todo)}")
                json.dump(geo, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    ok = {k: v for k, v in geo.items() if v}
    json.dump(ok, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"완료: 좌표 {len(ok)}건 / 실패 {len(geo) - len(ok)}건 -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
