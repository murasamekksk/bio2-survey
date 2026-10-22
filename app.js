(function () {
  const OPTIONS = [
    { key: 1, label: "不满意", emoji: "😞" },
    { key: 2, label: "不太满意", emoji: "🙁" },
    { key: 3, label: "一般", emoji: "😐" },
    { key: 4, label: "满意", emoji: "🙂" },
    { key: 5, label: "非常满意", emoji: "😄" }
  ];
  const SUPABASE_URL = "https://yssjcsckxmzlxswigtqw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MVYwf9bw0yjzmraYoiPJLw_mXpzqjPW";
  const CREDS_KEY = "bio2_admin_creds";
  const MAX_RESPONSES = 100;
  const FORCE_ADMIN = window.FORCE_ADMIN === true;
  const app = document.getElementById("app");
  let selected = null;

  function apiHeaders(extra) {
    const h = {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json"
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    }
    return h;
  }

  async function submitScore(score) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/survey_responses", {
      method: "POST",
      headers: apiHeaders({ "Prefer": "return=minimal" }),
      body: JSON.stringify({ score: score })
    });
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = j.message || j.hint || ""; } catch (e) {}
      if (msg.indexOf("SURVEY_FULL") !== -1) throw new Error("FULL");
      throw new Error(msg || "提交失败（" + res.status + "）");
    }
  }

  async function fetchResults(user, pass) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_survey_results", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ p_user: user, p_password: pass })
    });
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = j.message || j.hint || ""; } catch (e) {}
      if (msg.indexOf("AUTH_FAILED") !== -1) throw new Error("AUTH");
      if (msg.indexOf("does not exist") !== -1) {
        throw new Error("数据库还没初始化，请先在 Supabase 的 SQL Editor 运行建表脚本");
      }
      throw new Error(msg || "查询失败（" + res.status + "）");
    }
    return res.json();
  }

  function renderLoading(text) {
    app.innerHTML = `
      <div class="done">
        <div class="check">⏳</div>
        <h2>${text || "加载中…"}</h2>
      </div>
    `;
  }

  function renderLogin(message) {
    app.innerHTML = `
      <div class="login">
        <span class="tag">管理后台</span>
        <h2>班委满意度 · 登录</h2>
        <p class="desc">仅管理员可查看统计结果。</p>
        <div class="error ${message ? "show" : ""}" id="error">${message || ""}</div>
        <form id="login-form">
          <div class="field">
            <label for="username">账号</label>
            <input id="username" type="text" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="password">密码</label>
            <input id="password" type="password" autocomplete="current-password" required>
          </div>
          <button class="submit" type="submit">登录</button>
        </form>
      </div>
    `;

    app.querySelector("#login-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const user = app.querySelector("#username").value.trim();
      const pass = app.querySelector("#password").value;
      const btn = app.querySelector(".submit");
      btn.disabled = true;
      btn.textContent = "登录中…";

      try {
        const rows = await fetchResults(user, pass);
        sessionStorage.setItem(CREDS_KEY, JSON.stringify({ u: user, p: pass }));
        renderResults(rows);
      } catch (err) {
        if (err.message === "AUTH") {
          renderLogin("账号或密码错误");
        } else {
          renderLogin(err.message || "登录失败，请重试");
        }
      }
    });
  }

  function renderSurvey() {
    selected = null;
    app.innerHTML = `
      <span class="tag">25级 生物信息2班</span>
      <h1>班委工作满意度调查</h1>
      <p class="desc">请根据本学期班委的工作表现，选择你的整体满意度。本问卷仅需 10 秒。</p>
      <form id="form">
        <div class="options">
          ${OPTIONS.map(function (o) {
            return '<label class="option" data-key="' + o.key + '">' +
              '<input type="radio" name="score" value="' + o.key + '">' +
              '<span class="emoji">' + o.emoji + '</span>' +
              '<span class="text">' + o.label + '</span>' +
              '</label>';
          }).join("")}
        </div>
        <button class="submit" type="submit" disabled>提交</button>
      </form>
      <p class="hint">你的选择将被匿名记录 · 本次问卷限 ${MAX_RESPONSES} 份</p>
    `;

    app.querySelectorAll(".option").forEach(function (el) {
      el.addEventListener("click", function () {
        selected = Number(el.dataset.key);
        app.querySelectorAll(".option").forEach(function (o) { o.classList.remove("selected"); });
        el.classList.add("selected");
        el.querySelector("input").checked = true;
        app.querySelector(".submit").disabled = false;
      });
    });

    app.querySelector("#form").addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!selected) return;
      const btn = app.querySelector(".submit");
      btn.disabled = true;
      btn.textContent = "提交中…";
      try {
        await submitScore(selected);
        renderDone();
      } catch (err) {
        if (err.message === "FULL") {
          renderFull();
          return;
        }
        btn.disabled = false;
        btn.textContent = "提交";
        alert("提交失败：" + err.message + "\n请检查网络后重试");
      }
    });
  }

  function renderDone() {
    app.innerHTML = `
      <div class="done">
        <div class="check">✅</div>
        <h2>提交成功，谢谢你的反馈！</h2>
        <p>你的意见会帮助班委把工作做得更好。</p>
      </div>
    `;
  }

  function renderFull() {
    app.innerHTML = `
      <div class="done">
        <div class="check">🙏</div>
        <h2>问卷已收集满 ${MAX_RESPONSES} 份</h2>
        <p>感谢你的关注，本次调查已结束。</p>
      </div>
    `;
  }

  function renderResults(list) {
    const total = list.length;
    const counts = {};
    OPTIONS.forEach(function (o) { counts[o.key] = 0; });
    list.forEach(function (r) { if (counts[r.score] != null) counts[r.score]++; });
    const sum = list.reduce(function (s, r) { return s + Number(r.score); }, 0);
    const avg = total ? (sum / total) : 0;

    app.innerHTML = `
      <span class="tag">统计结果</span>
      <h1>班委工作满意度</h1>
      <p class="total">共收到 ${total} / ${MAX_RESPONSES} 份问卷${total ? "，满意度均分 " + avg.toFixed(2) + " / 5" : ""}</p>
      ${total ? '<div class="avg">整体评价：' + (avg >= 4.5 ? "非常满意" : avg >= 3.5 ? "满意" : avg >= 2.5 ? "一般" : avg >= 1.5 ? "不太满意" : "不满意") + '</div>' : ""}
      ${OPTIONS.slice().reverse().map(function (o) {
        const pct = total ? (counts[o.key] / total * 100) : 0;
        return '<div class="stat"><span class="label">' + o.emoji + " " + o.label + '</span>' +
          '<span class="val">' + counts[o.key] + ' 票 · ' + pct.toFixed(0) + '%</span></div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      }).join("")}
      <div class="btns">
        <button id="export">导出 CSV</button>
        <button class="primary" id="back">返回问卷</button>
      </div>
      <button class="logout" id="logout">退出登录</button>
    `;

    app.querySelector("#back").addEventListener("click", function () {
      history.replaceState(null, "", location.pathname);
      renderSurvey();
    });

    app.querySelector("#logout").addEventListener("click", function () {
      sessionStorage.removeItem(CREDS_KEY);
      renderLogin();
    });

    app.querySelector("#export").addEventListener("click", function () {
      if (!total) { alert("还没有数据"); return; }
      const rows = [["序号", "满意度评分", "满意度", "提交时间"]];
      list.forEach(function (r, i) {
        const opt = OPTIONS.find(function (o) { return o.key === Number(r.score); });
        rows.push([
          i + 1,
          r.score,
          opt ? opt.label : "",
          new Date(r.created_at).toLocaleString("zh-CN", { hour12: false })
        ]);
      });
      const csv = "\uFEFF" + rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
      }).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "班委满意度统计.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  async function initAdmin() {
    let creds = null;
    try { creds = JSON.parse(sessionStorage.getItem(CREDS_KEY) || "null"); } catch (e) {}
    if (!creds || !creds.u || !creds.p) {
      renderLogin();
      return;
    }
    renderLoading("正在加载统计结果…");
    try {
      const rows = await fetchResults(creds.u, creds.p);
      renderResults(rows);
    } catch (err) {
      sessionStorage.removeItem(CREDS_KEY);
      renderLogin(err.message === "AUTH" ? "登录已失效，请重新登录" : (err.message || "加载失败，请重新登录"));
    }
  }

  const isAdmin = FORCE_ADMIN || new URLSearchParams(location.search).get("admin") === "1";
  if (isAdmin) {
    initAdmin();
  } else {
    renderSurvey();
  }
})();
