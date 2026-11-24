"""Build the Ukrainian and English investor-facing static pages."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def signal_svg(label="RF"):
    return f'''<div class="signal-panel" role="img" aria-label="{label}"><svg viewBox="0 0 600 340" aria-hidden="true">
      <circle class="orbit" cx="300" cy="170" r="125"/><ellipse class="orbit" cx="300" cy="170" rx="245" ry="95"/>
      <circle class="orbit" cx="300" cy="170" r="64"/><path class="beam" d="M110 244 300 170 458 90 M300 170 485 244"/>
      <circle class="pulse" cx="300" cy="170" r="6"/><circle class="pulse" cx="110" cy="244" r="6"/>
      <circle cx="458" cy="90" r="5" fill="#b5e8de"/><circle cx="485" cy="244" r="5" fill="#b5e8de"/>
      <text x="27" y="32" fill="#c8e3e5" font-size="12" font-family="Montserrat,Arial,sans-serif" letter-spacing="3">{label}</text>
    </svg></div>'''


def card(name, role, detail, image, status, href):
    return f'''<a class="product-card" href="{href}"><img src="/assets/products/{image}" alt="" loading="lazy" width="640" height="480">
    <div class="card-copy"><h3>{name}</h3><p>{role}. {detail}</p><div class="card-foot"><span class="status">{status}</span><span aria-hidden="true">↗</span></div></div></a>'''


def base(lang, title, description, body, current):
    en = lang == "en"
    prefix = "/en" if en else ""
    home = f"{prefix}/"
    labels = ("Home", "Products", "Communications", "RASSVET", "Investors", "Company", "Request a demo") if en else ("Головна", "Продукти", "Зв’язок", "Рассвет", "Інвесторам", "Компанія", "Замовити демо")
    alt = "/" if en else "/en/"
    alt_lang = "UK" if en else "EN"
    lang_attr = "en" if en else "uk"
    links = [(home, labels[0], "home"), (f"{prefix}/hardware/", labels[1], "hardware"),
             (f"{prefix}/slink/", labels[2], "slink"), ("/rassvet/", labels[3], "rassvet"),
             (f"{prefix}/investors/", labels[4], "investors"), (f"{prefix}/company/", labels[5], "company")]
    nav = "".join(f'<a href="{url}"{(" aria-current=\"page\"" if key == current else "")}>{label}</a>' for url, label, key in links)
    mail = "ELINTIR%20demo%20request" if en else "%D0%97%D0%B0%D0%BF%D0%B8%D1%82%20%D0%BD%D0%B0%20%D0%B4%D0%B5%D0%BC%D0%BE"
    return f'''<!doctype html>
<html lang="{lang_attr}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — ELINTIR</title><meta name="description" content="{description}"><meta name="theme-color" content="#ffffff">
<link rel="canonical" href="https://elintir.com{home if current == "home" else prefix + "/" + current + "/"}">
<link rel="alternate" hreflang="uk" href="https://elintir.com/{"" if current == "home" else current + "/"}">
<link rel="alternate" hreflang="en" href="https://elintir.com/en/{"" if current == "home" else current + "/"}">
<link rel="icon" type="image/svg+xml" href="/assets/branding/elintir-favicon.svg"><link rel="stylesheet" href="/assets/site-v2.css">
<meta property="og:title" content="{title} — ELINTIR"><meta property="og:description" content="{description}"><meta property="og:type" content="website"><meta property="og:image" content="https://elintir.com/assets/products/elintir-og-product.jpg">
</head><body><header class="topbar wrap"><a class="brand" href="{home}" aria-label="ELINTIR"><img src="/assets/branding/elintir-logo-mark.svg" alt="" width="39" height="39">ELINTIR</a>
<nav class="nav" aria-label="{"Main navigation" if en else "Основна навігація"}">{nav}<a class="nav-cta" href="mailto:info@elintir.com?subject={mail}">{labels[6]}</a><a class="lang" href="{alt if current == "home" else alt + current + "/"}" hreflang="{"uk" if en else "en"}">{alt_lang}</a></nav></header>
<main>{body}</main><footer class="footer wrap"><span>© ELINTIR · 2026</span><span>{"SDR systems for reconnaissance and communications" if en else "SDR-системи розвідки та зв’язку"}</span><a href="mailto:info@elintir.com">info@elintir.com</a></footer></body></html>'''


def home_uk():
    return f'''<section class="hero wrap"><div class="hero-copy"><p class="eyebrow">ELINTIR / Радіосистеми</p><h1>SDR-системи розвідки та зв’язку.</h1>
    <p class="lead">Від антени до рішення оператора: створюємо власні радіомодеми, засоби пеленгації та програмне забезпечення для роботи з ефіром.</p>
    <div class="hero-actions"><a class="btn" href="/hardware/">Продукти <span aria-hidden="true">↗</span></a><a class="btn secondary" href="/investors/">Для партнерів та інвесторів</a></div></div>
    <img class="hero-photo" src="/assets/pitch-drone.jpeg" alt="Безпілотна платформа з радіообладнанням" width="1536" height="1024" fetchpriority="high">
    <div class="hero-note"><span>FPGA · SDR · RF SoC</span><span>Зроблено в Україні</span></div></section>
    <section class="section wrap" id="products"><div class="section-head"><div><p class="eyebrow">01 / Продукти</p><h2>Один стек. Різні задачі.</h2></div><p class="lead">Продукти для приймання, аналізу та передавання сигналу, зібрані навколо роботи оператора.</p></div>
    <div class="product-grid">{card('GR-1','Пеленгація','Когерентний багатоканальний приймач із бортовою обробкою.','elintir-gr-1.webp','Прототип','/hardware/#gr1')}
    {card('SL-1','Зв’язок','Операторський модем для телеметрії й команд.','elintir-sl-1.webp','Польові випробування','/slink/#sl1')}
    {card('UCA-1','Повітряний сенсор','Антенний вузол для підвісного контейнера.','elintir-uca-1.webp','Розробка','/hardware/#uca1')}</div>
    <div class="section-actions" style="margin-top:25px"><a class="inline-link" href="/hardware/">Усі продукти ↗</a></div></section>
    <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Платформа</p><h2>Від сигналу до зрозумілої картини.</h2><p>Kraban збирає дані приймачів в одному робочому просторі: пеленги, відео, спектр і події. Оператор бачить узгоджену картину, а не набір окремих приладів.</p>
    <div class="kicker-list"><div><strong>Kraban</strong>Основний застосунок оператора</div><div><strong>GR-1 / ZR-3</strong>Пеленгація та спостереження</div><div><strong>AirnetRF</strong>Аналіз сигналів</div></div></div></div></section>
    <section class="section wrap" id="directions"><p class="eyebrow">03 / Напрями розробки</p><h2>Інженерія в основі системи.</h2><div class="grid-3">
    <article class="text-card"><div class="number">01 / ПРИЙМАННЯ</div><h3>Фазова когерентність</h3><p>Багатоканальний SDR, інтерферометрія та алгоритми оцінки напряму для пасивного спостереження.</p></article>
    <article class="text-card"><div class="number">02 / ОБРОБКА</div><h3>Сигнал у FPGA</h3><p>Цифровий відеоприйом, аналіз спектра й розпізнавання радіосигнатур у реальному часі.</p></article>
    <article class="text-card"><div class="number">03 / ЗВ’ЯЗОК</div><h3>Власні радіолінки</h3><p>Профілі для телеметрії, команд і відео. Мережева архітектура MANET — наступний етап розвитку.</p></article></div></section>
    <section class="section contact"><div class="wrap"><p class="eyebrow">04 / Співпраця</p><h2>Покажемо, що вже працює.</h2><p class="lead">Обговоримо демонстрацію продуктів, інтеграцію під платформу або партнерство.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20demo">Зв’язатися з нами ↗</a></div></section>'''


def home_en():
    return f'''<section class="hero wrap"><div class="hero-copy"><p class="eyebrow">ELINTIR / Radio systems</p><h1>SDR systems for reconnaissance and communications.</h1>
    <p class="lead">From antenna to operator decision: we build radio modems, direction-finding systems and software for understanding the spectrum.</p>
    <div class="hero-actions"><a class="btn" href="/en/hardware/">Products ↗</a><a class="btn secondary" href="/en/investors/">Partners and investors</a></div></div>
    <img class="hero-photo" src="/assets/pitch-drone.jpeg" alt="Uncrewed platform with radio equipment" width="1536" height="1024" fetchpriority="high"><div class="hero-note"><span>FPGA · SDR · RF SoC</span><span>Built in Ukraine</span></div></section>
    <section class="section wrap" id="products"><div class="section-head"><div><p class="eyebrow">01 / Products</p><h2>One stack. Many tasks.</h2></div><p class="lead">Products for receiving, analysing and transmitting signals, designed around the operator’s workflow.</p></div>
    <div class="product-grid">{card('GR-1','Direction finding','A coherent multichannel receiver with onboard processing.','elintir-gr-1.webp','Prototype','/en/hardware/#gr1')}
    {card('SL-1','Communications','Operator modem for telemetry and commands.','elintir-sl-1.webp','Field tested','/en/slink/#sl1')}
    {card('UCA-1','Airborne sensing','Antenna unit for an airborne payload.','elintir-uca-1.webp','In development','/en/hardware/#uca1')}</div><div class="section-actions" style="margin-top:25px"><a class="inline-link" href="/en/hardware/">Explore all products ↗</a></div></section>
    <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Platform</p><h2>From signal to a clear picture.</h2><p>Kraban brings receiver data into one workspace: bearings, video, spectrum and events. Operators see one coherent picture.</p>
    <div class="kicker-list"><div><strong>Kraban</strong>Core operator application</div><div><strong>GR-1 / ZR-3</strong>Direction finding and monitoring</div><div><strong>AirnetRF</strong>Signal analysis</div></div></div></div></section>
    <section class="section wrap" id="directions"><p class="eyebrow">03 / Development</p><h2>Engineering at the core.</h2><div class="grid-3">
    <article class="text-card"><div class="number">01 / RECEIVE</div><h3>Phase coherence</h3><p>Multichannel SDR, interferometry and direction estimation for passive observation.</p></article>
    <article class="text-card"><div class="number">02 / PROCESS</div><h3>Signal processing in FPGA</h3><p>Digital video reception, spectrum analysis and radio signature recognition in real time.</p></article>
    <article class="text-card"><div class="number">03 / CONNECT</div><h3>Our own radio links</h3><p>Profiles for telemetry, commands and video. MANET networking is the next development stage.</p></article></div></section>
    <section class="section contact"><div class="wrap"><p class="eyebrow">04 / Collaboration</p><h2>See what already works.</h2><p class="lead">Talk to us about demonstrations, platform integration or partnerships.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20demo">Contact us ↗</a></div></section>'''


def product_row(section_id, name, category, status, description, bullets, image=None, link=None):
    media = f'<div class="product-media"><img src="/assets/products/{image}" alt="{name}" loading="lazy" width="640" height="480"></div>' if image else ''
    bullet_html = ''.join(f'<li>{item}</li>' for item in bullets)
    action = f'<a class="inline-link" href="{link[0]}">{link[1]} ↗</a>' if link else ''
    return f'''<article class="product-row{' no-media' if not image else ''}" id="{section_id}">{media}<div><p class="eyebrow">{category}</p><span class="status">{status}</span><h2>{name}</h2><p class="lead">{description}</p><ul>{bullet_html}</ul>{action}</div></article>'''


def hardware(lang):
    en = lang == 'en'
    if en:
        intro = '<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Products</p><h1>Systems built for the spectrum.</h1><p class="lead">Hardware, FPGA signal processing and operator software designed as one product stack. We mark the current validation stage of each item.</p></section>'
        rows = [
            product_row('kraban','Kraban','Operator application','Delivered to customers','The central workspace for monitoring and analysis.', ['Spectrum, bearings, video and events in one interface.','FPGA reception of analogue FPV video, including PAL/NTSC processing.','Connects radio sensors with an operator’s workflow.']),
            product_row('gr1','GR-1','Direction finding','Prototype; field checks','A phase-coherent multichannel receiver for passive direction finding.', ['Interferometric measurements and bearing estimation.','Onboard processing reduces the need to stream raw IQ.','Field results apply to tested configurations, not a universal range guarantee.'],'elintir-gr-1.webp'),
            product_row('uca1','UCA-1','Airborne payload','In development','An antenna unit for a compact airborne sensing payload.', ['Designed around coherent radio reception.','Integration is tailored to the carrier and mission.'],'elintir-uca-1.webp'),
            product_row('sl1','SL-1','Radio modem','Field tested','An operator-side modem for command and telemetry links.', ['Part of the s.Link communications family.','Designed for integration with SDR and FPGA platforms.'],'elintir-sl-1.webp',('/en/slink/','Communications details')),
            product_row('zr3','ZR-3','Directional sensor','Prototype','A directional sensor architecture with multi-face antennas.', ['Two-axis direction estimation under development.','Validation continues before wider deployment.'])]
        cta = '<section class="section contact"><div class="wrap"><p class="eyebrow">Integration</p><h2>Discuss a platform fit.</h2><p class="lead">We can show the current build and scope an integration with your team.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20products">Contact ELINTIR ↗</a></div></section>'
    else:
        intro = '<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Продукти</p><h1>Системи для роботи з ефіром.</h1><p class="lead">Апаратна частина, обробка сигналу в FPGA та застосунок оператора — один продуктовий стек. Для кожного рішення вказуємо поточний етап перевірки.</p></section>'
        rows = [
            product_row('kraban','Kraban','Застосунок оператора','Передано замовникам','Основний робочий простір для спостереження й аналізу.', ['Спектр, пеленги, відео та події в одному інтерфейсі.','Прийом аналогового FPV-відео з обробкою PAL/NTSC у FPGA.','Поєднує радіосенсори з робочим процесом оператора.']),
            product_row('gr1','GR-1','Пеленгація','Прототип; польові перевірки','Фазово когерентний багатоканальний приймач для пасивної пеленгації.', ['Інтерферометричні вимірювання й оцінка напряму.','Бортова обробка зменшує потребу передавати сирий IQ.','Польові результати стосуються перевірених конфігурацій.'],'elintir-gr-1.webp'),
            product_row('uca1','UCA-1','Підвісний контейнер','Розробка','Антенний вузол для компактного повітряного сенсора.', ['Спроєктований для когерентного радіоприймання.','Інтеграція залежить від носія та задачі.'],'elintir-uca-1.webp'),
            product_row('sl1','SL-1','Радіомодем','Польові випробування','Модем оператора для каналу команд і телеметрії.', ['Частина сімейства засобів зв’язку s.Link.','Інтегрується з платформами на SDR та FPGA.'],'elintir-sl-1.webp',('/slink/','Про зв’язок')),
            product_row('zr3','ZR-3','Напрямлений сенсор','Прототип','Архітектура напрямленого сенсора з багатогранною антенною системою.', ['Оцінка напряму за двома осями в розробці.','Триває перевірка перед ширшим застосуванням.'])]
        cta = '<section class="section contact"><div class="wrap"><p class="eyebrow">Інтеграція</p><h2>Обговоримо вашу платформу.</h2><p class="lead">Покажемо поточну збірку та сплануємо інтеграцію разом із вашою командою.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20products">Написати ELINTIR ↗</a></div></section>'
    return intro + '<section class="wrap" aria-label="Products">' + ''.join(rows) + '</section>' + cta


def slink(lang):
    en = lang == 'en'
    if en:
        return f'''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Communications</p><h1>s.Link: radio links built for the platform.</h1><p class="lead">We develop our own FPGA radio links for telemetry, commands and digital video. SL-1 is the operator modem; MANET networking is an active development direction.</p></section>
        <section class="section wrap" id="sl1"><div class="feature-row"><div><p class="eyebrow">01 / Operator modem</p><h2>SL-1</h2><p class="lead">A compact modem that connects the operator station to the radio system. The telemetry and command profile has been field tested.</p><a class="inline-link" href="/en/hardware/#sl1">View product ↗</a></div><div class="product-media"><img src="/assets/products/elintir-sl-1.webp" alt="ELINTIR SL-1 modem" loading="lazy"></div></div></section>
        <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Signal profiles</p><h2>One family, several links.</h2><p>GMSK for narrow telemetry; BPSK and QPSK for data and video. Adaptive profiles are evaluated against channel conditions. The digital video link has bench and limited airborne validation.</p></div></div></section>
        <section class="section wrap"><p class="eyebrow">03 / Development roadmap</p><h2>From a link to a network.</h2><div class="mini-grid"><article><h3>Telemetry</h3><p>Field-tested command and data profile.</p></article><article><h3>Digital video</h3><p>FPGA implementation under staged testing.</p></article><article><h3>MANET</h3><p>Multi-node networking in development; bench validation is ongoing.</p></article></div></section>
        <section class="section contact"><div class="wrap"><p class="eyebrow">Integration</p><h2>Build the right link together.</h2><p class="lead">Share your platform requirements and we’ll discuss a technical demonstration.</p><a class="btn" href="mailto:info@elintir.com?subject=s.Link%20integration">Contact us ↗</a></div></section>'''
    return f'''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Зв’язок</p><h1>s.Link: радіозв’язок під платформу.</h1><p class="lead">Розробляємо власні радіолінки на FPGA для телеметрії, команд і цифрового відео. SL-1 — модем оператора; мережева архітектура MANET — активний напрям розвитку.</p></section>
    <section class="section wrap" id="sl1"><div class="feature-row"><div><p class="eyebrow">01 / Модем оператора</p><h2>SL-1</h2><p class="lead">Компактний модем поєднує станцію оператора з радіосистемою. Профіль команд і телеметрії пройшов польові випробування.</p><a class="inline-link" href="/hardware/#sl1">Переглянути продукт ↗</a></div><div class="product-media"><img src="/assets/products/elintir-sl-1.webp" alt="Модем ELINTIR SL-1" loading="lazy"></div></div></section>
    <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Профілі сигналу</p><h2>Одне сімейство, кілька каналів.</h2><p>GMSK для вузькосмугової телеметрії; BPSK і QPSK для даних та відео. Адаптивні профілі перевіряємо для різних умов каналу. Цифровий відеолінк має стендову й обмежену льотну перевірку.</p></div></div></section>
    <section class="section wrap"><p class="eyebrow">03 / Розвиток</p><h2>Від лінка до мережі.</h2><div class="mini-grid"><article><h3>Телеметрія</h3><p>Профіль команд і даних перевірений у полі.</p></article><article><h3>Цифрове відео</h3><p>Реалізація в FPGA проходить поетапні випробування.</p></article><article><h3>MANET</h3><p>Багатовузлова мережа в розробці; триває стендова перевірка.</p></article></div></section>
    <section class="section contact"><div class="wrap"><p class="eyebrow">Інтеграція</p><h2>Спроєктуємо потрібний канал.</h2><p class="lead">Розкажіть про вимоги вашої платформи, і ми обговоримо технічну демонстрацію.</p><a class="btn" href="mailto:info@elintir.com?subject=s.Link%20integration">Зв’язатися ↗</a></div></section>'''


def investors(lang):
    if lang == 'en':
        return '''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Investors</p><h1>One radio stack, several products.</h1><p class="lead">We build SDR systems for sensing and communications. Our value is in the signal-processing software, FPGA implementation and the data that helps improve them.</p><div class="hero-actions"><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20investor%20materials">Request investor materials ↗</a><a class="btn secondary" href="/en/hardware/">View products</a></div></section>
        <section class="section wrap"><p class="eyebrow">01 / Current portfolio</p><h2>A product stack with clear stages.</h2><div class="grid-3"><article class="text-card"><div class="number">OPERATOR SOFTWARE</div><h3>Kraban</h3><p>Core application delivered to customers, combining video, bearings, spectrum and events.</p></article><article class="text-card"><div class="number">RADIO HARDWARE</div><h3>GR-1 / SL-1</h3><p>Direction finding and communications hardware with field-validated configurations.</p></article><article class="text-card"><div class="number">NEXT STAGE</div><h3>UCA-1 / MANET</h3><p>Airborne sensing and multi-node networking remain in staged development.</p></article></div></section>
        <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Why it compounds</p><h2>One platform. Reusable engineering.</h2><p>Coherent reception, FPGA signal processing and operator software serve multiple product lines. Measurements and recorded data make each validation cycle more useful.</p></div></div></section>
        <section class="section wrap"><p class="eyebrow">03 / Next milestones</p><h2>From prototypes to repeatable deployments.</h2><div class="mini-grid"><article><h3>Integration</h3><p>Adapt current hardware and software to partner platforms.</p></article><article><h3>Validation</h3><p>Broaden controlled and field tests, with measured outcomes.</p></article><article><h3>Production</h3><p>Make validated configurations reproducible and supportable.</p></article></div></section>
        <section class="section contact"><div class="wrap"><p class="eyebrow">Investor dialogue</p><h2>Request the detailed materials.</h2><p class="lead">The data room and technical evidence are shared directly after an introduction.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20investor%20materials">Email ELINTIR ↗</a></div></section>'''
    return '''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Інвесторам</p><h1>Одна радіоплатформа. Кілька продуктів.</h1><p class="lead">Ми створюємо SDR-системи для розвідки та зв’язку. Цінність накопичується в алгоритмах обробки сигналу, реалізації в FPGA та даних для наступних ітерацій.</p><div class="hero-actions"><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20investor%20materials">Запросити матеріали ↗</a><a class="btn secondary" href="/hardware/">Переглянути продукти</a></div></section>
    <section class="section wrap"><p class="eyebrow">01 / Портфель</p><h2>Продуктовий стек із чіткими етапами.</h2><div class="grid-3"><article class="text-card"><div class="number">ПРОГРАМНЕ ЗАБЕЗПЕЧЕННЯ</div><h3>Kraban</h3><p>Основний застосунок передано замовникам; поєднує відео, пеленги, спектр і події.</p></article><article class="text-card"><div class="number">РАДІОАПАРАТУРА</div><h3>GR-1 / SL-1</h3><p>Пеленгація та зв’язок у конфігураціях, що пройшли польові перевірки.</p></article><article class="text-card"><div class="number">НАСТУПНИЙ ЕТАП</div><h3>UCA-1 / MANET</h3><p>Повітряний сенсор і багатовузлова мережа проходять поетапну розробку.</p></article></div></section>
    <section class="section feature"><div class="wrap feature-row solo"><div><p class="eyebrow">02 / Основа зростання</p><h2>Одна платформа. Повторне використання розробок.</h2><p>Когерентне приймання, обробка сигналу у FPGA та застосунок оператора працюють для кількох продуктових напрямів. Виміри та збережені дані роблять кожний цикл перевірки ціннішим.</p></div></div></section>
    <section class="section wrap"><p class="eyebrow">03 / Наступні віхи</p><h2>Від прототипів до відтворюваних систем.</h2><div class="mini-grid"><article><h3>Інтеграція</h3><p>Адаптація апаратури й програмного забезпечення до платформ партнерів.</p></article><article><h3>Перевірка</h3><p>Ширші контрольовані та польові випробування з вимірюваними результатами.</p></article><article><h3>Виробництво</h3><p>Повторювані конфігурації та підтримка перевірених рішень.</p></article></div></section>
    <section class="section contact"><div class="wrap"><p class="eyebrow">Діалог з інвесторами</p><h2>Запросіть докладні матеріали.</h2><p class="lead">Дата-рум і технічні докази надаємо персонально після знайомства.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20investor%20materials">Написати ELINTIR ↗</a></div></section>'''


def company(lang):
    if lang == 'en':
        return '''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Company</p><h1>Radio engineering, end to end.</h1><p class="lead">A Ukrainian team building systems where antennas, signal processing, radio links and operator software work together.</p></section>
        <section class="section wrap"><p class="eyebrow">01 / What we do</p><h2>From the signal to the interface.</h2><div class="grid-3"><article class="text-card"><div class="number">RECEIVE</div><h3>Coherent SDR</h3><p>Multichannel reception, interferometry and direction estimation.</p></article><article class="text-card"><div class="number">PROCESS</div><h3>FPGA and RF software</h3><p>Video, spectrum and signature processing close to the radio.</p></article><article class="text-card"><div class="number">CONNECT</div><h3>Communications</h3><p>Our own radio profiles for telemetry, commands and video.</p></article></div></section>
        <section class="section feature"><div class="wrap feature-row"><div><p class="eyebrow">02 / How we work</p><h2>Measure. Verify. Improve.</h2><p>We distinguish simulation, bench results and field tests. A product claim follows the evidence available for its current configuration.</p></div>''' + signal_svg('MEASURE / VERIFY') + '''</div></section>
        <section class="section wrap"><p class="eyebrow">03 / Work with us</p><h2>Bring a platform problem.</h2><p class="lead">We can discuss a technical demonstration, integration or research partnership.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20partnership">Contact ELINTIR ↗</a></section>'''
    return '''<section class="page-hero wrap"><p class="eyebrow">ELINTIR / Компанія</p><h1>Радіоінженерія від антени до інтерфейсу.</h1><p class="lead">Українська команда створює системи, в яких антени, обробка сигналу, радіозв’язок і застосунок оператора працюють разом.</p></section>
    <section class="section wrap"><p class="eyebrow">01 / Що ми робимо</p><h2>Від сигналу до рішення.</h2><div class="grid-3"><article class="text-card"><div class="number">ПРИЙМАННЯ</div><h3>Когерентний SDR</h3><p>Багатоканальне приймання, інтерферометрія та оцінка напряму.</p></article><article class="text-card"><div class="number">ОБРОБКА</div><h3>FPGA та RF-софт</h3><p>Обробка відео, спектра й сигнатур поблизу радіотракту.</p></article><article class="text-card"><div class="number">ЗВ’ЯЗОК</div><h3>Радіолінки</h3><p>Власні профілі для телеметрії, команд і відео.</p></article></div></section>
    <section class="section feature"><div class="wrap feature-row"><div><p class="eyebrow">02 / Як працюємо</p><h2>Вимірюємо. Перевіряємо. Поліпшуємо.</h2><p>Розрізняємо симуляцію, результати на стенді та польові випробування. Твердження про продукт спирається на докази для його поточної конфігурації.</p></div>''' + signal_svg('MEASURE / VERIFY') + '''</div></section>
    <section class="section wrap"><p class="eyebrow">03 / Співпраця</p><h2>Розкажіть про задачу вашої платформи.</h2><p class="lead">Обговоримо технічну демонстрацію, інтеграцію або дослідницьке партнерство.</p><a class="btn" href="mailto:info@elintir.com?subject=ELINTIR%20partnership">Зв’язатися з ELINTIR ↗</a></section>'''


def main():
    pages = [
        ('uk','home','SDR-системи розвідки та зв’язку','ELINTIR розробляє SDR-системи пеленгації, програмне забезпечення оператора та радіозв’язок.',home_uk()),
        ('en','home','SDR systems for reconnaissance and communications','ELINTIR develops SDR direction-finding systems, operator software and radio communications.',home_en()),
        ('uk','hardware','Продукти','Kraban, GR-1, UCA-1, SL-1 та ZR-3 — продукти й розробки ELINTIR.',hardware('uk')),
        ('en','hardware','Products','Kraban, GR-1, UCA-1, SL-1 and ZR-3 — ELINTIR products and developments.',hardware('en')),
        ('uk','slink','Зв’язок s.Link','Радіолінки ELINTIR для телеметрії, команд і цифрового відео. MANET у розробці.',slink('uk')),
        ('en','slink','s.Link communications','ELINTIR radio links for telemetry, commands and digital video. MANET in development.',slink('en')),
        ('uk','investors','Інвесторам','Продуктовий стек ELINTIR, етапи розвитку та запит матеріалів для інвесторів.',investors('uk')),
        ('en','investors','Investors','ELINTIR product stack, milestones and investor materials.',investors('en')),
        ('uk','company','Компанія','Українська команда ELINTIR: когерентний SDR, FPGA, радіозв’язок і застосунок оператора.',company('uk')),
        ('en','company','Company','ELINTIR team: coherent SDR, FPGA, radio communications and operator software.',company('en')),
    ]
    for lang, page, title, desc, content in pages:
        path = ROOT / ('en' if lang == 'en' else '') / ('' if page == 'home' else page) / 'index.html'
        path.write_text(base(lang,title,desc,content,page) + '\n',encoding='utf-8')
        print(path.relative_to(ROOT))


if __name__ == '__main__':
    main()
