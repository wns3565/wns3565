"""기관별 실습 운영방식(주중·주말·야간·방학중)을 welfare.net 상세 API에서 수집해 data/training-operation.json 으로 저장한다.

상세 API는 한 기관씩만 조회되므로, 이미 수집한 기관(요청번호가 같은 경우)은 건너뛰고 새로 생기거나 바뀐 기관만 받는다.
실패한 기관은 저장하지 않아 다음 실행 때 다시 시도한다.

저장 형식: {관리번호: [요청번호, 운영방식 비트값]}
  비트값: 1 주중실습 / 2 주말실습 / 4 야간실습 / 8 방학중실습(여름) / 16 방학중실습(겨울), 0 은 등록된 정보 없음

사용: py scripts/update_operation_types.py
"""
import json, os, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
INFO_URL = "https://api.welfare.net/prm/pr/prm/selectPtcorgInfo.do"
ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "data", "training-centers.json")
OUT = os.path.join(ROOT, "data", "training-operation.json")

BITS = {"주중실습": 1, "주말실습": 2, "야간실습": 4, "방학중실습(여름)": 8, "방학중실습(겨울)": 16}


def to_mask(text):
    return sum(BITS.get(t.strip(), 0) for t in (text or "").split(","))


def fetch(mng_no, req_no):
    q = urllib.parse.urlencode({"ptcorgMngNo": mng_no, "ptcorgReqstNo": req_no})
    req = urllib.request.Request(INFO_URL + "?" + q, headers={"User-Agent": UA, "Accept": "application/json"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                info = json.loads(r.read().decode("utf-8")).get("selectPtcorgInfo")
            if info:
                return to_mask(info.get("prcticeOperTy"))
        except Exception:
            pass
    return None


def main():
    rows = json.load(open(SRC, encoding="utf-8"))["rows"]
    saved = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    current = {r[0]: r[10] for r in rows}
    result = {no: v for no, v in saved.items() if no in current and v[0] == current[no]}
    todo = [no for no in current if no not in result]
    print(f"대상 {len(todo)}건 (이미 완료 {len(result)}건)")

    def work(no):
        return no, fetch(no, current[no])

    done = 0
    with ThreadPoolExecutor(8) as ex:
        for no, mask in ex.map(work, todo):
            if mask is not None:
                result[no] = [current[no], mask]
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(todo)}")
                json.dump(result, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    json.dump(result, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"완료: {len(result)}건 / 실패 {len(current) - len(result)}건 -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
