FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY pyproject.toml ./
COPY src/ src/
COPY tests/ tests/

RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV PYTHONPATH=/app/src

CMD ["python", "-c", "print('dataset-quality pipeline image ready')"]
