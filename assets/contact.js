/* Форма звернення. Сайт статичний і бекенду не має, тому «надіслати» тут
   означає одне з двох: покласти готового листа в буфер обміну (працює
   завжди) або відкрити поштову програму (працює, лише якщо вона є —
   саме тому чиста mailto-кнопка й здавалася зламаною).

   Прогресивне покращення: кнопки лишаються звичайними mailto-посиланнями,
   а цей скрипт лише перехоплює клік. Без JS сайт поводиться як раніше. */
(function () {
  "use strict";

  var ADDR = "info@elintir.com";
  var EN = (document.documentElement.lang || "uk").toLowerCase().indexOf("en") === 0;

  var T = EN ? {
    title: "Get in touch",
    lead: "Tell us what you need and how to reach you. The message is assembled here — copy it, or open your mail client.",
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
    whoPh: "email, phone or Telegram",
    copy: "Copy the message",
    copied: "Copied — paste it into an email to " + ADDR,
    mail: "Open mail client",
    close: "Close",
    need: "Add a couple of words and a contact — otherwise there is nothing to answer.",
    subject: "ELINTIR — "
  } : {
    title: "Написати нам",
    lead: "Скажіть, що потрібно, і як з вами зв'язатися. Лист збирається тут — скопіюйте його або відкрийте поштову програму.",
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
    whoPh: "пошта, телефон або Telegram",
    copy: "Скопіювати листа",
    copied: "Скопійовано — вставте у лист на " + ADDR,
    mail: "Відкрити пошту",
    close: "Закрити",
    need: "Додайте пару слів і контакт — інакше нема на що відповідати.",
    subject: "ELINTIR — "
  };

  var CSS =
    '.el-modal-back{position:fixed;inset:0;background:rgba(16,16,16,.55);' +
    'display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999}' +
    '.el-modal{background:#fff;color:#101010;max-width:560px;width:100%;' +
    'max-height:92vh;overflow:auto;padding:30px clamp(20px,5vw,38px) 26px;' +
    'box-shadow:0 24px 70px rgba(0,0,0,.28)}' +
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
    '.el-acts{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;margin-top:4px}' +
    '.el-acts button.el-primary{font:inherit;font-size:15px;font-weight:700;color:#fff;' +
    'background:#2f4b19;border:0;padding:12px 22px;cursor:pointer}' +
    '.el-acts button.el-primary:hover{background:#3e6b1f}' +
    '.el-acts a.el-second,.el-acts button.el-second{font:inherit;font-size:15px;' +
    'color:#6e6e6e;background:none;border:0;padding:0;cursor:pointer;text-decoration:none;' +
    'border-bottom:1px solid #d8d8d8}' +
    '.el-acts a.el-second:hover,.el-acts button.el-second:hover{color:#101010}' +
    '.el-note{margin:16px 0 0;font-size:13.5px;line-height:1.5;color:#6e6e6e;min-height:1.5em}' +
    '.el-note.el-ok{color:#2f4b19;font-weight:700}' +
    '.el-addr{margin:14px 0 0;font-family:var(--mono,monospace);font-size:13px;color:#9a9a9a}' +
    '.el-addr a{color:#6e6e6e}';

  var back = null;

  function body(f) {
    return T.topic + ": " + f.topic + "\n\n" + f.msg + "\n\n" +
           T.who + ": " + f.who + "\n";
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
      opts += '<option>' + T.topics[i] + '</option>';
    }

    back.innerHTML =
      '<div class="el-modal" role="dialog" aria-modal="true" aria-label="' + T.title + '">' +
      '<h2>' + T.title + '</h2>' +
      '<p class="el-lead">' + T.lead + '</p>' +
      '<label for="el-topic">' + T.topic + '</label>' +
      '<select id="el-topic">' + opts + '</select>' +
      '<label for="el-msg">' + T.msg + '</label>' +
      '<textarea id="el-msg" placeholder="' + T.msgPh + '"></textarea>' +
      '<label for="el-who">' + T.who + '</label>' +
      '<input id="el-who" type="text" placeholder="' + T.whoPh + '">' +
      '<div class="el-acts">' +
      '<button type="button" class="el-primary" id="el-copy">' + T.copy + '</button>' +
      '<a class="el-second" id="el-mail" href="#">' + T.mail + '</a>' +
      '<button type="button" class="el-second" id="el-close">' + T.close + '</button>' +
      '</div>' +
      '<p class="el-note" id="el-note"></p>' +
      '<p class="el-addr"><a href="mailto:' + ADDR + '">' + ADDR + '</a></p>' +
      '</div>';

    document.body.appendChild(back);

    var note = back.querySelector("#el-note");

    function read() {
      return {
        topic: back.querySelector("#el-topic").value,
        msg: back.querySelector("#el-msg").value.trim(),
        who: back.querySelector("#el-who").value.trim()
      };
    }

    function ok(f) {
      if (f.msg && f.who) { return true; }
      note.className = "el-note";
      note.textContent = T.need;
      return false;
    }

    back.querySelector("#el-copy").addEventListener("click", function () {
      var f = read();
      if (!ok(f)) { return; }
      var text = T.subject + f.topic + "\n\n" + body(f);
      var done = function () {
        note.className = "el-note el-ok";
        note.textContent = T.copied;
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else {
        fallback(text, done);
      }
    });

    function fallback(text, done) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { ta.style.opacity = "1"; }
      document.body.removeChild(ta);
    }

    back.querySelector("#el-mail").addEventListener("click", function (e) {
      var f = read();
      if (!ok(f)) { e.preventDefault(); return; }
      this.href = "mailto:" + ADDR +
        "?subject=" + encodeURIComponent(T.subject + f.topic) +
        "&body=" + encodeURIComponent(body(f));
    });

    back.querySelector("#el-close").addEventListener("click", close);
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
    /* Усередині самого вікна mailto має спрацьовувати як завжди: і кнопка
       «Відкрити пошту», якій href підставляється кліком вище, і адреса
       внизу, яку люди клацають, щоб скопіювати. Інакше вікно перехоплює
       власні ж посилання. */
    if (back && back.contains(a)) { return; }
    e.preventDefault();
    open(a.getAttribute("data-topic") || null);
  });
})();
