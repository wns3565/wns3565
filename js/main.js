// =========================================================
// 사회복지현장실습 정보 사이트 - 공통 스크립트
// =========================================================

// 카카오 개발자 사이트에서 발급한 JavaScript 키(공개용)를 입력하세요.
const KAKAO_JS_KEY = "a8e4188ba17b546533e7fd5907bbcaf5";

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initApplyForm();
  initRealtimePage();
  initNationwidePage();
  initContactGuide();
  initContactForm();
});

/* ---------- 모바일 네비게이션 ---------- */
function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
    const expanded = nav.classList.contains("open");
    toggle.setAttribute("aria-expanded", String(expanded));
  });
}

/* ---------- 공통 유효성 검사 헬퍼 ---------- */
function setFieldError(field, msg) {
  field.classList.add("invalid");
  const hint = field.querySelector("small.hint");
  if (hint) {
    hint.dataset.original = hint.dataset.original || hint.textContent;
    hint.textContent = msg;
    hint.style.color = "#e53935";
  }
}

function clearFieldError(field) {
  field.classList.remove("invalid");
  const hint = field.querySelector("small.hint");
  if (hint && hint.dataset.original) {
    hint.textContent = hint.dataset.original;
    hint.style.color = "";
  }
}

/* ---------- Supabase 프로젝트 공통 설정 ---------- */
const SUPABASE_URL = "https://larcpgjoclnztwuekzkd.supabase.co";
const SUPABASE_KEY = "sb_publishable_kfzIvZ9tn1JMnV4pSToDTg_hPpLTQhB";

/* ---------- 2. 과목 신청 폼 (Supabase applications 테이블에 저장) ---------- */

function initApplyForm() {
  const form = document.getElementById("apply-form");
  if (!form) return;

  const msgBox = document.getElementById("apply-msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll(".field").forEach((field) => clearFieldError(field));

    const requiredFields = form.querySelectorAll("[required]");
    requiredFields.forEach((input) => {
      const field = input.closest(".field");
      if (!input.value || !input.value.trim()) {
        setFieldError(field, "필수 입력 항목입니다.");
        valid = false;
      }
    });

    const emailInput = form.querySelector("#email");
    if (emailInput && emailInput.value) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(emailInput.value)) {
        setFieldError(emailInput.closest(".field"), "올바른 이메일 형식이 아닙니다.");
        valid = false;
      }
    }

    const phoneInput = form.querySelector("#phone");
    if (phoneInput && phoneInput.value) {
      const phoneRe = /^[0-9-]{9,13}$/;
      if (!phoneRe.test(phoneInput.value)) {
        setFieldError(phoneInput.closest(".field"), "올바른 연락처 형식이 아닙니다. (예: 010-1234-5678)");
        valid = false;
      }
    }

    const agree = form.querySelector("#agree");
    if (agree && !agree.checked) {
      valid = false;
      msgBox.className = "form-msg error";
      msgBox.textContent = "개인정보 수집·이용에 동의해주셔야 신청이 가능합니다.";
    }

    if (!valid) {
      if (!(agree && !agree.checked)) {
        msgBox.className = "form-msg error";
        msgBox.textContent = "입력하신 내용을 다시 확인해주세요.";
      }
      const firstInvalid = form.querySelector(".invalid input, .invalid select, .invalid textarea");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const name = form.querySelector("#name").value.trim();
    const phone = form.querySelector("#phone").value.trim();
    const region = form.querySelector("#region").value;
    const period = form.querySelector("#period").value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name, phone, region, period }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      msgBox.className = "form-msg success";
      msgBox.textContent = `${name}님, 실습 과목 신청이 접수되었습니다. 담당자가 영업일 기준 2~3일 내 연락드립니다.`;
      form.reset();
    } catch (err) {
      msgBox.className = "form-msg error";
      msgBox.textContent = "신청 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    } finally {
      submitBtn.disabled = false;
    }
    msgBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ---------- 3. 전국 현장실습 실시간 정보 (Supabase realtime_postings 테이블에서 직접 조회) ---------- */
const REALTIME_BOARD_URL = "https://www.welfare.net/prm/find-training-center/recruitment-trainees";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

async function fetchRealtimeData() {
  const url = `${SUPABASE_URL}/rest/v1/realtime_postings?select=*&order=date.desc,ntt_sn.desc&limit=300`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`데이터를 불러올 수 없습니다 (${res.status})`);
  const rows = await res.json();
  const items = rows.map((r) => ({
    region: r.region,
    category: r.category,
    title: r.title,
    org: r.org,
    date: r.date,
    nttSn: r.ntt_sn,
  }));
  let updatedAt = null;
  rows.forEach((r) => {
    if (r.fetched_at && (!updatedAt || r.fetched_at > updatedAt)) updatedAt = r.fetched_at;
  });
  return { items, updatedAt };
}

/* ---------- 공통 페이지네이션 ---------- */
function buildPagination(wrap, currentPage, totalPages, windowSize, onGo) {
  wrap.innerHTML = "";
  if (totalPages <= 1) return;

  const makeBtn = (label, page, opts = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    if (opts.active) btn.classList.add("active");
    if (opts.disabled) btn.disabled = true;
    btn.addEventListener("click", () => onGo(Math.min(Math.max(page, 1), totalPages)));
    return btn;
  };

  const windowStart = Math.floor((currentPage - 1) / windowSize) * windowSize + 1;
  const windowEnd = Math.min(windowStart + windowSize - 1, totalPages);

  wrap.appendChild(makeBtn("처음", 1, { disabled: currentPage === 1 }));
  wrap.appendChild(makeBtn("이전", currentPage - 1, { disabled: currentPage === 1 }));
  for (let p = windowStart; p <= windowEnd; p++) {
    wrap.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
  }
  if (windowEnd < totalPages) {
    const span = document.createElement("span");
    span.className = "ellipsis";
    span.textContent = "…";
    wrap.appendChild(span);
  }
  wrap.appendChild(makeBtn("다음", currentPage + 1, { disabled: currentPage === totalPages }));
  wrap.appendChild(makeBtn("마지막", totalPages, { disabled: currentPage === totalPages }));
}

async function initRealtimePage() {
  const tbody = document.getElementById("realtime-body");
  if (!tbody) return;

  const chipsWrap = document.getElementById("region-chips");
  const searchInput = document.getElementById("search-input");
  const categorySelect = document.getElementById("category-select");
  const emptyState = document.getElementById("empty-state");
  const countLabel = document.getElementById("result-count");
  const timeLabel = document.getElementById("last-updated");
  const paginationWrap = document.getElementById("pagination");

  const PAGE_SIZE = 15;
  const PAGE_WINDOW = 10;

  const initialRegion = new URLSearchParams(location.search).get("region");
  let activeRegion = "전체";
  let realtimeData = [];
  let currentPage = 1;
  let dataUpdatedAt = null;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-light);">데이터를 불러오는 중입니다...</td></tr>`;

  try {
    const result = await fetchRealtimeData();
    realtimeData = result.items;
    dataUpdatedAt = result.updatedAt;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-light);">데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</td></tr>`;
    return;
  }

  const regions = ["전체", ...new Set(realtimeData.map((d) => d.region))];
  if (initialRegion && regions.includes(initialRegion)) activeRegion = initialRegion;
  regions.forEach((region) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "region-chip" + (region === activeRegion ? " active" : "");
    chip.textContent = region;
    chip.addEventListener("click", () => {
      activeRegion = region;
      chipsWrap.querySelectorAll(".region-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentPage = 1;
      render();
    });
    chipsWrap.appendChild(chip);
  });

  function renderPagination(totalItems) {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    buildPagination(paginationWrap, currentPage, totalPages, PAGE_WINDOW, (page) => {
      currentPage = page;
      render();
    });
  }

  function render() {
    const keyword = (searchInput.value || "").trim().toLowerCase();
    const categoryFilter = categorySelect.value;

    const filtered = realtimeData.filter((d) => {
      const regionMatch = activeRegion === "전체" || d.region === activeRegion;
      const keywordMatch = !keyword || d.org.toLowerCase().includes(keyword) || d.title.toLowerCase().includes(keyword);
      const categoryMatch = categoryFilter === "all" || d.category === categoryFilter;
      return regionMatch && keywordMatch && categoryMatch;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    tbody.innerHTML = "";
    pageItems.forEach((d, i) => {
      const tr = document.createElement("tr");
      const href = d.nttSn
        ? `${REALTIME_BOARD_URL}/recruitment-detail?nttSn=${d.nttSn}`
        : REALTIME_BOARD_URL;
      tr.innerHTML = `
        <td>${startIdx + i + 1}</td>
        <td>${escapeHtml(d.region)}</td>
        <td>${escapeHtml(d.category)}</td>
        <td><a class="post-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.title)}</a></td>
        <td>${escapeHtml(d.org)}</td>
        <td>${escapeHtml(d.date)}</td>
      `;
      tbody.appendChild(tr);
    });

    countLabel.textContent = `조회결과 ${filtered.length}건`;
    emptyState.style.display = filtered.length === 0 ? "block" : "none";
    renderPagination(filtered.length);
  }

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    render();
  });
  categorySelect.addEventListener("change", () => {
    currentPage = 1;
    render();
  });

  if (dataUpdatedAt) {
    const d = new Date(dataUpdatedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    timeLabel.textContent = `${hh}:${mm} 갱신`;
  } else {
    timeLabel.textContent = "";
  }

  render();
}

/* ---------- 4. 전국 실습 정보 (실습기관 선정 현황) ---------- */
async function initNationwidePage() {
  const tbody = document.getElementById("center-body");
  if (!tbody) return;

  const areaSel = document.getElementById("f-area");
  const guguSel = document.getElementById("f-gugu");
  const codeSel = document.getElementById("f-code");
  const statusSel = document.getElementById("f-status");
  const typeSel = document.getElementById("f-type");
  const keywordInput = document.getElementById("f-keyword");
  const form = document.getElementById("center-filter");
  const countLabel = document.getElementById("center-count");
  const emptyState = document.getElementById("center-empty");
  const paginationWrap = document.getElementById("center-pagination");
  const updatedLabel = document.getElementById("center-updated");

  const PAGE_SIZE = 20;
  const PAGE_WINDOW = 10;
  // 행 배열: [관리번호, 지역, 시군구, 시설분류, 기관명, 선정상태, 실습비용, 주소, 전화, 선정유효기간]
  let rows = [];
  let filtered = [];
  let currentPage = 1;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-light);">데이터를 불러오는 중입니다...</td></tr>`;
  try {
    const res = await fetch("data/training-centers.json");
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    rows = json.rows;
    if (json.updatedAt) {
      const d = new Date(json.updatedAt);
      updatedLabel.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-light);">데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</td></tr>`;
    return;
  }

  const areas = [...new Set(rows.map((r) => r[1]))].sort((a, b) => a.localeCompare(b, "ko"));
  areas.forEach((a) => areaSel.add(new Option(a, a)));

  function refreshGugu() {
    guguSel.length = 1;
    const area = areaSel.value;
    if (!area) return;
    const set = new Set(rows.filter((r) => r[1] === area && r[2]).map((r) => r[2]));
    [...set].sort((a, b) => a.localeCompare(b, "ko")).forEach((g) => guguSel.add(new Option(g, g)));
  }

  function formatAmount(n) {
    return n == null ? "-" : `${Number(n).toLocaleString("ko-KR")}원`;
  }

  function render() {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const startIdx = (currentPage - 1) * PAGE_SIZE;

    tbody.innerHTML = "";
    filtered.slice(startIdx, startIdx + PAGE_SIZE).forEach((r, i) => {
      const tr = document.createElement("tr");
      const stopped = r[5] !== "정상";
      tr.innerHTML = `
        <td>${startIdx + i + 1}</td>
        <td>${escapeHtml(r[0])}</td>
        <td>${escapeHtml(r[1])}</td>
        <td>${escapeHtml(r[2])}</td>
        <td>${escapeHtml(r[3])}</td>
        <td class="center-name">${r[10]
          ? `<a class="post-link" href="https://www.welfare.net/prm/find-training-center/current-stat-detail?mngNo=${encodeURIComponent(r[0])}&requestNo=${encodeURIComponent(r[10])}" target="_blank" rel="noopener noreferrer">${escapeHtml(r[4])}</a>`
          : escapeHtml(r[4])}</td>
        <td><span class="status-badge${stopped ? " stopped" : ""}">${escapeHtml(r[5])}</span></td>
        <td>${escapeHtml(formatAmount(r[6]))}</td>
      `;
      tbody.appendChild(tr);
    });

    countLabel.textContent = filtered.length.toLocaleString("ko-KR");
    emptyState.style.display = filtered.length === 0 ? "block" : "none";
    buildPagination(paginationWrap, currentPage, totalPages, PAGE_WINDOW, (page) => {
      currentPage = page;
      render();
    });
  }

  /* ----- 지도 보기 (카카오지도) ----- */
  const listView = document.getElementById("center-list-view");
  const mapView = document.getElementById("center-map-view");
  const mapBox = document.getElementById("center-map");
  const mapMsg = document.getElementById("center-map-msg");
  const viewTabs = document.querySelectorAll(".view-tab");
  let activeView = "list";
  let mapReady = null;
  let map = null;
  let clusterer = null;
  let infoWindow = null;
  let geo = null;
  const markerCache = new Map();

  function loadKakaoSdk() {
    return new Promise((resolve, reject) => {
      if (window.kakao && window.kakao.maps) return kakao.maps.load(resolve);
      const sc = document.createElement("script");
      sc.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + encodeURIComponent(KAKAO_JS_KEY) + "&libraries=clusterer&autoload=false";
      sc.onload = () => kakao.maps.load(resolve);
      sc.onerror = () => reject(new Error("sdk"));
      document.head.appendChild(sc);
    });
  }

  function ensureMap() {
    if (mapReady) return mapReady;
    mapReady = (async () => {
      if (!KAKAO_JS_KEY) throw new Error("nokey");
      const res = await fetch("data/training-geo.json");
      if (!res.ok) throw new Error("nogeo");
      geo = await res.json();
      await loadKakaoSdk();
      map = new kakao.maps.Map(mapBox, { center: new kakao.maps.LatLng(36.4, 127.8), level: 12 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      clusterer = new kakao.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 6 });
      infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 3 });
    })();
    mapReady.catch(() => { mapReady = null; });
    return mapReady;
  }

  function markerFor(r) {
    let m = markerCache.get(r[0]);
    if (m) return m;
    const pos = geo[r[0]];
    if (!pos) return null;
    m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(pos[0], pos[1]), title: r[4] });
    kakao.maps.event.addListener(m, "click", () => {
      infoWindow.setContent(
        '<div class="map-info"><strong>' + escapeHtml(r[4]) + "</strong>" +
        "<span>" + escapeHtml(r[3]) + " · " + escapeHtml(r[5]) + "</span>" +
        "<span>" + escapeHtml(r[7] || "주소 정보 없음") + "</span>" +
        (r[8] ? "<span>☎ " + escapeHtml(r[8]) + "</span>" : "") +
        "<span>실습비용 " + escapeHtml(formatAmount(r[6])) + "</span></div>"
      );
      infoWindow.open(map, m);
    });
    markerCache.set(r[0], m);
    return m;
  }

  async function renderMap() {
    mapMsg.hidden = false;
    mapMsg.textContent = "지도를 불러오는 중입니다...";
    try {
      await ensureMap();
    } catch (err) {
      mapMsg.textContent = err.message === "nokey"
        ? "지도 서비스를 준비 중입니다."
        : "지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
      return;
    }
    map.relayout();
    infoWindow.close();
    clusterer.clear();
    const markers = [];
    const bounds = new kakao.maps.LatLngBounds();
    filtered.forEach((r) => {
      const m = markerFor(r);
      if (m) {
        markers.push(m);
        bounds.extend(m.getPosition());
      }
    });
    clusterer.addMarkers(markers);
    if (markers.length) map.setBounds(bounds);
    mapMsg.hidden = false;
    mapMsg.textContent = markers.length === filtered.length
      ? "지도에 " + markers.length.toLocaleString("ko-KR") + "곳을 표시했습니다. 마커나 숫자를 눌러보세요."
      : "조회결과 " + filtered.length.toLocaleString("ko-KR") + "곳 중 위치 정보가 있는 " + markers.length.toLocaleString("ko-KR") + "곳을 표시했습니다.";
  }

  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeView = tab.dataset.view;
      viewTabs.forEach((t) => t.classList.toggle("active", t === tab));
      listView.hidden = activeView !== "list";
      mapView.hidden = activeView !== "map";
      if (activeView === "map") renderMap();
    });
  });

  function applyFilter() {
    const area = areaSel.value;
    const gugu = guguSel.value;
    const code = codeSel.value;
    const status = statusSel.value;
    const keyword = keywordInput.value.trim().toLowerCase();
    const byNo = typeSel.value === "no";

    filtered = rows.filter((r) =>
      (!area || r[1] === area) &&
      (!gugu || r[2] === gugu) &&
      (!code || r[3] === code) &&
      (!status || r[5] === status) &&
      (!keyword || (byNo ? r[0] : r[4]).toLowerCase().includes(keyword))
    );
    currentPage = 1;
    render();
    if (activeView === "map") renderMap();
  }

  areaSel.addEventListener("change", () => {
    refreshGugu();
    applyFilter();
  });
  [guguSel, codeSel, statusSel].forEach((el) => el.addEventListener("change", applyFilter));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    applyFilter();
  });

  applyFilter();
}

/* ---------- 실습처 연락방법 안내 펼치기 ---------- */
function initContactGuide() {
  const btn = document.getElementById("contact-guide-btn");
  const panel = document.getElementById("contact-guide");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
}

/* ---------- 5. 문의남기기 폼 ---------- */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const msgBox = document.getElementById("contact-msg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll(".field").forEach((field) => clearFieldError(field));

    form.querySelectorAll("[required]").forEach((input) => {
      const field = input.closest(".field");
      if (!input.value || !input.value.trim()) {
        setFieldError(field, "필수 입력 항목입니다.");
        valid = false;
      }
    });

    const emailInput = form.querySelector("#c-email");
    if (emailInput && emailInput.value) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(emailInput.value)) {
        setFieldError(emailInput.closest(".field"), "올바른 이메일 형식이 아닙니다.");
        valid = false;
      }
    }

    if (!valid) {
      msgBox.className = "form-msg error";
      msgBox.textContent = "입력하신 내용을 다시 확인해주세요.";
      const firstInvalid = form.querySelector(".invalid input, .invalid select, .invalid textarea");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const name = form.querySelector("#c-name").value.trim();
    msgBox.className = "form-msg success";
    msgBox.textContent = `${name}님, 문의가 정상적으로 접수되었습니다. 빠른 시일 내 답변드리겠습니다.`;
    form.reset();
    msgBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
