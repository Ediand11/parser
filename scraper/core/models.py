from dataclasses import dataclass


@dataclass
class ArticleRow:
    main_url: str      # https://finuslugi.ru/navigator или https://t-j.ru/
    section_url: str   # раздел/рубрика
    article_url: str   # конкретная статья
    title: str         # заголовок
    content: str       # весь текст статьи (plain text)
