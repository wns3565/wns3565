// =========================================================
// 사회복지현장실습 정보 사이트 - 공통 스크립트
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initApplyForm();
  initRealtimePage();
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

/* ---------- 2. 과목 신청 폼 ---------- */
const APPLY_GFORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeustQcV2vxAVRRRmehwwYMNZCYSEuAyrBXrDRFnu3AAbQXxQ/formResponse";
const APPLY_GFORM_ENTRIES = {
  name: "entry.2005620554",
  phone: "entry.1166974658",
  region: "entry.839337160",
  period: "entry.817992894",
};

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

    const params = new URLSearchParams();
    params.append(APPLY_GFORM_ENTRIES.name, name);
    params.append(APPLY_GFORM_ENTRIES.phone, phone);
    params.append(APPLY_GFORM_ENTRIES.region, region);
    params.append(APPLY_GFORM_ENTRIES.period, period);

    try {
      await fetch(APPLY_GFORM_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
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

/* ---------- 3. 전국 현장실습 실시간 정보 (welfare.net 실습모집 게시판 공개 API 직접 연동) ---------- */
const REALTIME_API_URL = "https://api.welfare.net/prm/na/ntt/selectNttList.do";
const REALTIME_BOARD_URL = "https://www.welfare.net/prm/find-training-center/recruitment-trainees";
const REALTIME_PAGES = 30; // 10건 x 30페이지 = 최신 300건

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

async function fetchRealtimeData() {
  const requests = [];
  for (let page = 1; page <= REALTIME_PAGES; page++) {
    const url = `${REALTIME_API_URL}?bbsId=1703&searchType=orgNm&searchValue=&areaCode=&codeT=&pageIndex=10&currPage=${page}`;
    requests.push(fetch(url).then((r) => r.json()));
  }
  const pages = await Promise.all(requests);
  const rows = [];
  pages.forEach((page) => {
    const list = (page.nttListPaging && page.nttListPaging.list) || [];
    list.forEach((item) => {
      rows.push({
        region: item.areaNm || "-",
        category: item.codeT || "기타",
        title: item.nttSj || "",
        org: item.orgNm || item.regNm || "",
        date: (item.regDt || "").replace(/\./g, "-"),
        nttSn: item.nttSn,
      });
    });
  });
  return rows;
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

  let activeRegion = "전체";
  let realtimeData = [];
  let currentPage = 1;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-light);">실시간 데이터를 불러오는 중입니다...</td></tr>`;

  try {
    realtimeData = await fetchRealtimeData();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-light);">실시간 데이터를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새로고침해주세요.</td></tr>`;
    return;
  }

  const regions = ["전체", ...new Set(realtimeData.map((d) => d.region))];
  regions.forEach((region) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "region-chip" + (region === "전체" ? " active" : "");
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
    paginationWrap.innerHTML = "";
    if (totalPages <= 1) return;

    const goTo = (page) => {
      currentPage = Math.min(Math.max(page, 1), totalPages);
      render();
    };

    const makeBtn = (label, page, opts = {}) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (opts.active) btn.classList.add("active");
      if (opts.disabled) btn.disabled = true;
      btn.addEventListener("click", () => goTo(page));
      return btn;
    };

    const windowStart = Math.floor((currentPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
    const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);

    paginationWrap.appendChild(makeBtn("처음", 1, { disabled: currentPage === 1 }));
    paginationWrap.appendChild(makeBtn("이전", currentPage - 1, { disabled: currentPage === 1 }));

    for (let p = windowStart; p <= windowEnd; p++) {
      paginationWrap.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
    }

    if (windowEnd < totalPages) {
      const span = document.createElement("span");
      span.className = "ellipsis";
      span.textContent = "…";
      paginationWrap.appendChild(span);
    }

    paginationWrap.appendChild(makeBtn("다음", currentPage + 1, { disabled: currentPage === totalPages }));
    paginationWrap.appendChild(makeBtn("마지막", totalPages, { disabled: currentPage === totalPages }));
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

  function updateTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    timeLabel.textContent = `${hh}:${mm}:${ss} 기준`;
  }

  updateTimestamp();
  render();
  setInterval(updateTimestamp, 1000);
}

/* ---------- 4. 문의남기기 폼 ---------- */
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
