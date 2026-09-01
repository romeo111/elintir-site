/* Форма звернення на статичному сайті.
 *
 * Сайт лежить на GitHub Pages і власного бекенду не має, тому лист
 * відправляє стороння служба formsubmit.co: браузер шле їй POST, вона
 * пересилає лист на нашу адресу. Данні звернення проходять через неї —
 * це плата за відсутність сервера.
 *
 * ⚠ Перше звернення після зміни адреси НЕ доїде: formsubmit надсилає на
 * неї лист-підтвердження, і доки хтось не натисне там посилання, решта
 * листів не пересилається. Це разова дія і водночас перевірка, що
 * скринька взагалі жива.
 *
 * Якщо служба лягла або мережа підвела, форма не мовчить: показує помилку
 * і відкриває два запасні шляхи — скопіювати зібраного листа або відкрити
 * поштову програму. Без JS кнопки лишаються звичайними mailto.
 */
(function () {
  "use strict";

  var ADDR = "info@elintir.com";
  var POST = "https://formsubmit.co/ajax/" + ADDR;
  var EN = (document.documentElement.lang || "uk").toLowerCase().indexOf("en") === 0;

  var T = EN ? {
    title: "Get in touch",
    lead: "Tell us what you need and how to reach you — the message goes straight to our inbox.",
    topic: "Topic",
    topics: [
      "Phase-coherent direction finding",
      "In-house radio data link protocols",
      "Signature-based emitter recognition",
      "Investment"
    ],
    msg: "Briefly, what you need",
    msgPh: "A demo, a specification, a joint measurement…",
    who: "How to reach you",
    whoPh: "email, phone or WhatsApp",
    send: "Send",
    sending: "Sending…",
    sent: "Sent. We will reply to ",
    close: "Close",
    need: "Add a couple of words and a contact — otherwise there is nothing to answer.",
    failed: "Could not send. Two ways left:",
    copy: "Copy the message",
    copied: "Copied — paste it into an email to " + ADDR,
    mail: "Open mail client",
    subject: "ELINTIR — "
  } : {
    title: "Написати нам",
    lead: "Скажіть, що потрібно, і як з вами зв'язатися — лист піде одразу нам на пошту.",
    topic: "Тема",
    topics: [
      "Фазово когерентна пеленгація",
      "Власні радіо дата лінк протоколи",
      "Сигнатурне розпізнавання цілей",
      "Інвестиції"
    ],
    msg: "Коротко, що потрібно",
    msgPh: "Демонстрація, специфікація, спільний вимір…",
    who: "Ваш контакт",
    whoPh: "пошта, телефон або WhatsApp",
    send: "Надіслати",
    sending: "Надсилаю…",
    sent: "Надіслано. Відповімо на ",
    close: "Закрити",
    need: "Додайте пару слів і контакт — інакше нема на що відповідати.",
    failed: "Не вдалося надіслати. Лишились два шляхи:",
    copy: "Скопіювати листа",
    copied: "Скопійовано — вставте у лист на " + ADDR,
    mail: "Відкрити пошту",
    subject: "ELINTIR — "
  };

  var CSS =
    '.el-modal-back{position:fixed;inset:0;background:rgba(16,16,16,.55);' +
    'display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999}' +
    /* Без цього рядка display:flex перебиває атрибут hidden, і закрите
       вікно лишається невидимою плівкою поверх усієї сторінки — жодна
       кнопка під нею більше не натискається. */
    '.el-modal-back[hidden]{display:none}' +
    '.el-modal{position:relative;background:#fff;color:#101010;max-width:560px;width:100%;' +
    'max-height:92vh;overflow:auto;padding:30px clamp(20px,5vw,38px) 26px;' +
    'box-shadow:0 24px 70px rgba(0,0,0,.28)}' +
    '.el-x{position:absolute;top:10px;right:12px;width:34px;height:34px;line-height:1;' +
    'font:inherit;font-size:26px;color:#9a9a9a;background:none;border:0;cursor:pointer;' +
    'padding:0;display:flex;align-items:center;justify-content:center}' +
    '.el-x:hover{color:#101010}' +
    '.el-modal h2{font-family:var(--display,inherit);font-size:clamp(21px,3vw,26px);' +
    'font-weight:700;margin:0 0 10px;letter-spacing:-.01em}' +
    '.el-modal .el-lead{margin:0 0 22px;color:#6e6e6e;font-size:15px;line-height:1.55}' +
    '.el-modal label{display:block;font-family:var(--mono,monospace);font-size:11px;' +
    'font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9a9a9a;' +
    'margin:0 0 7px}' +
    '.el-modal select,.el-modal textarea,.el-modal input{width:100%;font:inherit;' +
    'font-size:15px;color:#101010;background:#fff;border:1px solid #e2e2e2;' +
    'border-radius:0;padding:10px 12px;margin:0 0 18px}' +
    '.el-modal textarea{min-height:96px;resize:vertical;line-height:1.5}' +
    '.el-modal select:focus,.el-modal textarea:focus,.el-modal input:focus{' +
    'outline:none;border-color:#3e6b1f}' +
    '.el-honey{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '.el-acts{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;margin-top:4px}' +
    '.el-acts button.el-primary{font:inherit;font-size:15px;font-weight:700;color:#fff;' +
    'background:#2f4b19;border:0;padding:12px 22px;cursor:pointer}' +
    '.el-acts button.el-primary:hover{background:#3e6b1f}' +
    '.el-acts button.el-primary[disabled]{background:#9a9a9a;cursor:default}' +
    '.el-acts a.el-second,.el-acts button.el-second{font:inherit;font-size:15px;' +
    'color:#6e6e6e;background:none;border:0;padding:0;cursor:pointer;text-decoration:none;' +
    'border-bottom:1px solid #d8d8d8}' +
    '.el-acts a.el-second:hover,.el-acts button.el-second:hover{color:#101010}' +
    '.el-note{margin:16px 0 0;font-size:13.5px;line-height:1.5;color:#6e6e6e;min-height:1.5em}' +
    '.el-note.el-ok{color:#2f4b19;font-weight:700}' +
    '.el-fallback{display:none;gap:12px 16px;align-items:center;margin-top:12px}' +
    '.el-fallback.on{display:flex;flex-wrap:wrap}' +
    '.el-addr{margin:14px 0 0;font-family:var(--mono,monospace);font-size:13px;color:#9a9a9a}' +
    '.el-addr a{color:#6e6e6e}';

  var back = null;

  function letter(f) {
    return T.topic + ": " + f.topic + "\n\n" + f.msg + "\n\n" + T.who + ": " + f.who + "\n";
  }

  function build() {
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    back = document.createElement("div");
    back.className = "el-modal-back";
    back.setAttribute("hidden", "");

    var opts = "";
    for (var i = 0; i < T.topics.length; i++) {
      opts += "<option>" + T.topics[i] + "</option>";
    }

    back.innerHTML =
      '<div class="el-modal" role="dialog" aria-modal="true" aria-label="' + T.title + '">' +
      '<button type="button" class="el-x" id="el-x" aria-label="' + T.close + '">\u00d7</button>' +
      "<h2>" + T.title + "</h2>" +
      '<p class="el-lead">' + T.lead + "</p>" +
      '<label for="el-topic">' + T.topic + "</label>" +
      '<select id="el-topic">' + opts + "</select>" +
      '<label for="el-msg">' + T.msg + "</label>" +
      '<textarea id="el-msg" placeholder="' + T.msgPh + '"></textarea>' +
      '<label for="el-who">' + T.who + "</label>" +
      '<input id="el-who" type="text" placeholder="' + T.whoPh + '">' +
      '<input class="el-honey" id="el-honey" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="el-acts">' +
      '<button type="button" class="el-primary" id="el-send">' + T.send + "</button>" +
      '<button type="button" class="el-second" id="el-close">' + T.close + "</button>" +
      "</div>" +
      '<p class="el-note" id="el-note"></p>' +
      '<div class="el-fallback" id="el-fallback">' +
      '<button type="button" class="el-second" id="el-copy">' + T.copy + "</button>" +
      '<a class="el-second" id="el-mail" href="#">' + T.mail + "</a>" +
      "</div>" +
      '<p class="el-addr"><a href="mailto:' + ADDR + '">' + ADDR + "</a></p>" +
      "</div>";

    document.body.appendChild(back);

    var note = back.querySelector("#el-note");
    var sendBtn = back.querySelector("#el-send");
    var fallback = back.querySelector("#el-fallback");

    function read() {
      return {
        topic: back.querySelector("#el-topic").value,
        msg: back.querySelector("#el-msg").value.trim(),
        who: back.querySelector("#el-who").value.trim(),
        honey: back.querySelector("#el-honey").value
      };
    }

    function say(text, ok) {
      note.className = ok ? "el-note el-ok" : "el-note";
      note.textContent = text;
    }

    function offerFallback(f, message) {
      say(message || T.failed, false);
      fallback.className = "el-fallback on";
      back.querySelector("#el-mail").href =
        "mailto:" + ADDR +
        "?subject=" + encodeURIComponent(T.subject + f.topic) +
        "&body=" + encodeURIComponent(letter(f));
    }

    sendBtn.addEventListener("click", function () {
      var f = read();
      if (!f.msg || !f.who) { say(T.need, false); return; }

      sendBtn.disabled = true;
      sendBtn.textContent = T.sending;
      say("", false);

      var payload = {
        _subject: T.subject + f.topic,
        _template: "table",
        _captcha: "false",
        _honey: f.honey
      };
      payload[T.topic] = f.topic;
      payload[T.msg] = f.msg;
      payload[T.who] = f.who;

      var done = function (okFlag, message) {
        sendBtn.disabled = false;
        sendBtn.textContent = T.send;
        if (okFlag) {
          say(T.sent + f.who, true);
          fallback.className = "el-fallback";
        } else {
          offerFallback(f, message);
        }
      };

      fetch(POST, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { ok: r.ok, j: j };
        });
      }).then(function (res) {
        if (res.ok && String(res.j.success) === "true") { done(true); }
        else { done(false, res.j && res.j.message ? res.j.message : null); }
      }).catch(function () { done(false, null); });
    });

    back.querySelector("#el-copy").addEventListener("click", function () {
      var f = read();
      var text = T.subject + f.topic + "\n\n" + letter(f);
      var ok = function () { say(T.copied, true); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text, ok); });
      } else {
        legacyCopy(text, ok);
      }
    });

    function legacyCopy(text, ok) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { /* лишається адреса нижче */ }
      document.body.removeChild(ta);
    }

    back.querySelector("#el-close").addEventListener("click", close);
    back.querySelector("#el-x").addEventListener("click", close);
    back.addEventListener("click", function (e) { if (e.target === back) { close(); } });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !back.hasAttribute("hidden")) { close(); }
    });
  }

  function open(topic) {
    if (!back) { build(); }
    if (topic) {
      var sel = back.querySelector("#el-topic");
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === topic) { sel.selectedIndex = i; }
      }
    }
    back.removeAttribute("hidden");
    back.querySelector("#el-msg").focus();
  }

  function close() { if (back) { back.setAttribute("hidden", ""); } }

  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="mailto:"]') : null;
    if (!a) { return; }
    /* Усередині самого вікна mailto має працювати як завжди: і запасна
       кнопка «Відкрити пошту», і адреса внизу. */
    if (back && back.contains(a)) { return; }
    e.preventDefault();
    open(a.getAttribute("data-topic") || null);
  });
})();
