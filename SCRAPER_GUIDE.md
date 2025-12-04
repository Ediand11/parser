# Руководство по использованию веб-скрапера

## Статус реализации

✅ **Реализовано** (Phases 1-6):
- Все зависимости установлены
- Инфраструктура (rate limiter, HTTP client, robots.txt validator)
- URL management (очередь, дедупликация, checkpoint)
- Content extraction (Cheerio)
- Parsers (Finuslugi BFS, T-J sitemap)
- CSV export
- Orchestration (ScraperService, модули, интеграция)

⚠️ **Требует внимания** (Phase 7):
- **КРИТИЧНО**: CSS селекторы в `src/common/extract-text.util.ts` являются placeholder'ами
- Необходим тестовый запуск на 10 статьях
- Проверка качества извлеченных данных

⏳ **Ожидает** (Phase 8):
- Production run на полном объеме данных

## Критические шаги ПЕРЕД первым запуском

### 1. Найти правильные CSS селекторы

**Это ОБЯЗАТЕЛЬНЫЙ шаг!** Текущие селекторы в `src/common/extract-text.util.ts` - это placeholder'ы.

#### Для finuslugi.ru:
1. Открыть браузер и перейти на любую статью в `/navigator`
2. Открыть DevTools (F12)
3. Найти:
   - Селектор для заголовка (обычно `h1`)
   - Селектор для основного контента (например, `.article-content` или `.post-body`)
4. Обновить `SITE_SELECTORS.finuslugi` в `src/common/extract-text.util.ts`

#### Для t-j.ru:
1. Открыть браузер и перейти на любую статью
2. Открыть DevTools (F12)
3. Найти:
   - Селектор для заголовка
   - Селектор для основного контента
4. Обновить `SITE_SELECTORS.tj` в `src/common/extract-text.util.ts`

**Пример правильных селекторов:**
```typescript
export const SITE_SELECTORS: Record<string, SiteSelectors> = {
  finuslugi: {
    title: 'h1.article-title', // Обновить после проверки!
    content: '.article-body',   // Обновить после проверки!
    removeSelectors: ['.ads', '.navigation', 'script', 'style'],
  },
  tj: {
    title: 'h1',
    content: '.content__body',  // Обновить после проверки!
    removeSelectors: ['.ad', 'script', 'style'],
  },
};
```

## Запуск скрапера

### Тестовый запуск (рекомендуется начать с этого)

Для тестового запуска модифицируйте `main.ts`, временно ограничив количество статей:

```typescript
await scraperService.scrapeAll(10); // Только 10 статей для теста
```

Затем запустите:

```bash
pnpm run build
RUN_SCRAPER=true pnpm run start:prod
```

Или с флагом:

```bash
pnpm run build
node dist/main --scrape
```

### Production запуск

После успешного тестового запуска:

```bash
pnpm run build
RUN_SCRAPER=true pnpm run start:prod
```

По умолчанию скрапер собирает до 500 статей с каждого сайта.

## Возобновление после сбоя

Скрапер автоматически сохраняет прогресс каждые 50 статей в `output/checkpoint.json`.

При повторном запуске скрапер автоматически загрузит checkpoint и продолжит с места остановки.

Чтобы начать заново, удалите checkpoint:

```bash
rm output/checkpoint.json
```

## Вывод данных

Результаты сохраняются в `output/articles.csv` с колонками:
- **Основная ссылка** - базовый URL сайта
- **Ссылка на раздел** - URL раздела (для finuslugi) или пусто (для t-j)
- **Ссылка на статью** - URL конкретной статьи
- **Название статьи** - заголовок
- **Вся статья** - полный текст
- **Дата скрапинга** - timestamp в ISO формате

## Мониторинг процесса

Скрапер выводит логи в консоль:
- Каждые 10 статей: прогресс, размер очереди, количество посещенных URL
- Каждые 50 статей: сохранение checkpoint
- Все ошибки логируются с URL страницы

## Настройка параметров

### Rate limiting

Отредактируйте `src/common/rate-limiter.service.ts`:

```typescript
this.limiter = new Bottleneck({
  minTime: 1000,      // Миллисекунды между запросами
  maxConcurrent: 1    // Количество одновременных запросов
});
```

**Текущие настройки**: 1 запрос/секунду, без параллелизма (безопасно для robots.txt)

### Лимиты статей

Отредактируйте `src/main.ts`:

```typescript
await scraperService.scrapeAll(500); // Изменить число
```

Или вызовите по отдельности:

```typescript
await scraperService.scrapeFinuslugi(300);
await scraperService.scrapeTJ(200);
```

## Проверка результатов

После тестового запуска проверьте `output/articles.csv`:

1. Откройте CSV в Excel/LibreOffice
2. Проверьте колонку "Название статьи" - не должно быть пустых значений
3. Проверьте "Вся статья":
   - Текст должен быть связным
   - НЕ должно быть HTML тегов (`<div>`, `<span>`, etc.)
   - НЕ должно быть текста из навигации/меню
4. Проверьте кодировку - кириллица должна отображаться корректно

Если данные некорректны - вернитесь к шагу "Найти правильные CSS селекторы"!

## Типичные проблемы

### 1. Пустые или некорректные статьи

**Причина**: Неправильные CSS селекторы

**Решение**: Проверьте селекторы в DevTools и обновите `src/common/extract-text.util.ts`

### 2. HTTP 403 Forbidden

**Причина**: Сайт блокирует скрапинг

**Решение**:
- Проверьте User-Agent в `src/common/http-client.service.ts`
- Увеличьте delay между запросами
- Проверьте robots.txt compliance

### 3. Скрапер останавливается без ошибок

**Причина**: Закончились URL в очереди или достигнут лимит

**Решение**: Проверьте логи, возможно это нормальное завершение

### 4. Проблемы с кодировкой в CSV

**Причина**: Неправильная кодировка при открытии файла

**Решение**:
- Откройте CSV как UTF-8
- В Excel: Data → From Text/CSV → UTF-8

## Архитектура проекта

```
/src
  /common
    http-client.service.ts           # Axios + retry логика
    rate-limiter.service.ts          # Bottleneck (1 req/sec)
    robots-validator.service.ts      # Валидация robots.txt
    url-normalizer.util.ts           # Нормализация URL
    extract-text.util.ts             # ⚠️ CSS СЕЛЕКТОРЫ ЗДЕСЬ

  /crawler
    url-queue.service.ts             # BFS очередь + дедупликация
    checkpoint.service.ts            # Сохранение/загрузка прогресса

  /parsers
    finuslugi-parser.service.ts      # BFS обход finuslugi.ru/navigator
    tj-parser.service.ts             # Sitemap-based парсинг t-j.ru
    sitemap-parser.service.ts        # Парсинг sitemap XML

  /export
    csv-export.service.ts            # Запись в CSV (UTF-8)

  scraper.service.ts                 # Главный оркестратор
  scraper.module.ts                  # NestJS модуль
  main.ts                            # Entry point
```

## Следующие шаги

1. ✅ Зависимости установлены
2. ✅ Код реализован
3. ✅ Проект собирается
4. ⚠️ **КРИТИЧНО**: Найти CSS селекторы через DevTools
5. ⏳ Запустить тестовый скрапинг на 10 статьях
6. ⏳ Проверить качество данных в CSV
7. ⏳ Если OK - запустить production скрапинг на 500-1000 статей
8. ⏳ Проанализировать результаты

## Полезные команды

```bash
# Сборка проекта
pnpm run build

# Запуск скрапера (production mode)
RUN_SCRAPER=true pnpm run start:prod

# Запуск HTTP сервера (для отладки)
pnpm run start:dev

# Линтинг
pnpm run lint

# Очистка output директории
rm -rf output/*

# Просмотр checkpoint
cat output/checkpoint.json
```
