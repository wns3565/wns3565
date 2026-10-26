"""welfare.net 실습기관 선정 현황을 수집해 data/training-centers.json 으로 저장한다.

사용: py scripts/update_training_centers.py
"""
import json, os, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
LIST_URL = "https://api.welfare.net/prm/pr/prm/selectPtcorgList.do"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "training-centers.json")


def fetch(**params):
    q = dict(searchType="orgNm", searchValue="", areaCode="", areaDetailCode="", codeT="", status="", currPage=1)
    q.update(params)
    req = urllib.request.Request(LIST_URL + "?" + urllib.parse.urlencode(q), headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if attempt == 3:
                raise


def main():
    first = fetch()
    areas = [a["cmmnDetailCode"] for a in first["selectAreaCode"] if a["cmmnDetailCodeNm"] != "전국"]
    rows = {}
    # 전체 조회는 뒤쪽 페이지가 비어 오므로 지역별로 나눠서 수집한다.
    for area in areas:
        p1 = fetch(areaCode=area)["selectPtcorgList"]
        pages = [p1["list"]]
        with ThreadPoolExecutor(8) as ex:
            pages += list(ex.map(lambda n: fetch(areaCode=area, currPage=n)["selectPtcorgList"]["list"], range(2, p1["totalPage"] + 1)))
        for lst in pages:
            for r in lst:
                rows[r["ptcorgMngNo"]] = r
    if len(rows) < 5000:
        raise SystemExit(f"수집 건수가 너무 적습니다: {len(rows)}")

    out = []
    for r in rows.values():
        out.append([
            r["ptcorgMngNo"],
            r["areaCodeNm"] or "",
            r["instreprtguguNm"] or "",
            r["codeT"] or "",
            (r["orgNm"] or "").strip(),
            r["status"] or "",
            r["prcticeAmt"],
            r["orgAddr"] or "",
            r["orgTel"] or "",
            r["ptcorgValidDate"] or "",
        ])
    out.sort(key=lambda x: x[4])
    payload = {"updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "rows": out}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"saved {len(out)} rows -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
