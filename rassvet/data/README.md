# RASSVET: відкриті файли даних

Це статичний API для досліджень. Він не приймає координати й не виконує запити до сторонніх сервісів від імені відвідувача. Усі дати й часові мітки у файлах наведено в UTC.

| URL | Вміст |
| --- | --- |
| `/rassvet/data/manifest.json` | Межі доступних дат, опорна дата та час генерації. |
| `/rassvet/data/YYYY-MM-DD.json` | Щохвилинні положення 36 супутників у земній системі ECEF. Дату беріть із `manifest.json`. |
| `/rassvet/data/latest-gp.json` | Останні публічні GP/OMM рядки CelesTrak та час отримання. |
| `/rassvet/data/alerts.json` | Збережені інтервали тривог для завантажених районів. |

Після запуску автоматичного оновлювача файли оновлюються приблизно раз на дві години. Перевіряйте `generatedUtc` у `manifest.json` та `fetchedUtc` у GP. Історичні дні можуть використовувати окремий добовий GP-знімок. Ці положення є обчисленою орбітою, а не підтвердженням сигналу в ефірі.

## Формат щоденного файлу

`startUtc` — час першого відліку, `stepSeconds` — крок, `sampleCount` включає кінцевий відлік. `satellites` задає порядок супутників у полі `ecefB64`. Координати в кілометрах отримують діленням цілих чисел на `unitsPerKm` (зараз 10).

`ecefB64` — Base64 від масиву байтів у такому порядку для кожного супутника:

1. Перші X, Y, Z: три little-endian `int32`.
2. Для кожної наступної хвилини: зміни X, Y, Z від попереднього відліку, три little-endian `int16`.

Мінімальний приклад Python:

```python
import base64
import json
import struct
from urllib.request import urlopen

url = "https://elintir.com/rassvet/data/2026-11-23.json"
with urlopen(url) as response:
    day = json.load(response)

binary = base64.b64decode(day["ecefB64"])
offset = 0
for satellite in day["satellites"]:
    xyz = list(struct.unpack_from("<iii", binary, offset))
    offset += 12
    first_km = [value / day["unitsPerKm"] for value in xyz]
    for _ in range(1, day["sampleCount"]):
        delta = struct.unpack_from("<hhh", binary, offset)
        offset += 6
        xyz = [value + change for value, change in zip(xyz, delta)]
    print(satellite["id"], satellite["epoch"], first_km)

assert offset == len(binary)
```

Для введених на сторінці координат можна завантажити CSV проходів. Файл містить NORAD ID, час початку, піка й кінця в UTC, максимальний кут піднесення, азимут і відстань у піку, поріг видимості, епоху та вік GP. Це прогноз для планування спостереження, не журнал радіоприйому.

Джерела: [CelesTrak GP](https://celestrak.org/NORAD/documentation/gp-data-formats.php), [alerts.in.ua](https://devs.alerts.in.ua/).
