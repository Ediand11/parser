#!/bin/bash
# Скрипт для запуска парсера

# Проверка существования venv
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено"
    echo "Создаю venv и устанавливаю зависимости..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Запуск парсера с переданными аргументами
python3 main.py "$@"
