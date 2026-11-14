# RAM upgrades and diagnostic fees — research for owner review

Перевірено 13 листопада 2026. Це порівняння відкритих прайсів, не статистика всього ринку Mayo. Сторонні ціни НЕ перенесені до каталогу Home Tech.

## Діагностика

| Ірландський сервіс | Опублікована плата | Умови / джерело |
|---|---:|---|
| ExpressTech, Dublin | €30 | Повністю зараховується в погоджений ремонт. https://www.expresstech.ie/products/laptop-diagnostic-service-1 |
| New Ross PC Repairs | €30 | Bench/diagnostic fee зараховується в ремонт; якщо ремонт економічно недоцільний, може залишитися діагностична плата. https://newrosspcrepair.ie/pricing/ |
| IT FIX Galway | Від €35 laptop; від €45 desktop | Діагностика зараховується у вартість ремонту. https://itfixgalway.ie/professional-repair-services/ |
| ForgePC, Dublin | Від €40 | General diagnostic; автоматичний credit на цій сторінці не підтверджений. https://www.forgepc.ie/repairs |
| Navan PC Repairs | €45 | Service & Diagnostic; credit не зазначений. https://navanpc.ie/shop/service-diagnostic/ |

П’ять орієнтирів, по одному на бізнес, із laptop-ставкою €35 для IT FIX: €30, €30, €35, €40, €45. Арифметичне середнє цієї малої вибірки €36, медіана €35, діапазон €30–45. Ставки «від», desktop/laptop та scope відрізняються, тому це НЕ доведена середня ціна в Ірландії або Mayo. Окремий діапазон оцінок €0–60 у Gary’s не включений у середнє: https://www.garyscomputerrepairservice.ie/pricing/ . Прозорого достатнього Mayo-only набору порівнюваних прайсів не знайдено.

## RAM

| Джерело | Публічний орієнтир | Чи зрозуміло, що включено |
|---|---:|---|
| New Ross PC Repairs | €30 + RAM | Явно робота окремо від пам’яті. https://newrosspcrepair.ie/pricing/ |
| Currys Ireland | €85 + parts | Загальна hardware installation, включаючи memory; ширша послуга, а не RAM-only ставка. https://www.currys.ie/services/repairs-maintenance/computer-maintenance.html |
| ForgePC | Від €50 | RAM upgrade; включення деталей не уточнене. https://www.forgepc.ie/repairs |
| Gary’s Computer Repair Service | €50–150 | RAM memory upgrade; склад ціни не розділений. https://www.garyscomputerrepairservice.ie/pricing/ |

Надійного RAM labour-only середнього з цієї вибірки немає. Не слід усереднювати загальну hardware installation, RAM-only labour та можливі ціни з деталями. Ціна самої пам’яті залежить від конкретного модуля й сумісності.

## Остаточне рішення власника — реалізовано

- Customer drop-off diagnostics: €40 standalone, без travel; arrange delivery in advance.
- Standalone on-site diagnostics: €50 minimum labour плюс existing travel, не €40 + €50.
- Separate €40 diagnostics fee waived only if repair is confirmed. Estimator never automatically deducts it.
- RAM replacement: від €40 labour; supplied RAM priced separately. Standalone on-site minimum €50 + travel.
- Overall on-site minimum applies once after eligible discounts. Travel/parts are never automatically waived.

Selectable pc-diagnostics and pc-ram are implemented in pricing-catalogue.mjs. Drop-off diagnostics are estimated separately from on-site work, preventing accidental removal of travel for another service. Diagnostics and pc-troubleshoot cannot duplicate the same assessment. The previous €50 rate recommendation is superseded by the owner's approved rules above. External prices do not define Home Tech prices.
